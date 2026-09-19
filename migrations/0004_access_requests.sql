-- Public account requests.
--
-- Written by an unauthenticated endpoint, so the table is deliberately inert:
-- no foreign keys into users, no role, no workspace. Creating a row grants
-- nothing. An administrator reviews it and invites separately, which is the
-- whole point of choosing this over letting strangers authenticate directly.

CREATE TABLE IF NOT EXISTS access_requests (
    id           TEXT PRIMARY KEY,
    email        TEXT NOT NULL,
    name         TEXT,
    company      TEXT,
    reason       TEXT,
    status       TEXT NOT NULL DEFAULT 'new',   -- new | invited | declined
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    decided_by   TEXT,
    decided_at   TIMESTAMPTZ,
    notes        TEXT,
    -- Coarse request context for abuse triage. No IP address is stored: it adds
    -- personal data to a public form without telling an admin anything they can
    -- act on that the country and user agent do not.
    country      TEXT,
    user_agent   TEXT
);

CREATE INDEX IF NOT EXISTS access_requests_status_idx ON access_requests(status, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS access_requests_open_email_idx
    ON access_requests(lower(email)) WHERE status = 'new';
