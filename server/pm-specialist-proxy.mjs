import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Use fileURLToPath rather than hand-parsing import.meta.url. The previous
// approach never URL-decoded the pathname, so any directory containing a space
// resolved to a literal "%20" path — the env file was then silently never
// found and the proxy reported itself unconfigured with the key sitting right
// there. fileURLToPath handles percent-decoding and the Windows drive prefix.
const ROOT = path.resolve(path.join(path.dirname(fileURLToPath(import.meta.url)), ".."));
const ENV_PATH = path.join(ROOT, "server", ".env.local");
const REGISTRY_PATH = path.join(ROOT, "server", "data", "sharepoint-procedure-registry.json");

function loadEnv(file) {
  if (!fs.existsSync(file)) return {};
  return Object.fromEntries(fs.readFileSync(file, "utf8").split(/\r?\n/).map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return null;
    const idx = trimmed.indexOf("=");
    if (idx === -1) return null;
    return [trimmed.slice(0, idx).trim(), trimmed.slice(idx + 1).trim()];
  }).filter(Boolean));
}

const env = { ...loadEnv(ENV_PATH), ...process.env };
const PORT = Number(env.PM_PROXY_PORT || 8787);

// --- Optional vector-store path (legacy, OpenAI-specific) -------------------
const API_KEY = env.OPENAI_API_KEY || "";
const DEFAULT_VECTOR_STORE_ID = env.OPENAI_VECTOR_STORE_ID || "";
const MODEL = env.OPENAI_PM_MODEL || "";

// --- Agent LLM path (provider-agnostic, OpenAI-compatible /chat/completions).
// Defaults to OpenRouter; point LLM_BASE_URL elsewhere for OpenAI, a local
// Ollama (http://localhost:11434/v1), or any other compatible gateway.
const LLM_BASE_URL = (env.LLM_BASE_URL || "https://openrouter.ai/api/v1").replace(/\/+$/, "");
const LLM_API_KEY = env.LLM_API_KEY || env.OPENROUTER_API_KEY || "";
const LLM_MODEL = env.LLM_MODEL || "";
const LLM_MAX_TOKENS = Number(env.LLM_MAX_TOKENS || 1500);

// CORS: an explicit allowlist. The previous hardcoded single origin broke the
// moment the app was served from a different port. Localhost only by default —
// this proxy holds an API key and must never be exposed to a public origin.
const ALLOWED_ORIGINS = (env.ALLOWED_ORIGINS ||
  "http://localhost:8100,http://127.0.0.1:8100,http://localhost:8081,http://127.0.0.1:8081,http://localhost:8080,http://127.0.0.1:8080")
  .split(",").map((s) => s.trim()).filter(Boolean);

function corsHeaders(req) {
  const origin = req && req.headers && req.headers.origin;
  const allow = origin && ALLOWED_ORIGINS.indexOf(origin) !== -1 ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function json(res, status, body, req) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", ...corsHeaders(req) });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function readJson(req) {
  const body = await readBody(req);
  if (!body.length) return {};
  return JSON.parse(body.toString("utf8"));
}

function requireKey() {
  if (!API_KEY) throw new Error("OPENAI_API_KEY is not configured in server/.env.local.");
}

