#!/usr/bin/env node
/**
 * Publish the bundled knowledge/*.md corpus into the server-side guideline
 * store via the running Worker, so server mode ranks ONE pool of procedures
 * instead of two competing ones (see docs/KNOWLEDGE-BASE.md on why a duplicated
 * capability is worse than a single one).
 *
 * Usage:
 *   node scripts/seed-guidelines.mjs [http://127.0.0.1:8788]
 *
 * Embeddings are produced by Workers AI inside the Worker; nothing here needs a
 * key. Re-running is safe: unchanged documents are skipped by content hash.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const base = (process.argv[2] || "http://127.0.0.1:8788").replace(/\/+$/, "");
const dir = join(root, "knowledge");

const files = readdirSync(dir).filter((f) => f.endsWith(".md") && !basename(f).startsWith("_")).sort();
if (!files.length) {
  console.error("No procedures found in knowledge/");
  process.exit(1);
}

let published = 0, unchanged = 0, failed = 0;

for (const file of files) {
  const markdown = readFileSync(join(dir, file), "utf8");
  const id = basename(file, ".md");
  try {
    const res = await fetch(base + "/api/guidelines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // The bundled corpus is product content, identical for everyone and
      // already shipped in assets/knowledge-corpus.js, so it is published
      // org-wide. Anything a user uploads stays private to that user.
      body: JSON.stringify({ id, markdown, origin: "builtin", visibility: "org" }),
    });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { throw new Error("Non-JSON response: " + text.slice(0, 160)); }
    if (!res.ok) throw new Error(data.detail || data.error || "HTTP " + res.status);

    if (data.document.unchanged) { unchanged++; console.log("  = " + id + " (unchanged)"); }
    else { published++; console.log("  + " + id + " -> " + data.document.chunks + " sections"); }
  } catch (err) {
    failed++;
    console.error("  ! " + id + ": " + err.message);
  }
}

console.log("\nseed-guidelines: " + published + " published, " + unchanged + " unchanged, " + failed + " failed");
process.exit(failed ? 1 : 0);
