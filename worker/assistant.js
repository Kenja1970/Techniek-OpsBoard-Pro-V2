// PM Assistant — grounded synthesis.
//
// The model never computes a number and never names a procedure. It receives an
// evidence pack the application already computed, plus clauses retrieved
// verbatim from the user's own corpus, and arranges them into an argument in a
// project controls manager's voice. Everything it returns is re-validated
// client-side against the pack before a word of it is rendered.

const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";

// The persona is defined here, server-side, so a caller cannot rewrite it.
// It encodes the house style already used in docs/KNOWLEDGE-BASE.md: lead with
// the decision, quantify it, name the trade-off, cite the clause, and say what
// not to do — the anti-pattern is usually the more useful half.
const ASSISTANT_SYSTEM_PROMPT = [
  "You are the PM Assistant inside Techniek OpsBoard Pro, advising a project manager in an",
  "architecture/engineering firm. You write like a seasoned project controls manager: direct,",
  "quantitative, and useful to someone who is mid-problem.",
  "",
  "You are given EVIDENCE: metrics the application computed, deterministic findings with their",
  "evidence strings, named levers (real cards and people, with ids), and verbatim CLAUSES retrieved",
  "from the user's own procedure library.",
  "",
  "Absolute rules, enforced in code after you answer:",
  "1. Every number you state MUST appear in the EVIDENCE. Never calculate, estimate, round",
  "   differently, or infer a figure. If a number is not supplied, describe the condition without one.",
  "2. Every recommendation that cites a procedure MUST reference a clauseId from CLAUSES. Never",
  "   name, paraphrase, or invent a procedure that is not supplied.",
  "3. Never claim to have changed anything. You advise; the project manager acts.",
  "4. Prefer named levers over generic advice. Say which card or which person, using the supplied",
  "   titles and names.",
  "5. If the evidence does not support an answer, say so plainly and say what is missing.",
  "",
  "Style:",
  "- Open with the single most important judgement, in one sentence.",
  "- Rank moves by impact. Each move: what to do, the expected effect, the trade-off it costs.",
  "- Close with what NOT to do and why.",
  "- No adjective where a number exists. No filler, no restating the question, no pleasantries.",
  "",
  "Length: at most 4 moves and 2 avoid items. Each field is one or two sentences. Quote nothing",
  "verbatim from CLAUSES — the application renders the cited text itself; you reference it by id.",
  "",
  "Actionable adjustments ('actions' array):",
  "Generate 1 to 5 concrete, validated board operations directly tailored to achieve the question's goal.",
  "Supported ops (use ONLY ids from EVIDENCE):",
  '  { "op":"move",       "cardId":"<id>", "columnId":"<id>", "reason":"<why>" }',
  '  { "op":"update",     "cardId":"<id>", "fields":{ "estimateHours":<n>, "progress":<0-100>, "priority":"critical|high|medium|low", "due":"YYYY-MM-DD" }, "reason":"<why>" }',
  '  { "op":"reassign",   "cardId":"<id>", "resourceId":"<id>", "allocationPct":<0-100>, "reason":"<why>" }',
  '  { "op":"reschedule", "cardId":"<id>", "days":<integer, negative pulls earlier, positive pushes>, "reason":"<why>" }',
  '  { "op":"changeorder","projectId":"<id>", "title":"<text>", "budgetDelta":<n>, "scheduleDeltaDays":<n>, "category":"Scope|Budget|Schedule", "reason":"<why>" }',
  "",
  "Return ONLY a JSON object:",
  '{ "headline": "<one sentence judgement>",',
  '  "situation": "<2-3 sentences of grounded context>",',
  '  "moves": [ { "action": "<what to do>", "effect": "<expected effect>", "tradeoff": "<what it costs>",',
  '              "clauseIds": ["<id from CLAUSES>"], "leverIds": ["<card or resource id>"] } ],',
  '  "actions": [ <concrete operations above mapping directly to your recommendations to achieve the goal> ],',
  '  "avoid": [ "<what not to do and why>" ],',
  '  "gaps": [ "<condition your procedures do not cover, if any>" ] }',
].join("\n");

