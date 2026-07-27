#!/usr/bin/env node
/**
 * Compile knowledge/*.md into assets/knowledge-corpus.js
 *
 * Why a bundle instead of fetching the markdown at runtime: the app is required
 * to run from file://, where fetch() is blocked by the browser's origin rules.
 * A plain <script> tag is not, so the corpus ships as a JS assignment. The
 * markdown files stay the source of truth and remain diffable in git.
 *
 * Usage:  node scripts/build-knowledge.mjs
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(root, "knowledge");
const outFile = join(root, "assets", "knowledge-corpus.js");

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

// Split on H2 so a citation can point at a section, not a whole file.
function sections(body) {
  const out = [];
  const parts = body.split(/\n(?=##\s+)/);
  for (const part of parts) {
    const h = /^##\s+(.+)$/m.exec(part);
    const heading = h ? h[1].trim() : "";
    const text = part.replace(/^##\s+.+$/m, "").trim();
    if (text) out.push({ heading, text });
  }
  return out.length ? out : [{ heading: "", text: body.trim() }];
}

if (!existsSync(srcDir)) {
  console.error("No knowledge/ directory found at " + srcDir);
  process.exit(1);
}

const docs = [];
for (const file of readdirSync(srcDir).filter((f) => f.endsWith(".md")).sort()) {
  if (basename(file).startsWith("_")) continue; // _TEMPLATE etc.
  const raw = readFileSync(join(srcDir, file), "utf8");
  const { meta, body } = parseFrontmatter(raw);
  docs.push({
    id: meta.id || basename(file, ".md"),
    title: meta.title || basename(file, ".md"),
    source: meta.source || "Techniek knowledge base",
    dimension: meta.dimension || "",
    triggers: (meta.triggers || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
    tags: (meta.tags || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
    file: "knowledge/" + file,
    sections: sections(body),
  });
}

mkdirSync(join(root, "assets"), { recursive: true });
const banner =
  "/* GENERATED FILE - do not edit.\n" +
  "   Source: knowledge/*.md   Rebuild: node scripts/build-knowledge.mjs\n" +
  "   Bundled as JS because the app must run from file://, where fetch() is blocked. */\n";
writeFileSync(outFile, banner + "window.TECHNIEK_KNOWLEDGE = " + JSON.stringify(docs, null, 1) + ";\n", "utf8");

const sectionCount = docs.reduce((a, d) => a + d.sections.length, 0);
console.log("knowledge corpus: " + docs.length + " documents, " + sectionCount + " sections -> assets/knowledge-corpus.js");
for (const d of docs) console.log("  " + d.id.padEnd(32) + d.dimension.padEnd(12) + d.sections.length + " sections");
