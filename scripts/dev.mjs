#!/usr/bin/env node
/**
 * Start the local dev stack with everything wired.
 *
 * `wrangler dev` reads the Worker's own variables from .dev.vars, but the
 * Hyperdrive local connection string is read from the *process* environment
 * (CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_<BINDING>), not from .dev.vars.
 * Having to export that by hand every session is how the database silently ends
 * up disconnected and every request answers 503. This reads it from the same
 * gitignored file and passes it through.
 *
 * Add one line to .dev.vars:
 *   HYPERDRIVE_LOCAL_CONNECTION_STRING=postgresql://user:pass@host:5432/postgres
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const BINDING = "DB";
const PASSTHROUGH = "CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_" + BINDING;

function readDevVars() {
  const file = join(root, ".dev.vars");
  if (!existsSync(file)) return {};
  return Object.fromEntries(
    readFileSync(file, "utf8").split(/\r?\n/).map((line) => {
      const t = line.trim();
      if (!t || t.startsWith("#")) return null;
      const i = t.indexOf("=");
      return i === -1 ? null : [t.slice(0, i).trim(), t.slice(i + 1).trim()];
    }).filter(Boolean)
  );
}

const vars = readDevVars();
const env = { ...process.env };

// An explicit shell export still wins, so a one-off override keeps working.
if (!env[PASSTHROUGH]) {
  const conn = vars.HYPERDRIVE_LOCAL_CONNECTION_STRING || vars.DATABASE_URL;
  if (conn) {
    env[PASSTHROUGH] = conn;
    console.log("dev: database connection loaded from .dev.vars");
  } else {
    console.warn(
      "\ndev: WARNING — no database connection configured.\n" +
      "     The Worker will answer 503 on every API route and the PM Assistant\n" +
      "     will not be able to retrieve procedures.\n" +
      "     Add this line to .dev.vars:\n" +
      "       HYPERDRIVE_LOCAL_CONNECTION_STRING=postgresql://…@…pooler.supabase.com:5432/postgres\n"
    );
  }
}

if (!vars.LLM_API_KEY) {
  console.warn("dev: no LLM_API_KEY in .dev.vars — the Assistant will use its deterministic answer path.");
}

// Run Wrangler's JS entry point with this Node binary rather than going through
// the npx/.cmd shim: recent Node refuses to spawn a .cmd directly on Windows
// (EINVAL) unless a shell is used, and invoking the script avoids needing one.
const wranglerBin = join(root, "node_modules", "wrangler", "bin", "wrangler.js");
if (!existsSync(wranglerBin)) {
  console.error("dev: wrangler is not installed. Run `npm install` first.");
  process.exit(1);
}

const child = spawn(
  process.execPath,
  [wranglerBin, "dev", ...process.argv.slice(2)],
  { cwd: root, env, stdio: "inherit" }
);
child.on("exit", (code) => process.exit(code ?? 0));