async function openai(pathname, options = {}) {
  requireKey();
  const res = await fetch("https://api.openai.com/v1" + pathname, {
    ...options,
    headers: {
      Authorization: "Bearer " + API_KEY,
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!res.ok) throw new Error(data.error?.message || data.error || res.statusText);
  return data;
}

function vectorStoreIdFrom(req, body) {
  const url = new URL(req.url, "http://127.0.0.1:" + PORT);
  return body?.vectorStoreId || url.searchParams.get("vectorStoreId") || DEFAULT_VECTOR_STORE_ID;
}

async function enrichVectorStoreFiles(data) {
  const rows = Array.isArray(data?.data) ? data.data : [];
  const enriched = await Promise.all(rows.map(async (row) => {
    const fileId = row.file_id || row.id;
    if (!fileId) return row;
    try {
      const file = await openai("/files/" + encodeURIComponent(fileId));
      return {
        ...row,
        file_id: fileId,
        filename: file.filename || row.filename || fileId,
        bytes: file.bytes ?? row.usage_bytes ?? 0,
        purpose: file.purpose || "",
        file_created_at: file.created_at || null,
      };
    } catch (err) {
      return { ...row, file_id: fileId, filename: row.filename || fileId, file_metadata_error: err.message || String(err) };
    }
  }));
  return { ...data, data: enriched, files: enriched };
}

async function listVectorStoreFiles(vectorStoreId, limit, all) {
  const pageLimit = Math.max(1, Math.min(parseInt(limit, 10) || 100, 100));
  let after = "";
  let pageCount = 0;
  let hasMore = false;
  let last = { data: [] };
  const out = [];
  do {
    const params = new URLSearchParams({ limit: String(pageLimit) });
    if (after) params.set("after", after);
    last = await openai("/vector_stores/" + encodeURIComponent(vectorStoreId) + "/files?" + params.toString());
    const enriched = await enrichVectorStoreFiles(last);
    out.push(...(enriched.data || []));
    const rows = Array.isArray(last.data) ? last.data : [];
    after = last.last_id || (rows.length ? rows[rows.length - 1].id : "");
    hasMore = !!(last.has_more && after);
    pageCount += 1;
  } while (all && hasMore && pageCount < 200);
  return { ...last, data: out, files: out, count: out.length, page_count: pageCount, complete: !hasMore };
}

function parseMultipart(buffer, contentType) {
  const match = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || "");
  if (!match) throw new Error("Missing multipart boundary.");
  const boundary = "--" + (match[1] || match[2]);
  const raw = buffer.toString("binary");
  const parts = raw.split(boundary).slice(1, -1);
  const out = {};
  for (const part of parts) {
    const cleaned = part.replace(/^\r\n/, "").replace(/\r\n$/, "");
    const idx = cleaned.indexOf("\r\n\r\n");
    if (idx === -1) continue;
    const head = cleaned.slice(0, idx);
    let content = cleaned.slice(idx + 4);
    const name = /name="([^"]+)"/.exec(head)?.[1];
    const filename = /filename="([^"]*)"/.exec(head)?.[1];
    const type = /Content-Type:\s*([^\r\n]+)/i.exec(head)?.[1] || "application/octet-stream";
    if (!name) continue;
    const bytes = Buffer.from(content, "binary");
    out[name] = filename ? { filename, type, bytes } : bytes.toString("utf8");
  }
  return out;
}

// System prompt for the agent path. Two hard rules encoded here, and enforced
// again client-side because a prompt is guidance, not a guarantee:
//   1. Only emit ids that appear in the supplied context.
//   2. Never claim to have changed anything — the app validates and applies.
const AGENT_SYSTEM_PROMPT = [
  "You are the PM Agent inside Techniek OpsBoard Pro, a project-controls application.",
  "You convert a project manager's request into STRUCTURED ACTIONS against their live board.",
  "",
  "Return ONLY a JSON object, no prose outside it, of the form:",
  '{ "narrative": "<one short paragraph explaining what you propose and why>",',
  '  "actions": [ { "op": "...", ... } ],',
  '  "clarification": "<ask a question here INSTEAD of guessing, and return an empty actions array>" }',
  "",
  "Supported ops and their fields:",
  '  { "op":"move",       "cardId":"<id>", "columnId":"<id>" }',
  '  { "op":"update",     "cardId":"<id>", "fields":{ "estimateHours":<n>, "loggedHours":<n>, "progress":<0-100>, "priority":"critical|high|medium|low", "due":"YYYY-MM-DD", "startDate":"YYYY-MM-DD", "title":"<text>" } }',
  '  { "op":"reassign",   "cardId":"<id>", "resourceId":"<id>", "allocationPct":<0-100> }',
  '  { "op":"reschedule", "cardId":"<id>", "days":<integer, negative pulls earlier> }',
  '  { "op":"create",     "title":"<text>", "boardId":"<id>", "columnId":"<id>", "projectId":"<id|null>", "estimateHours":<n> }',
  '  { "op":"changeorder","projectId":"<id>", "title":"<text>", "budgetDelta":<n>, "scheduleDeltaDays":<n>, "category":"Scope|Budget|Schedule|Quality|Resource|Other" }',
  "Every action SHOULD also carry a short \"reason\" string.",
  "",
  "Rules you must follow:",
  "1. Use ONLY ids present in the CONTEXT below. Never invent an id. If you cannot find the item the user means, return an empty actions array and ask in \"clarification\".",
  "2. You do NOT apply anything. The application validates every action against its governance (WIP limits, evidence gates, dependency gates, progress mode) and the user approves a diff. Never say a change has been made.",
  "3. Never propose editing a computed metric (CPI, SPI, EAC, multiplier, contribution margin). Those are derived from the underlying data — change the data instead.",
  "4. Change orders are DRAFTS for a change control board. Never describe one as approved.",
  "5. Prefer the smallest set of actions that satisfies the request. If the user only asked a question, return zero actions and answer in \"narrative\".",
].join("\n");

