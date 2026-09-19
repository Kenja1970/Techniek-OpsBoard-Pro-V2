-- Stage B — corporate PM standards corpus.
--
-- `dimension` and `triggers` mirror the frontmatter the bundled knowledge base
-- already uses (see docs/KNOWLEDGE-BASE.md). They are what binds a live PM
-- Advisor finding to the clause that governs it: an exact trigger phrase wins
-- outright, dimension narrows the pool, and semantic similarity handles the
-- controlled procedures that were never written with trigger phrases at all.

ALTER TABLE guideline_docs ADD COLUMN IF NOT EXISTS dimension    TEXT;
ALTER TABLE guideline_docs ADD COLUMN IF NOT EXISTS triggers     TEXT[] DEFAULT '{}';
ALTER TABLE guideline_docs ADD COLUMN IF NOT EXISTS tags         TEXT[] DEFAULT '{}';
ALTER TABLE guideline_docs ADD COLUMN IF NOT EXISTS uploaded_by  TEXT;
ALTER TABLE guideline_docs ADD COLUMN IF NOT EXISTS content_hash TEXT;
-- 'builtin' rows come from knowledge/*.md so server mode ranks one pool rather
-- than two competing ones; 'upload' rows are the organization's own procedures.
ALTER TABLE guideline_docs ADD COLUMN IF NOT EXISTS origin       TEXT DEFAULT 'upload';

CREATE INDEX IF NOT EXISTS guideline_docs_org_status_idx ON guideline_docs(org_id, status);

-- The original generated column concatenated without coalesce, so any chunk
-- with no heading produced NULL and was invisible to lexical search.
ALTER TABLE guideline_chunks DROP COLUMN IF EXISTS search_vector;
ALTER TABLE guideline_chunks ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(heading, '') || ' ' || coalesce(content, ''))
  ) STORED;

CREATE INDEX IF NOT EXISTS guideline_chunks_search_idx ON guideline_chunks USING gin(search_vector);
CREATE INDEX IF NOT EXISTS guideline_chunks_doc_idx ON guideline_chunks(doc_id);
