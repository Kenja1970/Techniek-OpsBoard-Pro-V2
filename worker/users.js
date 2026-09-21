// User provisioning and the admin-approval gate.
//
// Cloudflare Access decides who may reach the app at all. This module decides
// what an authenticated person may do once inside: `status` gates access to a
// workspace, `role` drives the same permission gates the UI already enforces
// (see docs/ROLES-AND-PERMISSIONS.md).

const DEFAULT_ORG_ID = "org_techniek";
const DEFAULT_ORG_NAME = "Techniek Engineering";
const DEFAULT_ROLE = "Department Manager";

function newId(prefix) {
  return prefix + "_" + crypto.randomUUID().replace(/-/g, "").slice(0, 16);
}

async function ensureOrg(client) {
  await client.query(
    "INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING",
    [DEFAULT_ORG_ID, DEFAULT_ORG_NAME]
  );
  return DEFAULT_ORG_ID;
}

/**
 * Resolve the signed-in identity to a row in `users`, creating it on first
 * sign-in. The very first account bootstraps as an active Admin — otherwise
 * there would be nobody able to approve anyone. Everyone after that lands in
 * `pending` and waits for an admin.
 */
export async function resolveUser(client, identity) {
  const email = String(identity.email || "").toLowerCase();
  if (!email) throw new Error("Authenticated identity carried no email claim.");

  const orgId = await ensureOrg(client);

  const found = await client.query(
    "SELECT id, email, display_name, status, global_role, org_id FROM users WHERE email = $1",
    [email]
  );
  if (found.rows.length) {
    const user = found.rows[0];
    // Accounts created before organizations existed carry a null org.
    if (!user.org_id) {
      await client.query("UPDATE users SET org_id = $1 WHERE id = $2", [orgId, user.id]);
      user.org_id = orgId;
    }
    await client.query("UPDATE users SET last_seen_at = NOW() WHERE id = $1", [user.id]);
    return user;
  }

  // First account in an empty instance becomes the administrator.
  const existing = await client.query("SELECT COUNT(*)::int AS n FROM users");
  const isFirst = existing.rows[0].n === 0;

  const id = newId("u");
  const inserted = await client.query(
    `INSERT INTO users (id, email, display_name, status, global_role, org_id, last_seen_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     RETURNING id, email, display_name, status, global_role, org_id`,
    [id, email, email.split("@")[0], isFirst ? "active" : "pending", isFirst ? "Admin" : DEFAULT_ROLE, orgId]
  );

  await client.query(
    `INSERT INTO audit_logs (actor_id, action, entity, entity_id, detail)
     VALUES ($1, $2, $3, $4, $5)`,
    [id, isFirst ? "user.bootstrap_admin" : "user.registered", "user", id, JSON.stringify({ email })]
  );

  return inserted.rows[0];
}

/**
 * The workspace a user works in. One per user today; the membership table means
 * sharing one with a colleague later is an INSERT rather than a schema change.
 */
export async function resolveWorkspaceId(client, user, schemaVersion) {
  const member = await client.query(
    `SELECT w.id FROM workspaces w
      JOIN workspace_members m ON m.workspace_id = w.id
     WHERE m.user_id = $1 AND w.org_id = $2
     ORDER BY w.updated_at ASC
     LIMIT 1`,
    [user.id, DEFAULT_ORG_ID]
  );
  if (member.rows.length) return member.rows[0].id;

  const workspaceId = newId("ws");
  await client.query(
    `INSERT INTO workspaces (id, org_id, state, rev, schema_version, updated_by)
     VALUES ($1, $2, $3::jsonb, 0, $4, $5)`,
    [workspaceId, DEFAULT_ORG_ID, "{}", schemaVersion || "6.0.0", user.id]
  );
  await client.query(
    "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, $3)",
    [workspaceId, user.id, user.global_role || DEFAULT_ROLE]
  );
  return workspaceId;
}

export function isActive(user) {
  return user && user.status === "active";
}
