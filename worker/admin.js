// Account administration.
//
// Authorization is decided here, server-side, from the session identity. The
// top-bar role selector in the UI is a demo aid and is never consulted.

const ROLES = [
  "Admin",
  "Department Manager",
  "Project Manager",
  "Resource Manager",
  "Engineer / Contributor",
  "Viewer",
];
const STATUSES = ["pending", "active", "suspended"];

export function isAdmin(user) {
  return user && user.status === "active" && user.global_role === "Admin";
}

export async function listUsers(client) {
  const res = await client.query(
    `SELECT u.id, u.email, u.display_name, u.status, u.global_role,
            u.created_at, u.last_seen_at,
            (SELECT COUNT(*)::int FROM workspace_members m WHERE m.user_id = u.id) AS workspaces
       FROM users u
      ORDER BY
        CASE u.status WHEN 'pending' THEN 0 WHEN 'active' THEN 1 ELSE 2 END,
        u.created_at ASC`
  );
  return res.rows;
}

async function audit(client, actorId, action, targetId, detail) {
  await client.query(
    `INSERT INTO audit_logs (actor_id, action, entity, entity_id, detail)
     VALUES ($1, $2, 'user', $3, $4)`,
    [actorId, action, targetId, JSON.stringify(detail || {})]
  );
}

async function countOtherActiveAdmins(client, excludeUserId) {
  const res = await client.query(
    `SELECT COUNT(*)::int AS n FROM users
      WHERE global_role = 'Admin' AND status = 'active' AND id <> $1`,
    [excludeUserId]
  );
  return res.rows[0].n;
}

export async function setStatus(client, actor, targetId, status) {
  if (STATUSES.indexOf(status) === -1) {
    return { error: "Unknown status '" + status + "'.", code: 400 };
  }
  // An admin suspending themselves would lock them out of the console they
  // need to undo it.
  if (targetId === actor.id && status !== "active") {
    return { error: "You cannot suspend your own account.", code: 400 };
  }

  const found = await client.query(
    "SELECT id, email, status, global_role FROM users WHERE id = $1",
    [targetId]
  );
  if (!found.rows.length) return { error: "User not found.", code: 404 };
  const target = found.rows[0];

  if (target.global_role === "Admin" && status !== "active") {
    if ((await countOtherActiveAdmins(client, targetId)) === 0) {
      return { error: "This is the last active administrator. Promote someone else first.", code: 409 };
    }
  }

  const updated = await client.query(
    `UPDATE users SET status = $1 WHERE id = $2
     RETURNING id, email, display_name, status, global_role, created_at, last_seen_at`,
    [status, targetId]
  );
  await audit(client, actor.id, "user.status_changed", targetId, {
    email: target.email, from: target.status, to: status,
  });
  return { user: updated.rows[0] };
}

export async function setRole(client, actor, targetId, role) {
  if (ROLES.indexOf(role) === -1) {
    return { error: "Unknown role '" + role + "'.", code: 400 };
  }

  const found = await client.query(
    "SELECT id, email, status, global_role FROM users WHERE id = $1",
    [targetId]
  );
  if (!found.rows.length) return { error: "User not found.", code: 404 };
  const target = found.rows[0];

  // Demoting the only administrator leaves nobody who can approve accounts.
  if (target.global_role === "Admin" && role !== "Admin") {
    if ((await countOtherActiveAdmins(client, targetId)) === 0) {
      return { error: "This is the last active administrator. Promote someone else first.", code: 409 };
    }
  }

  const updated = await client.query(
    `UPDATE users SET global_role = $1 WHERE id = $2
     RETURNING id, email, display_name, status, global_role, created_at, last_seen_at`,
    [role, targetId]
  );
  // Workspace membership carries the role too, so permissions stay consistent
  // wherever the user is a member.
  await client.query("UPDATE workspace_members SET role = $1 WHERE user_id = $2", [role, targetId]);

  await audit(client, actor.id, "user.role_changed", targetId, {
    email: target.email, from: target.global_role, to: role,
  });
  return { user: updated.rows[0] };
}

function newId(prefix) {
  return prefix + "_" + crypto.randomUUID().replace(/-/g, "").slice(0, 16);
}

/**
 * Create an account directly, without waiting for the person to sign in.
 *
 * This does not grant access on its own: Cloudflare Access still decides who
 * may authenticate. It pre-authorizes them inside the application so they land
 * in a working workspace instead of a pending screen.
 */
export async function createUser(client, actor, input) {
  const email = String(input.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return { error: "Enter a valid email address.", code: 400 };
  }
  if (ROLES.indexOf(input.role) === -1) return { error: "Unknown role.", code: 400 };
  if (STATUSES.indexOf(input.status) === -1) return { error: "Unknown status.", code: 400 };

  const existing = await client.query("SELECT id FROM users WHERE email = $1", [email]);
  if (existing.rows.length) return { error: "An account already exists for that email.", code: 409 };

  const id = newId("u");
  const orgRow = await client.query("SELECT id FROM organizations ORDER BY created_at ASC LIMIT 1");
  const orgId = orgRow.rows.length ? orgRow.rows[0].id : null;

  const inserted = await client.query(
    `INSERT INTO users (id, email, display_name, status, global_role, org_id)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING id, email, display_name, status, global_role, created_at, last_seen_at`,
    [id, email, String(input.displayName || email.split("@")[0]).slice(0, 120), input.status, input.role, orgId]
  );
  await audit(client, actor.id, "user.created", id, { email, role: input.role, status: input.status });
  return { user: inserted.rows[0] };
}

