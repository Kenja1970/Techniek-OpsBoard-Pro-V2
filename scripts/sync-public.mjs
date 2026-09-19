#!/usr/bin/env node
/**
 * Mirror the canonical web files from the repo ROOT into public/ so that
 * `wrangler dev`/`deploy` has a clean directory to serve.
 *
 * Why: the root is the single source of truth (tests/qa.html, the QA runner,
 * file:// mode, and GitHub Pages all reference the root files). But Wrangler
 * watches whatever directory it serves, and Miniflare constantly writes into
 * .wrangler/ — so serving the root causes an infinite reload loop. Serving a
 * dedicated public/ mirror (with .wrangler/ left outside it) avoids the loop,
 * and regenerating the mirror on every dev/deploy start avoids stale-copy drift.
 */
import { readdirSync, statSync, mkdirSync, copyFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "public");

// The only things that make up the deployable web app.
const WEB_FILES = ["index.html", "landing.html", "request-access.html", "app.js", "styles.css",
                   "llms.txt", "robots.txt", ".nojekyll"];
const WEB_DIRS = ["assets"];

function copyDir(src, dest) {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src)) {
    const s = join(src, entry);
    const d = join(dest, entry);
    if (statSync(s).isDirectory()) copyDir(s, d);
    else copyFileSync(s, d);
  }
}

// Overwrite in place rather than recreating the directory: `wrangler dev`
// holds a handle on the directory it serves, so removing it fails with EPERM
// on Windows while the dev server is running.
mkdirSync(out, { recursive: true });

let count = 0;
for (const f of WEB_FILES) {
  const s = join(root, f);
  if (existsSync(s)) { copyFileSync(s, join(out, f)); count++; }
}
for (const d of WEB_DIRS) {
  const s = join(root, d);
  if (existsSync(s)) { copyDir(s, join(out, d)); count++; }
}

console.log("sync-public: mirrored " + count + " web entries from root -> public/");
