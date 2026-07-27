# Knowledge Base

A local PM corpus with ranked retrieval. **No API key, no network, works offline and from `file://`.**

## Why this rather than a hosted vector store

The application inherited an OpenAI vector-store integration. It required a cloud account, a running proxy, per-query cost, and it sent project context off the machine — in a tool whose premise is local-first. It has been replaced by a corpus that ships with the app.

**The external path was removed entirely in v5.2.0**, along with its proxy endpoints and the Procedure Library admin view. It was the weaker half of a duplicated capability: the local corpus answers the same questions offline, and it returns cited passages rather than generated text, so it cannot hallucinate. Keeping a second, costlier path that could would have been a downgrade dressed as an option.

## How it works

```
knowledge/*.md  ──(scripts/build-knowledge.mjs)──>  assets/knowledge-corpus.js  ──<script>──>  browser
                                                    +  user uploads (workspace)
```

**Why a compiled bundle and not runtime `fetch()`:** browsers block `fetch()` on `file://`, and running from `file://` is a hard requirement. A `<script>` tag is not blocked. The markdown remains the source of truth and stays diffable in git; CI fails the build if the bundle is stale.

**Retrieval** is BM25 — IDF-weighted term frequency with length normalization — over one passage per `##` section, with a boost when the query names a heading or title. Results are **cited passages, never generated text**, so the answer cannot be fabricated. A query that matches nothing returns nothing rather than a confident wrong answer.

## Document format

Frontmatter between `---` fences, then Markdown:

```markdown
---
id: kanban-wip-limits
title: WIP limits and the pull system
source: Kanban practice (Anderson; Lean flow)
dimension: Flow
triggers: wip limit breached, wip, over limit, pull system, stop starting
tags: kanban, flow, wip, pull
---

## Why the limit exists

...
```

| Field | Purpose |
|---|---|
| `id` | Unique, kebab-case. Citation anchor. |
| `title` | Citation heading. |
| `source` | Attribution line, e.g. `Techniek PMO procedure QA-014 Rev B`. |
| `dimension` | One of `Cost`, `Schedule`, `Margin`, `Flow`, `Risk`, `Resource`, `Governance`. Binds the document to PM Advisor findings of that dimension. |
| `triggers` | Comma-separated phrases. When an Advisor finding's title or evidence contains one, this document is offered as that finding's playbook. |
| `tags` | Free-form; contributes to search weighting. |

`##` headings split the document into retrievable sections, so a citation can point at the relevant section rather than the whole file.

## What makes it actionable

`triggers` and `dimension` are the reason this is not a chatbot. Each PM Advisor finding is **bound** to the playbook that answers it, and the guidance renders inline with the finding — attached to your live data, not waiting to be searched for.

Trigger phrases win; `dimension` is the fallback. Within the matching pool, the document whose section text best matches the finding text is chosen.

That means **guidance quality is a function of how well your triggers name real conditions.** Prefer concrete thresholds ("beyond two weeks", "more than ten points below target") over adjectives.

## Adding your own procedures

### Route 1 — version-controlled (durable procedures)

1. Copy `knowledge/_TEMPLATE-your-procedure.md` to `knowledge/<your-id>.md`.
2. Fill in the frontmatter and write the body.
3. Rebuild and commit both files:

```bash
node scripts/build-knowledge.mjs
```

### Route 2 — upload at runtime (drafts, one-offs)

**PM Advisor → Procedure Q&A → Add procedure files** accepts `.md` directly. Parsed in the browser, stored with the workspace, searched alongside the built-in corpus. Frontmatter is optional — without it the filename becomes the title. Nothing is uploaded to any server.

Uploads are per-profile and travel with the workspace JSON export.

## Built-in corpus

| Document | Dimension |
|---|---|
| WIP limits and the pull system | Flow |
| Work item aging, cycle time, and bottlenecks | Flow |
| Cost performance — CPI, EAC, and variance response | Cost |
| Schedule performance — SPI, critical path, and recovery | Schedule |
| A/E earned multiplier and contribution margin | Margin |
| Risk register discipline and response strategies | Risk |
| Integrated change control and the CCB | Governance |
| Resource loading, over-allocation, and capacity | Resource |

The content is **original prose describing widely-published practice**, citing the standards it draws on (PMI/PMBOK, Kanban/Lean flow, A/E financial convention). It does not reproduce copyrighted text from those sources. Treat it as a starting point and supersede it with your own controlled procedures where they exist.

## Writing guidance worth citing

- Lead with the decision, not the background — the reader is mid-problem.
- Say what to do **and** what not to do. The anti-pattern is usually the more useful half.
- Name concrete conditions and thresholds, so findings can bind to them.
- One topic per document. Retrieval ranks documents; a document covering five topics ranks poorly for all five.

## API

```js
TechniekOpsBoard._qa.kbDocuments()              // built-in + user documents
TechniekOpsBoard._qa.kbSearch(query, limit)     // [{ passage, score }] ranked
TechniekOpsBoard._qa.kbPlaybookForFinding(f)    // { doc, passage } | null
TechniekOpsBoard._qa.kbParseMarkdown(md, name)  // parse without storing
```