/**
 * Models do not reliably honor response_format:json_object — Anthropic models
 * via OpenRouter intermittently wrap the object in a ```json fence. This is the
 * same recovery the agent proxy gained in v5.2.1; it only ever RECOVERS an
 * object the model actually sent, never manufactures one.
 */
export function parseModelJson(content) {
  const raw = String(content || "").trim();
  if (!raw) return { parsed: null, parseError: "empty response" };

  const candidates = [raw];
  const fenced = /^```(?:json)?\s*\r?\n([\s\S]*?)\r?\n?```$/i.exec(raw);
  if (fenced) candidates.push(fenced[1].trim());
  const body = fenced ? fenced[1].trim() : raw;
  if (!body.startsWith("[")) {
    const first = body.indexOf("{"), last = body.lastIndexOf("}");
    if (first !== -1 && last > first) candidates.push(body.slice(first, last + 1));
  }

  let lastError = "";
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return { parsed, parseError: "" };
      lastError = "model returned " + (Array.isArray(parsed) ? "an array" : typeof parsed) + ", expected an object";
    } catch (e) { lastError = e.message; }
  }
  return { parsed: null, parseError: lastError };
}

/** Compact the pack into the exact context the model is allowed to see. */
function renderEvidence(pack) {
  const lines = [];
  lines.push("SCOPE: " + (pack.scope && pack.scope.name || "Portfolio"));
  lines.push("DIMENSIONS IN QUESTION: " + (pack.dimensions || []).join(", "));

  lines.push("\nMETRICS (authoritative — every figure you use must come from here):");
  for (const [k, v] of Object.entries(pack.metrics || {})) {
    if (v !== null && v !== undefined && v !== "") lines.push("  " + k + " = " + v);
  }

  if (pack.health && pack.health.overall) {
    lines.push("  healthScore = " + pack.health.overall.score + " (" + pack.health.overall.grade + ")");
  }

  lines.push("\nFINDINGS (computed by the application):");
  (pack.findings || []).forEach((f) => {
    lines.push("  [" + f.id + "] " + f.severity.toUpperCase() + " " + f.dimension + " — " + f.title);
    lines.push("      evidence: " + f.evidence);
    if (f.action) lines.push("      standing action: " + f.action);
  });

  const cards = (pack.levers && pack.levers.cards) || [];
  if (cards.length) {
    lines.push("\nWORK ITEMS (cards) you may adjust or cite (cardId · title · boardId · columnId · stage · age · progress · estimate · due · assigneeId):");
    cards.forEach((c) => lines.push("  cardId: " + c.id + " · \"" + c.title + "\" · boardId: " + (c.boardId || "") + " · columnId: " + (c.columnId || "") + " (" + (c.stage || "") + ")" +
      (c.projectId ? " · projectId: " + c.projectId : "") +
      (c.assigneeId ? " · assigneeId: " + c.assigneeId : "") +
      " · age: " + c.ageDays + "d · progress: " + c.progress + "% · estimate: " + c.estimateHours + "h" +
      (c.due ? " · due: " + c.due : "")));
  }

  const boards = (pack.levers && pack.levers.boards) || [];
  if (boards.length) {
    lines.push("\nAVAILABLE BOARD STAGES for moving cards:");
    boards.forEach((b) => {
      lines.push("  Board " + b.id + " (\"" + b.name + "\"):");
      (b.columns || []).forEach((col) => {
        lines.push("    columnId: " + col.id + " (\"" + col.name + "\", WIP limit: " + (col.wip || "none") + ")");
      });
    });
  }

  const people = (pack.levers && pack.levers.resources) || [];
  if (people.length) {
    lines.push("\nPEOPLE you may assign or rebalance (resourceId · name · role · utilization):");
    people.forEach((p) => lines.push("  resourceId: " + p.id + " · " + p.name + " · " + p.role + " · " +
      p.utilPct + "%" + (p.overAllocated ? " (OVER-ALLOCATED)" : "") + (p.hasHeadroom ? " (AVAILABLE CAPACITY)" : "")));
  }

  const cos = (pack.levers && pack.levers.changeOrders) || [];
  if (cos.length) {
    lines.push("\nOPEN CHANGE ORDERS (id · number · title · status):");
    cos.forEach((c) => lines.push("  " + c.id + " · " + c.number + " · " + c.title + " · " + c.status));
  }

  lines.push("\nCLAUSES from the user's procedure library (quote or cite by clauseId only):");
  const seen = new Set();
  (pack.clauses || []).forEach((group) => {
    group.matches.forEach((m) => {
      if (seen.has(m.chunkId)) return;
      seen.add(m.chunkId);
      lines.push("  [" + m.chunkId + "] " + m.title + " — " + (m.heading || "(untitled section)") +
        (m.revision && m.revision !== "—" ? " (rev " + m.revision + ")" : ""));
      lines.push("      " + m.passage.replace(/\s+/g, " ").slice(0, 900));
    });
  });
  if (!seen.size) lines.push("  (none — no procedure in the library covers these conditions)");

  if ((pack.gaps || []).length) {
    lines.push("\nUNCOVERED CONDITIONS (no procedure matched):");
    pack.gaps.forEach((g) => lines.push("  " + g.title));
  }

  return lines.join("\n");
}

