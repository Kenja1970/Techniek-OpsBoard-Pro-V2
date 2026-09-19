#!/usr/bin/env node
/**
 * Import a PDF standard or procedure into the guideline store.
 *
 * A PDF has no `##` headings to chunk on, so this splits on paragraph
 * boundaries into passages of roughly one screen of text, and anchors every
 * passage to its page and nearest section heading. That anchor travels into the
 * citation, so a finding can say "PMBOK Guide, 2.6 Tailoring — p. 143" rather
 * than pointing vaguely at a 400-page book.
 *
 * Usage:
 *   node scripts/ingest-pdf.mjs <file.pdf> --id kanban-guide --title "The Official Kanban Guide" \
 *        --source "Kanban University" --revision "2024" --dimension Flow [--base http://127.0.0.1:8788] [--dry]
 */
import { readFileSync } from "node:fs";
import { basename } from "node:path";

const argv = process.argv.slice(2);
const file = argv.find((a) => !a.startsWith("--"));
function opt(name, fallback) {
  const i = argv.indexOf("--" + name);
  return i !== -1 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : fallback;
}
const dryRun = argv.includes("--dry");

if (!file) {
  console.error("Usage: node scripts/ingest-pdf.mjs <file.pdf> --id <id> --title <title> [...]");
  process.exit(1);
}

const base = (opt("base", "http://127.0.0.1:8788")).replace(/\/+$/, "");
const docId = opt("id", basename(file).replace(/\.pdf$/i, "").toLowerCase().replace(/[^a-z0-9]+/g, "-"));
const title = opt("title", basename(file, ".pdf"));
const source = opt("source", title);
const revision = opt("revision", "—");
const dimension = opt("dimension", null);

// Target passage size. Large enough to carry a complete idea, small enough that
// a citation points at something a reader can check quickly. The embedding
// model truncates past ~512 tokens, so staying under ~1400 characters keeps the
// stored text and the embedded text describing the same thing.
const TARGET_CHARS = 1200;
const MIN_CHARS = 220;

/**
 * PDF text extraction emits NUL and other C0 control characters — embedded
 * fonts and ligature tables leak them. Postgres rejects 0x00 outright in a text
 * column ("invalid byte sequence for encoding UTF8"), so strip them at source
 * rather than discovering it 951 passages later.
 */
