import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), ".."));
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
const API_KEY = env.OPENAI_API_KEY || "";
const DEFAULT_VECTOR_STORE_ID = env.OPENAI_VECTOR_STORE_ID || "vs_6a4cf99853c081919bd5a144069abdb4";
const MODEL = env.OPENAI_PM_MODEL || "gpt-5.5";

function json(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "http://127.0.0.1:8081",
    "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
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

async function handle(req, res) {
  if (req.method === "OPTIONS") return json(res, 204, {});
  const url = new URL(req.url, "http://127.0.0.1:" + PORT);
  try {
    if (url.pathname === "/health") {
      return json(res, 200, { ok: true, keyConfigured: !!API_KEY, vectorStoreId: DEFAULT_VECTOR_STORE_ID, model: MODEL });
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
    return json(res, 404, { error: "Not found" });
  } catch (err) {
    return json(res, 500, { error: err.message || String(err) });
  }
}

http.createServer(handle).listen(PORT, "127.0.0.1", () => {
  console.log("OpsBoard PM Specialist proxy listening on http://127.0.0.1:" + PORT);
});