/**
 * Delete an account and everything owned solely by it.
 *
 * Irreversible, so it is guarded the same way suspension is — you cannot delete
 * yourself or the last administrator — and it is explicit about what goes with
 * the account rather than relying on cascades nobody has read.
 */
export async function deleteUser(client, actor, targetId) {
  if (targetId === actor.id) return { error: "You cannot delete your own account.", code: 400 };

  const found = await client.query("SELECT id, email, global_role FROM users WHERE id = $1", [targetId]);
  if (!found.rows.length) return { error: "User not found.", code: 404 };
  const target = found.rows[0];

  if (target.global_role === "Admin" && (await countOtherActiveAdmins(client, targetId)) === 0) {
    return { error: "This is the last active administrator. Promote someone else first.", code: 409 };
  }

  await client.query("BEGIN");
  try {
    // Their private procedure library (chunks cascade from the document).
    await client.query("DELETE FROM guideline_docs WHERE owner_user_id = $1", [targetId]);
    // Workspaces nobody else is a member of go with them; shared ones survive.
    await client.query(
      `DELETE FROM workspaces w
        WHERE w.id IN (SELECT workspace_id FROM workspace_members WHERE user_id = $1)
          AND NOT EXISTS (
            SELECT 1 FROM workspace_members m WHERE m.workspace_id = w.id AND m.user_id <> $1
          )`,
      [targetId]
    );
    await client.query("DELETE FROM workspace_members WHERE user_id = $1", [targetId]);
    await client.query("UPDATE workspaces SET updated_by = NULL WHERE updated_by = $1", [targetId]);
    await client.query("DELETE FROM users WHERE id = $1", [targetId]);
    // The audit entry deliberately outlives the account.
    await audit(client, actor.id, "user.deleted", targetId, { email: target.email });
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    return { error: "Could not delete the account: " + (err && err.message), code: 500 };
  }
  return { deleted: targetId, email: target.email };
}

/** Every workspace in the instance, for administrator support access. */
export async function listWorkspaces(client) {
  const res = await client.query(
    `SELECT w.id, w.rev, w.schema_version, w.updated_at,
            (w.state IS NOT NULL) AS has_data,
            u.id AS owner_id, u.email AS owner_email, u.display_name AS owner_name, u.status AS owner_status,
            (SELECT COUNT(*)::int FROM projection_projects p WHERE p.workspace_id = w.id) AS projects,
            (SELECT COUNT(*)::int FROM projection_cards c WHERE c.workspace_id = w.id) AS cards
       FROM workspaces w
       LEFT JOIN workspace_members m ON m.workspace_id = w.id
       LEFT JOIN users u ON u.id = m.user_id
      ORDER BY w.updated_at DESC NULLS LAST`
  );
  return res.rows;
}

export async function listAccessRequests(client) {
  const res = await client.query(
    `SELECT id, email, name, company, reason, status, country, created_at, decided_at, decided_by
       FROM access_requests
      ORDER BY CASE status WHEN 'new' THEN 0 ELSE 1 END, created_at DESC
      LIMIT 200`
  );
  return res.rows;
}

/**
 * Deciding a request records the decision only. It deliberately does not create
 * a user or touch the Access policy: an invite is a separate, explicit act, so
 * a mis-click here cannot grant anybody access.
 */
export async function decideAccessRequest(client, actor, requestId, decision, notes) {
  if (["invited", "declined", "new"].indexOf(decision) === -1) {
    return { error: "Unknown decision '" + decision + "'.", code: 400 };
  }
  const found = await client.query("SELECT id, email, status FROM access_requests WHERE id = $1", [requestId]);
  if (!found.rows.length) return { error: "Request not found.", code: 404 };

  const updated = await client.query(
    `UPDATE access_requests
        SET status = $1, decided_by = $2, decided_at = NOW(), notes = COALESCE($3, notes)
      WHERE id = $4
      RETURNING id, email, name, company, reason, status, country, created_at, decided_at, decided_by`,
    [decision, actor.id, notes || null, requestId]
  );
  await audit(client, actor.id, "access_request." + decision, requestId, { email: found.rows[0].email });
  return { request: updated.rows[0] };
}

export async function recentAudit(client, limit) {
  const res = await client.query(
    `SELECT a.id, a.action, a.entity_id, a.detail, a.created_at,
            actor.email AS actor_email
       FROM audit_logs a
       LEFT JOIN users actor ON actor.id = a.actor_id
      ORDER BY a.created_at DESC
      LIMIT $1`,
    [Math.min(Number(limit) || 50, 200)]
  );
  return res.rows;
}

export { ROLES as ADMIN_ASSIGNABLE_ROLES };