function clean(s) {
  return String(s || "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[\uD800-\uDFFF\uFFFE\uFFFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
const data = new Uint8Array(readFileSync(file));
const pdf = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;

/**
 * Rebuild lines from positioned glyph runs.
 *
 * Spacing is decided by geometry, not by the item text. pdfjs splits kerned
 * words into separate items ("G", "uide"), so appending a space after every
 * item shreds words — "A Guide to the Project Management Body of Knowledge"
 * came out as "A G uide to the Project M anagement B ody of K nowledge". A gap
 * only counts as a space when the next run actually starts further right than
 * the previous one ended.
 */
async function getLines(pageNum) {
  const content = await (await pdf.getPage(pageNum)).getTextContent();
  const lines = [];
  let buf = "";
  let maxSize = 0;
  let lastY = null;
  let lastEndX = null;

  const push = () => {
    const text = clean(buf);
    if (text) lines.push({ text, maxSize });
    buf = "";
    maxSize = 0;
    lastEndX = null;
  };

  for (const item of content.items) {
    if (!item.str) continue;
    const y = Math.round(item.transform[5]);
    const x = item.transform[4];
    const size = Math.abs(item.transform[0]) || 10;

    if (lastY !== null && Math.abs(y - lastY) > 2) push();

    if (lastEndX !== null && x - lastEndX > size * 0.22 && !/\s$/.test(buf)) buf += " ";
    buf += item.str;

    maxSize = Math.max(maxSize, size);
    lastEndX = x + (item.width || 0);
    lastY = y;
  }
  push();
  return lines;
}

/**
 * Headings are identified by font size, not by text pattern.
 *
 * Pattern matching fails on real standards: the Kanban Guide's headings are
 * Title Case ("What is Kanban?"), PMBOK's are numbered, and an ALL-CAPS rule
 * happily promotes the publisher's street address.
 */
function isHeadingLine(line, bodySize, repeated) {
  if (line.maxSize < bodySize * 1.15) return false;
  const t = line.text;
  if (t.length < 3 || t.length > 90) return false;
  if (repeated.has(t)) return false;                       // running header/footer
  if (/\s\d{1,3}$/.test(t)) return false;                  // contents row: "Origins 4"
  if (/\b\d{5}(-\d{4})?\b/.test(t)) return false;          // zip code / address block
  if (/^copyright|^all rights reserved/i.test(t)) return false;
  return true;
}

// Contents pages and indexes are dense with "Heading 12 Heading 13" runs.
// They retrieve badly and cite worse.
function looksLikeContents(text) {
  const numberRuns = (text.match(/\s\d{1,3}(?=\s|$)/g) || []).length;
  const words = (text.match(/\S+/g) || []).length || 1;
  return numberRuns / words > 0.10;
}

// --- Pass 1: learn the document's shape -----------------------------------
// Body font size, and which lines repeat on page after page. A running footer
// like "A Guide to the Project Management Body of Knowledge" is set larger than
// body text, so without this it wins the heading slot on every single page.
const sizeWeight = new Map();
const lineCounts = new Map();
const pageLines = [];

for (let p = 1; p <= pdf.numPages; p++) {
  const lines = await getLines(p);
  pageLines.push(lines);
  const seen = new Set();
  for (const line of lines) {
    const size = Math.round(line.maxSize * 2) / 2;
    sizeWeight.set(size, (sizeWeight.get(size) || 0) + line.text.length);
    if (!seen.has(line.text)) { seen.add(line.text); lineCounts.set(line.text, (lineCounts.get(line.text) || 0) + 1); }
  }
  if (p % 50 === 0) console.log("  scanned page " + p);
}

let bodySize = 10, best = 0;
for (const [size, weight] of sizeWeight) if (weight > best) { best = weight; bodySize = size; }

const repeatThreshold = Math.max(3, Math.ceil(pdf.numPages * 0.15));
const repeated = new Set();
for (const [text, count] of lineCounts) if (count >= repeatThreshold) repeated.add(text);

console.log(title + ": " + pdf.numPages + " pages (body ≈ " + bodySize + "pt, " +
  repeated.size + " running header/footer lines ignored)");

// --- Pass 2: build page-anchored passages ---------------------------------
const chunks = [];
let currentHeading = "";
let skipped = 0;

for (let p = 1; p <= pdf.numPages; p++) {
  let passage = "";

  const flush = () => {
    const text = clean(passage);
    passage = "";
    if (!text) return;
    if (looksLikeContents(text)) { skipped++; return; }
    if (text.length >= MIN_CHARS) {
      chunks.push({ heading: clean((currentHeading ? currentHeading + " — " : "") + "p. " + p), content: text });
    } else if (chunks.length) {
      chunks[chunks.length - 1].content += " " + text;   // too small to cite alone
    }
  };

  for (const line of pageLines[p - 1]) {
    if (/^\s*\d+\s*$/.test(line.text)) continue;   // bare page numbers
    if (repeated.has(line.text)) continue;         // running headers and footers
    if (isHeadingLine(line, bodySize, repeated)) {
      flush();
      currentHeading = line.text;
      continue;
    }
    passage += " " + line.text;
    if (passage.length >= TARGET_CHARS) flush();
  }
  flush();
}

console.log("extracted " + chunks.length + " passages (" + skipped + " contents/index blocks skipped)");

if (dryRun) {
  console.log("\n--- sample passages ---");
  [0, Math.floor(chunks.length / 2), chunks.length - 1].forEach((i) => {
    const c = chunks[i];
    if (c) console.log("[" + c.heading + "]\n  " + c.content.slice(0, 200) + "…\n");
  });
  console.log("Dry run: nothing sent.");
  process.exit(0);
}

// Upload in parts: each request embeds and stores its own slice, so a network
// hiccup costs one part instead of a 400-page import.
const PART = Number(opt("part-size", "120"));
let sent = 0;

for (let start = 0; start < chunks.length; start += PART) {
  const slice = chunks.slice(start, start + PART);
  const payload = start === 0
    ? { id: docId, title, source, revision, dimension, origin: "upload", chunks: slice }
    : { id: docId, append: true, chunks: slice };

  const res = await fetch(base + "/api/guidelines", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let out;
  try { out = JSON.parse(text); } catch { console.error("Non-JSON response: " + text.slice(0, 300)); process.exit(1); }
  if (!res.ok) {
    console.error("Part starting at " + start + " failed: " + (out.detail || out.error));
    console.error("Re-run to resume; already-stored chunks are kept.");
    process.exit(1);
  }
  sent += slice.length;
  console.log("  stored " + sent + "/" + chunks.length);
}

console.log("published " + docId + " -> " + sent + " chunks");
