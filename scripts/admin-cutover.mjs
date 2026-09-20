#!/usr/bin/env node
/**
 * One-time production identity cutover.
 *
 * Local development created the first administrator as
 * localdev@techniek.local. Production Cloudflare Access supplies a real email.
 * Updating that row (rather than creating a third user) preserves the existing
 * workspace membership, sample portfolio, private procedures, and audit history.
 *
 * Usage:
 *   node scripts/admin-cutover.mjs --check <production-email>
 *   node scripts/admin-cutover.mjs --apply <production-email> "<display name>"
 */
import { readFileSync } from "node:fs";
import { Client } from "pg";

function readDevVars() {
  return Object.fromEntries(
    readFileSync(".dev.vars", "utf8")
      .split(/\r?\n/)
      .map((line) => {
        const t = line.trim();
        if (!t || t.startsWith("#")) return null;
        const i = t.indexOf("=");
        return i === -1 ? null : [t.slice(0, i), t.slice(i + 1)];
      })
      .filter(Boolean),
  );
}

const mode = process.argv[2];
const email = String(process.argv[3] || "").trim().toLowerCase();
const displayName = String(process.argv[4] || "Gregory Brown").trim();

if (!["--check", "--apply"].includes(mode) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error('Usage: node scripts/admin-cutover.mjs --check|--apply <email> ["Display Name"]');
  process.exit(1);
}

const vars = readDevVars();
if (!vars.HYPERDRIVE_LOCAL_CONNECTION_STRING) {
  console.error("HYPERDRIVE_LOCAL_CONNECTION_STRING is not set in .dev.vars.");
  process.exit(1);
}

const client = new Client({
  connectionString: vars.HYPERDRIVE_LOCAL_CONNECTION_STRING,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 8000,
});

await client.connect();
try {
  const local = await client.query(
    `SELECT u.id, u.status, u.global_role,
            (SELECT COUNT(*)::int FROM workspace_members m WHERE m.user_id = u.id) AS workspaces,
            (SELECT COUNT(*)::int FROM guideline_docs d WHERE d.owner_user_id = u.id) AS private_docs
       FROM users u WHERE u.email = 'localdev@techniek.local'`,
  );
  const target = await client.query(
    "SELECT id, status, global_role FROM users WHERE email = $1",
    [email],
  );

  console.log(JSON.stringify({
    localdevExists: local.rows.length === 1,
    localdev: local.rows[0] || null,
    productionIdentityExists: target.rows.length === 1,
    productionIdentity: target.rows[0] || null,
  }, null, 2));

  if (mode === "--check") process.exit(0);
  if (!local.rows.length) throw new Error("The localdev administrator no longer exists; no cutover was applied.");
  if (target.rows.length && target.rows[0].id !== local.rows[0].id) {
    throw new Error("That production email already belongs to a different user; merge manually.");
  }

  await client.query("BEGIN");
  try {
    await client.query(
      `UPDATE users
          SET email = $1, display_name = $2, status = 'active', global_role = 'Admin'
        WHERE id = $3`,
      [email, displayName, local.rows[0].id],
    );
    await client.query(
      "UPDATE workspace_members SET role = 'Admin' WHERE user_id = $1",
      [local.rows[0].id],
    );
    await client.query(
      `INSERT INTO audit_logs (actor_id, action, entity, entity_id, detail)
       VALUES ($1, 'user.production_identity_cutover', 'user', $1, $2)`,
      [local.rows[0].id, JSON.stringify({ from: "localdev@techniek.local", to: email })],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }

  console.log("Applied: production identity is active Admin and retains the localdev workspace.");
} finally {
  await client.end();
}
