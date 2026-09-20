// Corporate PM standards: ingest and retrieval.
//
// Chunking mirrors scripts/build-knowledge.mjs — one passage per `##` section —
// so a citation points at the clause that answers the question rather than at a
// whole document.

import { embedAll, embedOne, toVectorLiteral, EMBEDDING_MODEL, EMBEDDING_DIM } from "./embeddings.js";

export const DIMENSIONS = ["Cost", "Schedule", "Margin", "Flow", "Risk", "Resource", "Governance"];

// Reciprocal Rank Fusion constant. 60 is the value from the original RRF paper
// and is deliberately not tuned to this corpus.
const RRF_K = 60;

// A query that matches nothing must return nothing rather than the least-bad
// paragraph in the corpus.
//
// Calibrated against this model rather than guessed: bge-base-en-v1.5 scores
// ~0.49-0.51 between arbitrary unrelated English texts (measured with an
// off-topic control query), while genuine procedure matches land at 0.63-0.71.
// A floor of 0.58 sits in that gap. A lexical hit alone is NOT enough to clear
// it — "improve" and "schedule" both appear in the cost procedure without it
// being the clause that governs schedule recovery — so only a curated trigger
// phrase, which is an explicit editorial binding, may bypass the floor.
const MIN_COSINE = 0.58;

function parseFrontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!m) return { meta: {}, body: text };
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(line.trim());
    if (kv) meta[kv[1]] = kv[2].trim();
  }
  return { meta, body: text.slice(m[0].length) };
}