export async function advise(env, pack) {
  const apiKey = env.LLM_API_KEY;
  const model = env.LLM_MODEL;
  if (!apiKey || !model) {
    return { ok: false, configured: false, error: "No language model is configured. Set LLM_API_KEY and LLM_MODEL." };
  }
  const baseUrl = (env.LLM_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");

  const headers = {
    Authorization: "Bearer " + apiKey,
    "Content-Type": "application/json",
  };
  if (/openrouter\.ai/.test(baseUrl)) {
    headers["HTTP-Referer"] = "https://techniek-opsboard.workers.dev/";
    headers["X-Title"] = "Techniek OpsBoard Pro V2";
  }

  // Structured output needs headroom. A whole answer — headline, situation,
  // several moves with their clause references, what to avoid — does not fit in
  // the 1500 tokens that suffice for the agent's short action lists, and a
  // truncated response surfaces as an unterminated-string JSON error rather
  // than as "the answer was cut off". Hence a floor, not just a default.
  const maxTokens = Math.max(Number(env.LLM_MAX_TOKENS || 0), 3000);

  const res = await fetch(baseUrl + "/chat/completions", {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: ASSISTANT_SYSTEM_PROMPT },
        { role: "user", content: "EVIDENCE:\n" + renderEvidence(pack) + "\n\nQUESTION:\n" + String(pack.question || "").slice(0, 2000) },
      ],
    }),
  });

  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; }
  catch { return { ok: false, configured: true, error: "Model gateway returned non-JSON: " + text.slice(0, 240) }; }
  if (!res.ok) {
    return { ok: false, configured: true, error: (data.error && data.error.message) || res.statusText || "Model request failed" };
  }

  const choice = data?.choices?.[0] || {};
  const content = choice.message?.content || "";
  const finish = choice.finish_reason || choice.native_finish_reason || "";

  const { parsed, parseError } = parseModelJson(content);
  if (!parsed) {
    // Distinguish "ran out of room" from "returned something malformed" — they
    // have different fixes and the raw JSON error says neither.
    const truncated = finish === "length";
    return {
      ok: false,
      configured: true,
      truncated: truncated,
      error: truncated
        ? "The model's answer was cut off at the " + maxTokens + "-token limit before it finished. " +
          "Ask a narrower question, or raise LLM_MAX_TOKENS."
        : "Could not parse the model's answer: " + parseError,
      raw: content.slice(0, 600),
    };
  }

  return {
    ok: true,
    configured: true,
    model,
    answer: {
      headline: String(parsed.headline || ""),
      situation: String(parsed.situation || ""),
      moves: Array.isArray(parsed.moves) ? parsed.moves.slice(0, 8) : [],
      actions: Array.isArray(parsed.actions) ? parsed.actions.slice(0, 12) : [],
      avoid: Array.isArray(parsed.avoid) ? parsed.avoid.slice(0, 5) : [],
      gaps: Array.isArray(parsed.gaps) ? parsed.gaps.slice(0, 5) : [],
    },
  };
}
