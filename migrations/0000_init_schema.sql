-- Supabase installs extensions in the 'extensions' schema
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;

-- Core App Schema
CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    display_name TEXT,
    status TEXT DEFAULT 'pending', -- pending, active, suspended
    global_role TEXT DEFAULT 'Viewer',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    org_id TEXT REFERENCES organizations(id),
    state JSONB NOT NULL,
    rev INTEGER DEFAULT 1,
    schema_version TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by TEXT REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS workspace_members (
    workspace_id TEXT REFERENCES workspaces(id),
    user_id TEXT REFERENCES users(id),
    role TEXT NOT NULL,
    PRIMARY KEY (workspace_id, user_id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    workspace_id TEXT,
    actor_id TEXT,
    action TEXT NOT NULL,
    entity TEXT,
    entity_id TEXT,
    detail JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- PM Assistant / Guidelines Schema (Stage B)
CREATE TABLE IF NOT EXISTS guideline_docs (
    id TEXT PRIMARY KEY,
    org_id TEXT REFERENCES organizations(id),
    title TEXT NOT NULL,
    source TEXT,
    revision TEXT,
    effective_date DATE,
    status TEXT DEFAULT 'active', -- draft, active, superseded
    superseded_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS guideline_chunks (
    id TEXT PRIMARY KEY,
    doc_id TEXT REFERENCES guideline_docs(id) ON DELETE CASCADE,
    heading TEXT,
    content TEXT NOT NULL,
    embedding extensions.vector(768),
    model TEXT NOT NULL,
    dim INTEGER NOT NULL,
    ordinal INTEGER NOT NULL,
    search_vector tsvector GENERATED ALWAYS AS (to_tsvector('english', heading || ' ' || content)) STORED
);

CREATE INDEX IF NOT EXISTS guideline_chunks_embedding_idx ON guideline_chunks USING hnsw (embedding extensions.vector_cosine_ops);
CREATE INDEX IF NOT EXISTS guideline_chunks_search_idx ON guideline_chunks USING gin(search_vector);
