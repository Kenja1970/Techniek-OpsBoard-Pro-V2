// Techniek OpsBoard Pro V2 — optional agent proxy.
//
// Sole purpose: hold an LLM API key server-side so the browser never sees one,
// and expose exactly two endpoints — /health and /api/agent.
//
// This file replaces the former pm-specialist-proxy.mjs. The OpenAI vector-store
// RAG it also carried (file-search, vector-store file CRUD, upload, and the
// SharePoint procedure registry) was removed in v5.2.0: procedure answers now
// come from the bundled local corpus, which is retrieved in-browser with BM25,
// needs no key, and cannot hallucinate because it returns cited passages rather
// than generated text.
//
// The app is fully functional without this proxy running.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Use fileURLToPath rather than hand-parsing import.meta.url. Hand-parsing never
// URL-decodes the pathname, so any directory containing a space resolves to a
// literal "%20" path — the env file is then silently never found and the proxy
// reports itself unconfigured with the key sitting right there.
const ROOT = path.resolve(path.join(path.dirname(fileURLToPath(import.meta.url)), ".."));
const ENV_PATH = path.join(ROOT, "server", ".env.local");

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
const PORT = Number(env.PM_PROXY_PORT || env.AGENT_PROXY_PORT || 8787);

// Provider-agnostic: any OpenAI-compatible /chat/completions endpoint. Defaults
// to OpenRouter; point LLM_BASE_URL at OpenAI, a local Ollama
// (http://localhost:11434/v1), or any other compatible gateway.
const LLM_BASE_URL = (env.LLM_BASE_URL || "https://openrouter.ai/api/v1").replace(/\/+$/, "");
const LLM_API_KEY = env.LLM_API_KEY || env.OPENROUTER_API_KEY || "";
const LLM_MODEL = env.LLM_MODEL || "";
const LLM_MAX_TOKENS = Number(env.LLM_MAX_TOKENS || 1500);

// CORS: an explicit allowlist. Localhost only by default — this proxy holds an
// API key and must never be exposed to a public origin.
const ALLOWED_ORIGINS = (env.ALLOWED_ORIGINS ||
  "http://localhost:8100,http://127.0.0.1:8100,http://localhost:8081,http://127.0.0.1:8081,http://localhost:8080,http://127.0.0.1:8080")
  .split(",").map((s) => s.trim()).filter(Boolean);

function corsHeaders(req) {
  const origin = req && req.headers && req.headers.origin;
  const allow = origin && ALLOWED_ORIGINS.indexOf(origin) !== -1 ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
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

// Models do not reliably honor response_format:json_object — Anthropic models
// via OpenRouter intermittently wrap the object in a ```json fence, which made
// JSON.parse throw and discarded a perfectly good answer roughly one call in
// four. Strip the fence, then fall back to the outermost {...} span. This only
// ever RECOVERS an object; it never invents one, and the client still validates
// every action it contains.
function parseModelJson(content) {
  const raw = String(content || "").trim();
  if (!raw) return { parsed: null, parseError: "empty response" };

  const candidates = [raw];
  const fenced = /^```(?:json)?\s*\r?\n([\s\S]*?)\r?\n?```$/i.exec(raw);
  if (fenced) candidates.push(fenced[1].trim());
  // Outermost {...} span, for a model that wrapped the object in prose. Skipped
  // when the response is a JSON array, or this would reach inside it and pass
  // off an element as the whole contract object.
  const body = fenced ? fenced[1].trim() : raw;
  if (!body.startsWith("[")) {
    const first = body.indexOf("{"), last = body.lastIndexOf("}");
    if (first !== -1 && last > first) candidates.push(body.slice(first, last + 1));
  }

  let lastError = "";
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      // Only accept a real object — a bare string or array is not our contract.
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return { parsed, parseError: "" };
      lastError = "model returned " + (Array.isArray(parsed) ? "an array" : typeof parsed) + ", expected an object";
    } catch (e) { lastError = e.message; }
  }
  return { parsed: null, parseError: lastError };
}

async function handle(req, res) {
  if (req.method === "OPTIONS") { res.writeHead(204, corsHeaders(req)); return res.end(); }
  const url = new URL(req.url, "http://127.0.0.1:" + PORT);
  try {
    if (url.pathname === "/health") {
      // Report honestly and never echo the key itself.
      return json(res, 200, {
        ok: true,
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
      const { parsed, parseError } = parseModelJson(content);
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
    return json(res, 404, { error: "Not found" }, req);
  } catch (err) {
    return json(res, 500, { error: err.message || String(err) }, req);
  }
}

// Export the pure parser so tests can exercise it without binding a port, and
// only listen when this file is run directly rather than imported.
export { parseModelJson };

const isMain = (() => {
  try { return fileURLToPath(import.meta.url) === path.resolve(process.argv[1] || ""); }
  catch { return false; }
})();

if (isMain) http.createServer(handle).listen(PORT, "127.0.0.1", () => {
  console.log("Techniek OpsBoard agent proxy listening on http://127.0.0.1:" + PORT);
  console.log("  agent configured: " + !!(LLM_API_KEY && LLM_MODEL) + (LLM_MODEL ? " (" + LLM_MODEL + ")" : " — set LLM_API_KEY and LLM_MODEL in server/.env.local"));
});
