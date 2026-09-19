// Embeddings via Workers AI.
//
// bge-base-en-v1.5 emits 768 dimensions, which is what guideline_chunks.embedding
// is declared as. The model name and dimension are stored on every row so that
// changing models later is a tracked re-embedding job rather than silent drift
// between vectors that are no longer comparable.

export const EMBEDDING_MODEL = "@cf/baai/bge-base-en-v1.5";
export const EMBEDDING_DIM = 768;

// The model truncates beyond 512 tokens; keep inputs well inside that so a long
// clause is not silently clipped mid-sentence.
const MAX_CHARS = 1600;

export async function embedAll(env, texts) {
  if (!env.AI) throw new Error("Workers AI binding (AI) is not configured.");
  const inputs = texts.map((t) => String(t || "").slice(0, MAX_CHARS));
  if (!inputs.length) return [];

  const out = [];
  // Batch, but stay modest so one oversized request cannot fail the whole ingest.
  const BATCH = 25;
  for (let i = 0; i < inputs.length; i += BATCH) {
    const slice = inputs.slice(i, i + BATCH);
    const res = await env.AI.run(EMBEDDING_MODEL, { text: slice });
    const vectors = res && res.data ? res.data : [];
    if (vectors.length !== slice.length) {
      throw new Error("Embedding model returned " + vectors.length + " vectors for " + slice.length + " inputs.");
    }
    for (const v of vectors) {
      if (!Array.isArray(v) || v.length !== EMBEDDING_DIM) {
        throw new Error("Expected " + EMBEDDING_DIM + "-dimension embeddings, got " + (v && v.length));
      }
      out.push(v);
    }
  }
  return out;
}

export async function embedOne(env, text) {
  const [vector] = await embedAll(env, [text]);
  return vector;
}

/** pgvector accepts a bracketed literal cast with ::vector. */
export function toVectorLiteral(vector) {
  return "[" + vector.map((n) => Number(n).toFixed(6)).join(",") + "]";
}
