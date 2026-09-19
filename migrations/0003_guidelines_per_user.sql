-- Guidelines become private to the user who loaded them.
--
-- Until now a procedure was scoped to the organization, so every account shared
-- one corpus. Each user now owns their own set: what Peter uploads is Peter's,
-- and nobody else retrieves it. `visibility` keeps the door open for deliberate
-- org-wide publication later without another migration — the product's own
-- bundled corpus uses it so every account still gets the baseline procedures.

ALTER TABLE guideline_docs ADD COLUMN IF NOT EXISTS owner_user_id TEXT REFERENCES users(id);
ALTER TABLE guideline_docs ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'private';

CREATE INDEX IF NOT EXISTS guideline_docs_owner_idx ON guideline_docs(owner_user_id, status);
CREATE INDEX IF NOT EXISTS guideline_docs_visibility_idx ON guideline_docs(visibility, status);

-- Document ids were globally unique, so two users could not both hold a
-- procedure called "kanban-guide-official". Ids are now namespaced by owner
-- ("<user_id>:<doc-id>"). Rather than rewrite existing ids and their chunk
-- foreign keys in place, the corpus is cleared and re-ingested: every document
-- is reproducible from knowledge/*.md and the source PDFs, and re-embedding the
-- whole set costs a couple of minutes.
DELETE FROM guideline_docs;