function sections(body) {
  const out = [];
  for (const part of body.split(/\n(?=##\s+)/)) {
    const h = /^##\s+(.+)$/m.exec(part);
    const heading = h ? h[1].trim() : "";
    const text = part.replace(/^##\s+.+$/m, "").trim();
    if (text) out.push({ heading, text });
  }
  return out.length ? out : [{ heading: "", text: body.trim() }];
}

function csv(value) {
  return String(value || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}

// Postgres rejects NUL in a text column, and PDF extraction leaks C0 controls.
// Strip them here too so no importer can poison the corpus.
function stripControls(s) {
  return String(s || "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[\uD800-\uDFFF\uFFFE\uFFFF]/g, "");
}

async function sha256(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Ingest one procedure. Re-ingesting the same id supersedes the previous
 * revision rather than mutating it, so a compliance report that cited Rev B
 * still resolves after Rev C lands.
 */
/** Document ids are namespaced by owner so two users can hold the same title. */
function scopedId(ownerId, rawId) {
  return ownerId + ":" + rawId;
}
export function publicId(storedId) {
  const i = String(storedId).indexOf(":");
  return i === -1 ? storedId : storedId.slice(i + 1);
}

export async function ingestDocument(client, env, opts) {
  const { meta, body } = parseFrontmatter(String(opts.markdown || ""));
  const rawId = opts.id || meta.id;
  if (!rawId) throw new Error("A document id is required (frontmatter `id:` or an explicit id).");
  if (!opts.ownerId) throw new Error("An owning user is required.");
  const docKey = scopedId(opts.ownerId, rawId);

  const title = opts.title || meta.title || docKey;
  const source = opts.source || meta.source || "Uploaded procedure";
  const revision = opts.revision || meta.revision || "—";
  const dimension = opts.dimension || meta.dimension || null;
  const triggers = opts.triggers || csv(meta.triggers);
  const tags = opts.tags || csv(meta.tags);
  const effectiveDate = opts.effectiveDate || meta.effective_date || null;
  const origin = opts.origin || "upload";

  // Markdown self-chunks on `##`. PDFs and other structured sources arrive
  // pre-chunked by the importer, which knows where the page and clause
  // boundaries actually are.
  const chunks = Array.isArray(opts.chunks) && opts.chunks.length
    ? opts.chunks
        .map((c) => ({
          heading: stripControls(c.heading).slice(0, 300),
          text: stripControls(c.content || c.text).trim(),
        }))
        .filter((c) => c.text)
    : sections(body).map((s) => ({ heading: stripControls(s.heading), text: stripControls(s.text) }));
  if (!chunks.length) throw new Error("No readable content found in the document.");

  // Append mode: a large standard is uploaded in parts so one failure costs a
  // part rather than a 400-page import. Parts after the first add chunks to the
  // document already created, and must not re-supersede or clear it.
  if (opts.append) {
    const head = await client.query(
      "SELECT id FROM guideline_docs WHERE id = $1 AND owner_user_id = $2",
      [docKey, opts.ownerId]
    );
    if (!head.rows.length) throw new Error("Cannot append to '" + rawId + "': no such document. Send the first part without append.");

    const max = await client.query("SELECT COALESCE(MAX(ordinal), -1) AS n FROM guideline_chunks WHERE doc_id = $1", [docKey]);
    const offset = Number(max.rows[0].n) + 1;
    const vecs = await embedAll(env, chunks.map((c) => (c.heading ? c.heading + "\n" : "") + c.text));
    await insertChunks(client, docKey, chunks, vecs, offset);
    return { id: docKey, appended: chunks.length, from: offset, chunks: offset + chunks.length };
  }

  const hash = await sha256(
    title + "\u0000" + revision + "\u0000" +
    (body || chunks.map((c) => c.heading + "\u0001" + c.text).join("\u0002"))
  );

  // Same id + same revision + identical content is a no-op, so re-running an
  // ingest is safe and cheap.
  const existing = await client.query(
    "SELECT id, content_hash FROM guideline_docs WHERE id = $1 AND owner_user_id = $2",
    [docKey, opts.ownerId]
  );
  if (existing.rows.length && existing.rows[0].content_hash === hash) {
    return { id: rawId, unchanged: true, chunks: 0 };
  }

  // Supersede any prior revision of this document.
  if (existing.rows.length) {
    await client.query(
      "UPDATE guideline_docs SET status = 'superseded', superseded_by = $1 WHERE id = $2 AND status = 'active'",
      [docKey, docKey]
    );
  }

  const vectors = await embedAll(env, chunks.map((c) => (c.heading ? c.heading + "\n" : "") + c.text));

  await client.query(
    `INSERT INTO guideline_docs
       (id, org_id, owner_user_id, visibility, title, source, revision, effective_date,
        status, dimension, triggers, tags, uploaded_by, content_hash, origin)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'active',$9,$10,$11,$12,$13,$14)
     ON CONFLICT (id) DO UPDATE SET
       title = EXCLUDED.title, source = EXCLUDED.source, revision = EXCLUDED.revision,
       effective_date = EXCLUDED.effective_date, status = 'active',
       visibility = EXCLUDED.visibility,
       dimension = EXCLUDED.dimension, triggers = EXCLUDED.triggers, tags = EXCLUDED.tags,
       uploaded_by = EXCLUDED.uploaded_by, content_hash = EXCLUDED.content_hash,
       superseded_by = NULL, origin = EXCLUDED.origin`,
    [docKey, opts.orgId, opts.ownerId, opts.visibility === "org" ? "org" : "private",
     title, source, revision,
     /^\d{4}-\d{2}-\d{2}$/.test(effectiveDate || "") ? effectiveDate : null,
     dimension, triggers, tags, opts.uploadedBy || opts.ownerId, hash, origin]
  );

  await client.query("DELETE FROM guideline_chunks WHERE doc_id = $1", [docKey]);
  await insertChunks(client, docKey, chunks, vectors, 0);

  return { id: rawId, title, revision, chunks: chunks.length, unchanged: false };
}

/**
 * Insert in batches. A 400-page standard produces ~950 chunks, and a round trip
 * per row turns that into a multi-minute import.
 */
async function insertChunks(client, docKey, chunks, vectors, offset) {
  const INSERT_BATCH = 40;
  for (let start = 0; start < chunks.length; start += INSERT_BATCH) {
    const slice = chunks.slice(start, start + INSERT_BATCH);
    const values = [];
    const params = [];
    slice.forEach((c, j) => {
      const i = start + j;
      const ordinal = offset + i;
      const b = j * 8;
      values.push(`($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5}::vector,$${b + 6},$${b + 7},$${b + 8})`);
      params.push(docKey + "#" + ordinal, docKey, c.heading, c.text,
        toVectorLiteral(vectors[i]), EMBEDDING_MODEL, EMBEDDING_DIM, ordinal);
    });
    await client.query(
      `INSERT INTO guideline_chunks
         (id, doc_id, heading, content, embedding, model, dim, ordinal)
       VALUES ${values.join(",")}
       ON CONFLICT (id) DO NOTHING`,
      params
    );
  }
}

/**
 * Remove a procedure the caller owns. Scoped by owner in the WHERE clause, so
 * one user cannot delete another's document even by guessing its id, and
 * org-published documents are not deletable through this path.
 */
export async function deleteDocument(client, userId, rawId) {
  const res = await client.query(
    "DELETE FROM guideline_docs WHERE id = $1 AND owner_user_id = $2 RETURNING id",
    [scopedId(userId, rawId), userId]
  );
  return res.rows.length > 0;
}

/** A user sees their own procedures, plus anything deliberately published org-wide. */
export async function listDocuments(client, userId) {
  const res = await client.query(
    `SELECT d.id, d.title, d.source, d.revision, d.effective_date, d.status,
            d.dimension, d.triggers, d.tags, d.origin, d.visibility, d.created_at,
            (d.owner_user_id = $1) AS mine,
            (SELECT COUNT(*)::int FROM guideline_chunks c WHERE c.doc_id = d.id) AS chunks
       FROM guideline_docs d
      WHERE d.owner_user_id = $1 OR d.visibility = 'org'
      ORDER BY d.status ASC, d.title ASC`,
    [userId]
  );
  return res.rows.map((r) => Object.assign({}, r, { id: publicId(r.id) }));
}

/**
 * Hybrid retrieval: Postgres full-text and pgvector cosine, fused with
 * Reciprocal Rank Fusion. Returns cited passages verbatim — never generated
 * text — and returns nothing when nothing is genuinely relevant.
 */
export async function searchGuidelines(client, env, opts) {
  const query = String(opts.query || "").trim();
  if (!query) return { matches: [], reason: "empty query" };

  const limit = Math.min(Number(opts.limit) || 5, 20);
  const dimension = DIMENSIONS.indexOf(opts.dimension) !== -1 ? opts.dimension : null;
  const vector = toVectorLiteral(await embedOne(env, query));

  const res = await client.query(
     `WITH scoped AS (
       SELECT c.id, c.doc_id, c.heading, c.content, c.embedding, c.search_vector,
              d.title, d.source, d.revision, d.dimension, d.triggers, d.origin,
              d.owner_user_id, d.visibility
         FROM guideline_chunks c
         JOIN guideline_docs d ON d.id = c.doc_id
        -- Retrieval never crosses an account boundary: a user's procedures are
        -- theirs alone unless explicitly published to the whole organization.
        WHERE (d.owner_user_id = $1 OR d.visibility = 'org')
          AND d.status = 'active'
          -- Uploaded PDFs commonly have no frontmatter/dimension. Keep them in
          -- a dimension-scoped search as fallback; otherwise the user's own
          -- procedures can never be cited by the Assistant.
          AND ($4::text IS NULL OR d.dimension = $4::text
               OR d.dimension IS NULL OR d.dimension = '')
     ),
     lex AS (
       SELECT id, ts_rank(search_vector, plainto_tsquery('english', $2)) AS score,
              ROW_NUMBER() OVER (ORDER BY ts_rank(search_vector, plainto_tsquery('english', $2)) DESC) AS rank
         FROM scoped
        WHERE search_vector @@ plainto_tsquery('english', $2)
        LIMIT 30
     ),
     vec AS (
       SELECT id, 1 - (embedding <=> $3::vector) AS score,
              ROW_NUMBER() OVER (ORDER BY embedding <=> $3::vector ASC) AS rank
         FROM scoped
        WHERE embedding IS NOT NULL
        ORDER BY embedding <=> $3::vector ASC
        LIMIT 30
     )
     SELECT s.id, s.doc_id, s.heading, s.content, s.title, s.source, s.revision,
            s.dimension, s.triggers, s.origin, s.owner_user_id, s.visibility,
            COALESCE(lex.score, 0) AS lexical_score,
            COALESCE(vec.score, 0) AS cosine,
            (CASE WHEN lex.rank IS NULL THEN 0 ELSE 1.0 / ($5 + lex.rank) END) +
            (CASE WHEN vec.rank IS NULL THEN 0 ELSE 1.0 / ($5 + vec.rank) END) AS rrf,
            (lex.id IS NOT NULL) AS lexical_hit
       FROM scoped s
       LEFT JOIN lex ON lex.id = s.id
       LEFT JOIN vec ON vec.id = s.id
      WHERE lex.id IS NOT NULL OR vec.id IS NOT NULL
      ORDER BY rrf DESC
      LIMIT $6`,
    [opts.userId, query, vector, dimension, RRF_K, limit * 3]
  );

  const needle = query.toLowerCase();
  const matches = res.rows
    .map((r) => ({
      // Strip the owner namespace: these ids travel into the model prompt and
      // onto the screen, and the internal user id has no business in either.
      chunkId: publicId(r.id),
      docId: publicId(r.doc_id),
      title: r.title,
      source: r.source,
      revision: r.revision,
      dimension: r.dimension,
      heading: r.heading,
      passage: r.content,
      origin: r.origin,
      userProcedure: r.visibility === "private" && r.owner_user_id === opts.userId,
      cosine: Number(Number(r.cosine).toFixed(4)),
      // Rank fusion decides order, but semantic closeness breaks ties that RRF
      // alone gets wrong: a chunk that merely contains the query words should
      // not outrank the clause the question is actually about.
      score: Number((Number(r.rrf) + 0.02 * Number(r.cosine)).toFixed(6)),
      // A curated trigger phrase is an explicit editorial binding and outranks
      // anything similarity found on its own.
      triggerHit: (r.triggers || []).some((t) => t && needle.indexOf(t) !== -1),
    }))
    .filter((m) => m.triggerHit || m.cosine >= MIN_COSINE)
    // Explicit trigger bindings remain strongest. Among semantically relevant
    // passages, prefer the user's private procedures to the shared baseline.
    .sort((a, b) => (b.triggerHit - a.triggerHit) ||
      (Number(b.userProcedure) - Number(a.userProcedure)) ||
      (b.score - a.score))
    .slice(0, limit);

  return {
    matches,
    reason: matches.length ? "" : "No active procedure covers this condition.",
  };
}
