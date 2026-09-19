-- v6.0.0 — user provisioning + queryable projections of the workspace JSONB.
--
-- The workspace JSONB in workspaces.state is the system of record. These
-- projection tables are derived from it on every save so the database can be
-- queried relationally (portfolio rollups, admin views) and so the Stage B PM
-- Assistant can filter guidance by real project attributes without parsing JSON.

ALTER TABLE users ADD COLUMN IF NOT EXISTS org_id TEXT REFERENCES organizations(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

-- Every workspace belongs to exactly one org; membership carries the PM role
-- (Admin, Department Manager, Project Manager, Resource Manager, Engineer /
-- Contributor, Viewer) so sharing a workspace later is an INSERT, not a migration.
CREATE INDEX IF NOT EXISTS workspace_members_user_idx ON workspace_members(user_id);

CREATE TABLE IF NOT EXISTS projection_projects (
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    project_id   TEXT NOT NULL,
    name         TEXT,
    client       TEXT,
    status       TEXT,
    budget       NUMERIC,
    start_date   DATE,
    end_date     DATE,
    PRIMARY KEY (workspace_id, project_id)
);

CREATE TABLE IF NOT EXISTS projection_cards (
    workspace_id   TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    card_id        TEXT NOT NULL,
    project_id     TEXT,
    board_id       TEXT,
    column_id      TEXT,
    title          TEXT,
    outline_number TEXT,
    estimate_hours NUMERIC,
    logged_hours   NUMERIC,
    progress       NUMERIC,
    due            DATE,
    assignee_id    TEXT,
    PRIMARY KEY (workspace_id, card_id)
);

CREATE INDEX IF NOT EXISTS projection_cards_project_idx ON projection_cards(workspace_id, project_id);
