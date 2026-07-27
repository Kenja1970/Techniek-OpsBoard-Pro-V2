---
id: my-procedure-id
title: Your procedure title
source: Techniek PMO procedure
dimension: Governance
triggers: keyword one, keyword two, phrase that appears in an advisor finding
tags: procedure, internal
---

## How to add your own procedures

Two routes — both keep the corpus searchable and citable inside the app.

### Route 1 — version-controlled (recommended for durable procedures)

1. Copy this file to `knowledge/<your-id>.md`.
2. Fill in the frontmatter (the block between the `---` fences):
   - `id` — unique, kebab-case. Used as the citation anchor.
   - `title` — shown as the citation heading.
   - `source` — attribution line, e.g. "Techniek PMO procedure QA-014 Rev B".
   - `dimension` — one of `Cost`, `Schedule`, `Margin`, `Flow`, `Risk`,
     `Resource`, `Governance`. Binds the document to PM Advisor findings of the
     same dimension.
   - `triggers` — comma-separated phrases. When an Advisor finding title
     contains one, this document is offered as the playbook for that finding.
     This is what makes guidance *actionable* rather than something you have to
     go searching for.
   - `tags` — free-form, used for search weighting.
3. Write the body in plain Markdown. Headings become section anchors, so a
   citation can point at the relevant section rather than the whole file.
4. Rebuild the bundle so the app can read it offline:

```bash
node scripts/build-knowledge.mjs
```

That regenerates `assets/knowledge-corpus.js`. Commit both the `.md` and the
regenerated bundle.

### Route 2 — upload at runtime (good for drafts and one-offs)

**PM Advisor → Procedure Q&A → Add procedure files** accepts `.md` files
directly. They are parsed in the browser, stored with the workspace, and
searched alongside the built-in corpus. Nothing is uploaded to any server.
Frontmatter is optional; without it the filename becomes the title.

## Writing guidance that is worth citing

- Lead with the decision, not the background. The reader is mid-problem.
- Say what to do **and** what not to do. The anti-pattern is usually the more
  useful half.
- Prefer concrete thresholds ("beyond two weeks", "more than ten points below
  target") over adjectives. The Advisor can only bind guidance to data when the
  guidance names the condition.
- Keep each document to one topic. Retrieval ranks documents; a document
  covering five topics ranks poorly for all five.
