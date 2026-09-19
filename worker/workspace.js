// Workspace persistence.
//
// The whole workspace object is stored as JSONB and `migrate()` in app.js
// remains the single schema-upgrade path, exactly as it is for localStorage.
// Concurrency is optimistic: a client sends the rev it last saw, and a stale
// write is rejected with 409 plus the current server copy so the user can
// choose rather than lose work.

const MAX_PROJECTION_ROWS = 5000;

// Dates in the workspace are "" when unset; Postgres DATE rejects that.
function dateOrNull(v) {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}
function numOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function readWorkspace(client, workspaceId) {
  const res = await client.query(
    "SELECT id, rev, schema_version, state, updated_at FROM workspaces WHERE id = $1",
    [workspaceId]
  );
  if (!res.rows.length) return null;
  const row = res.rows[0];
  return {
    id: row.id,
    rev: row.rev,
    schemaVersion: row.schema_version,
    state: row.state,
    updatedAt: row.updated_at,
  };
}

/**
 * Write a new revision. Returns { ok:true, rev } on success, or
 * { ok:false, conflict:true, current } when the caller's rev is stale.
 */
export async function writeWorkspace(client, workspaceId, userId, incomingState, expectedRev) {
  const current = await client.query(
    "SELECT rev, state FROM workspaces WHERE id = $1 FOR UPDATE",
    [workspaceId]
  );
  if (!current.rows.length) return { ok: false, notFound: true };

  const serverRev = current.rows[0].rev;
  const serverHasData = current.rows[0].state !== null;

  // A first write against an empty workspace always wins: the client is
  // seeding the server from whatever it already had locally.
  if (serverHasData && Number(expectedRev) !== Number(serverRev)) {
    return {
      ok: false,
      conflict: true,
      current: { rev: serverRev, state: current.rows[0].state },
    };
  }

  const nextRev = serverRev + 1;
  await client.query(
    `UPDATE workspaces
        SET state = $1::jsonb, rev = $2, schema_version = $3, updated_at = NOW(), updated_by = $4
      WHERE id = $5`,
    [JSON.stringify(incomingState), nextRev, String(incomingState.version || "6.0.0"), userId, workspaceId]
  );

  await refreshProjections(client, workspaceId, incomingState);

  return { ok: true, rev: nextRev };
}

/**
 * Rebuild the relational view of the workspace. Derived data only — the JSONB
 * stays authoritative, so a rebuild is always safe.
 */
async function refreshProjections(client, workspaceId, state) {
  const projects = Array.isArray(state.projects) ? state.projects.slice(0, MAX_PROJECTION_ROWS) : [];
  const cards = Array.isArray(state.cards) ? state.cards.slice(0, MAX_PROJECTION_ROWS) : [];

  await client.query("DELETE FROM projection_projects WHERE workspace_id = $1", [workspaceId]);
  await client.query("DELETE FROM projection_cards WHERE workspace_id = $1", [workspaceId]);

  if (projects.length) {
    const values = [];
    const params = [];
    projects.forEach((p, i) => {
      const b = i * 8;
      values.push(`($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},$${b + 8})`);
      params.push(
        workspaceId, String(p.id), p.name || null, p.client || null,
        p.status || null, numOrNull(p.budget), dateOrNull(p.startDate), dateOrNull(p.endDate)
      );
    });
    await client.query(
      `INSERT INTO projection_projects
         (workspace_id, project_id, name, client, status, budget, start_date, end_date)
       VALUES ${values.join(",")}`,
      params
    );
  }

  if (cards.length) {
    const values = [];
    const params = [];
    cards.forEach((c, i) => {
      const b = i * 12;
      values.push(
        `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},$${b + 8},$${b + 9},$${b + 10},$${b + 11},$${b + 12})`
      );
      params.push(
        workspaceId, String(c.id), c.projectId || null, c.boardId || null,
        c.columnId || null, c.title || null, c.outlineNumber || null,
        numOrNull(c.estimateHours), numOrNull(c.loggedHours), numOrNull(c.progress),
        dateOrNull(c.due), c.assigneeId || null
      );
    });
    await client.query(
      `INSERT INTO projection_cards
         (workspace_id, card_id, project_id, board_id, column_id, title,
          outline_number, estimate_hours, logged_hours, progress, due, assignee_id)
       VALUES ${values.join(",")}`,
      params
    );
  }
}