async function llmChat(messages, { jsonOnly = true } = {}) {
  if (!LLM_API_KEY) throw new Error("LLM_API_KEY is not configured in server/.env.local.");
  if (!LLM_MODEL) throw new Error("LLM_MODEL is not configured in server/.env.local.");
  const payload = {
    model: LLM_MODEL,
    messages,
    max_tokens: LLM_MAX_TOKENS,
    temperature: 0.2,
  };
  if (jsonOnly) payload.response_format = { type: "json_object" };
  const headers = {
    Authorization: "Bearer " + LLM_API_KEY,
    "Content-Type": "application/json",
  };
  // OpenRouter attribution headers; harmless on other OpenAI-compatible gateways.
  if (/openrouter\.ai/.test(LLM_BASE_URL)) {
    headers["HTTP-Referer"] = "https://kenja1970.github.io/Techniek-OpsBoard-Pro-V2/";
    headers["X-Title"] = "Techniek OpsBoard Pro V2";
  }
  const res = await fetch(LLM_BASE_URL + "/chat/completions", { method: "POST", headers, body: JSON.stringify(payload) });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { throw new Error("LLM returned non-JSON response: " + text.slice(0, 300)); }
  if (!res.ok) throw new Error(data?.error?.message || res.statusText || "LLM request failed");
  return data?.choices?.[0]?.message?.content || "";
}

async function handle(req, res) {
  if (req.method === "OPTIONS") { res.writeHead(204, corsHeaders(req)); return res.end(); }
  const url = new URL(req.url, "http://127.0.0.1:" + PORT);
  try {
    if (url.pathname === "/health") {
      return json(res, 200, {
        ok: true,
        // Legacy vector-store path
        keyConfigured: !!API_KEY, vectorStoreId: DEFAULT_VECTOR_STORE_ID, model: MODEL,
        // Agent LLM path
        agent: { configured: !!(LLM_API_KEY && LLM_MODEL), baseUrl: LLM_BASE_URL, model: LLM_MODEL || null },
      }, req);
    }
    // Agent intent interpretation + findings narration.
    if (url.pathname === "/api/agent" && req.method === "POST") {
      const body = await readJson(req);
      const mode = body.mode === "narrate" ? "narrate" : "interpret";
      const context = typeof body.context === "string" ? body.context : JSON.stringify(body.context || {});
      const question = String(body.question || "").slice(0, 4000);
      const system = mode === "narrate"
        ? "You are the PM Advisor inside Techniek OpsBoard Pro. Given a portfolio snapshot and a list of DETERMINISTIC findings already computed by the application, write a short executive brief: what is wrong, why it matters, and what to do first. Ground every statement in the supplied numbers — do not invent figures or findings. Return ONLY JSON: { \"narrative\": \"<markdown>\", \"actions\": [] }."
        : AGENT_SYSTEM_PROMPT;
      const content = await llmChat([
        { role: "system", content: system },
        { role: "user", content: "CONTEXT (authoritative — ids come from here):\n" + context.slice(0, 60000) + "\n\nREQUEST:\n" + question },
      ]);
      let parsed = null, parseError = "";
      try { parsed = JSON.parse(content); } catch (e) { parseError = e.message; }
      // The client re-validates everything; the proxy only reports what it got.
      return json(res, 200, {
        ok: !!parsed, parseError,
        narrative: parsed?.narrative || "",
        clarification: parsed?.clarification || "",
        actions: Array.isArray(parsed?.actions) ? parsed.actions : [],
        raw: parsed ? undefined : content.slice(0, 2000),
        model: LLM_MODEL,
      }, req);
    }
    if (url.pathname === "/api/vector-store/files" && req.method === "GET") {
      const vectorStoreId = vectorStoreIdFrom(req);
      const limit = url.searchParams.get("limit") || "100";
      const all = /^(1|true|yes)$/i.test(url.searchParams.get("all") || "");
      const data = await listVectorStoreFiles(vectorStoreId, limit, all);
      return json(res, 200, data);
    }
    if (url.pathname === "/api/vector-store/files" && req.method === "POST") {
      const body = await readJson(req);
      const vectorStoreId = vectorStoreIdFrom(req, body);
      if (!body.file_id) throw new Error("file_id is required.");
      const data = await openai("/vector_stores/" + encodeURIComponent(vectorStoreId) + "/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_id: body.file_id, attributes: body.attributes || {} }),
      });
      return json(res, 200, data);
    }
    if (url.pathname.startsWith("/api/vector-store/files/") && req.method === "DELETE") {
      const fileId = decodeURIComponent(url.pathname.split("/").pop());
      const vectorStoreId = vectorStoreIdFrom(req);
      const data = await openai("/vector_stores/" + encodeURIComponent(vectorStoreId) + "/files/" + encodeURIComponent(fileId), { method: "DELETE" });
      return json(res, 200, data);
    }
    if (url.pathname === "/api/vector-store/upload" && req.method === "POST") {
      const body = await readBody(req);
      const parts = parseMultipart(body, req.headers["content-type"]);
      const file = parts.file;
      const vectorStoreId = parts.vectorStoreId || DEFAULT_VECTOR_STORE_ID;
      if (!file?.bytes) throw new Error("file field is required.");
      const fd = new FormData();
      fd.append("purpose", "assistants");
      fd.append("file", new Blob([file.bytes], { type: file.type }), file.filename);
      const uploaded = await openai("/files", { method: "POST", body: fd });
      const attached = await openai("/vector_stores/" + encodeURIComponent(vectorStoreId) + "/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_id: uploaded.id, attributes: { title: file.filename, source: "OpsBoard PM Specialist upload" } }),
      });
      return json(res, 200, { uploaded, attached, file: { id: uploaded.id, file_id: uploaded.id, filename: uploaded.filename, bytes: uploaded.bytes, purpose: uploaded.purpose } });
    }
    if (url.pathname === "/api/file-search" && req.method === "POST") {
      const body = await readJson(req);
      const vectorStoreId = body.vectorStoreId || DEFAULT_VECTOR_STORE_ID;
      if (!body.question) throw new Error("question is required.");
      const data = await openai("/responses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: body.model || MODEL,
          instructions: "You are the Techniek PM Assistance partner for project managers. Answer only from retrieved vector-store file-search results. If the vector store does not contain enough support, say that the answer is not available in the PM Specialist procedure store. Do not use general model knowledge. You may use project facts explicitly included in the user's prompt as user-provided context for applying retrieved procedures, but recommendations and process guidance must remain grounded in the retrieved vector-store material. Write as a practical senior PM coworker: concise, well-grounded, professionally worded, and copy-ready. Prefer this structure when supported by the retrieved files: Executive answer, Basis from procedure store, Recommended PM actions, Risks or cautions, and Source notes. Keep citations brief in the answer body and rely on the app citation panel for detail.",
          input: body.question,
          tools: [{ type: "file_search", vector_store_ids: [vectorStoreId], max_num_results: body.maxResults || 8 }],
          include: ["file_search_call.results"],
        }),
      });
      const outputText = (data.output || []).flatMap((item) => item.content || []).filter((c) => c.type === "output_text").map((c) => c.text).join("\n");
      const results = (data.output || []).filter((item) => item.type === "file_search_call").flatMap((item) => item.results || []);
      const guardedText = results.length ? outputText : "The answer is not available in the PM Specialist procedure store.";
      return json(res, 200, { outputText: guardedText, results, raw: data, storeOnly: true });
    }
    if (url.pathname === "/api/sharepoint-registry" && req.method === "GET") {
      const data = fs.existsSync(REGISTRY_PATH) ? JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf8")) : [];
      return json(res, 200, { data });
    }
    if (url.pathname === "/api/sharepoint-registry" && req.method === "POST") {
      const body = await readJson(req);
      fs.writeFileSync(REGISTRY_PATH, JSON.stringify(body.data || [], null, 2));
      return json(res, 200, { ok: true });
    }
    return json(res, 404, { error: "Not found" }, req);
  } catch (err) {
    return json(res, 500, { error: err.message || String(err) }, req);
  }
}

http.createServer(handle).listen(PORT, "127.0.0.1", () => {
  console.log("OpsBoard PM Specialist proxy listening on http://127.0.0.1:" + PORT);
});
