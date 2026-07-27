# Changelog

All notable changes to Techniek OpsBoard Pro V2.
This project follows [Semantic Versioning](https://semver.org/).

---

## [5.2.0] — 2026-07-27

Removes the inherited OpenAI vector-store RAG. **The procedures themselves stay** — they were never in the vector store. They live in `knowledge/*.md`, are compiled into the app, and are retrieved in-browser with BM25.

The vector store was the weaker half of a duplicated capability: it needed a key, a running proxy, and a network round-trip to answer questions the local corpus already answers offline with cited passages that cannot be hallucinated.

### Removed
- **Procedure Library** — the left-nav entry and its whole view, including both the *Vector Store* and *SharePoint Check* tabs. The SharePoint tab went with it because it existed solely to compare a procedure revision against its vector-store copy (`procedureVersionStatus` returned "Needs source" without a `vectorFileId`); with no store, it graded nothing.
- **"Escalate to an external vector store"** from PM Advisor → Procedure Q&A. That tab is now purely the local corpus.
- **Backend** — `server/pm-specialist-proxy.mjs` is replaced by `server/agent-proxy.mjs`, which serves only `/health` and `/api/agent`. Deleted: `/api/file-search`, `/api/vector-store/files` (GET/POST/DELETE), `/api/vector-store/upload`, `/api/sharepoint-registry`, the OpenAI client, the vector-store pagination/enrichment helpers, and the multipart parser that existed only for store uploads. The proxy is now 187 lines, down from 344.
- `OPENAI_API_KEY`, `OPENAI_VECTOR_STORE_ID`, `OPENAI_PM_MODEL` from `.env.local.example`; `server/data/` and its empty procedure registry; the orphaned `.pm-brief` / `.pm-citation` / `.vector-store-table-scroll` CSS.

### Changed
- `settings.pmSpecialistEndpoint` → **`settings.agentEndpoint`**; `PM_SPECIALIST_PROXY_DEFAULT` → `AGENT_PROXY_DEFAULT`. The Settings field is now labelled **Agent proxy** and states that Procedure Q&A needs no endpoint at all.
- **Migration is destructive on purpose.** A workspace saved by 5.1.0 carries its old endpoint forward under the new name, then has `openAiVectorStoreId`, `vectorStoreFiles`, `sharePointProcedures`, and `ragQueries` deleted — a stale vector-store id should not survive in a product that no longer has a vector store.

### Unchanged
The local knowledge base, BM25 retrieval, finding→playbook binding, markdown upload, and the entire PM Agent LLM path (`/api/agent`, intent interpretation, narration, sanitisation, governance) all behave exactly as in 5.1.0.

### Quality
QA **523/523 across 33 groups** (down from 530 — seven checks that only exercised the deleted vector store were removed, and eight new ones were added to prove it stays deleted). Group 3c was rewritten to *prove the removal* rather than just stop testing it: no nav entry, no registered view, no vector-store keys in state, a real source grep for the deleted endpoints, and a migration test that loads a synthetic 5.1.0 workspace and asserts the retired keys are gone while `agentEndpoint` inherits the old value. A new CI guardrail fails the build if any vector-store endpoint or `OPENAI_*` variable reappears.

## [5.1.0] — 2026-07-27

Completes the optional LLM layer. It is additive: nothing in the default product path requires it, and it is deliberately kept **outside the trust path**.

### Added
- **`POST /api/agent` on the proxy**, in two modes — `interpret` (a request becomes structured actions) and `narrate` (deterministic findings become an executive brief grounded in the supplied numbers).
- **Provider-agnostic LLM config** — any OpenAI-compatible `/chat/completions` endpoint via `LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL`. Defaults to OpenRouter; the same code path serves OpenAI or a local Ollama.
- **`agentSanitizeActions()`** — model output is treated as hostile input: op allowlist, every id must exist in state, a column must belong to the card's own board, numeric ranges clamped, unknown fields dropped, non-objects rejected. Every rejection carries a reason and is **shown to the user**, not swallowed.
- **UI gating** — the AI buttons appear only when `/health` reports a configured model, so the default experience never advertises something that will not work. An unresolved request now offers AI interpretation instead of dead-ending.

### Changed
- Proxy CORS was hardcoded to a single origin (`127.0.0.1:8081`) and broke whenever the app moved port. It is now an env-configurable allowlist, localhost-only by default because the proxy holds an API key.
- `.env.local.example` rewritten: removed the inherited vector-store ID and an unverifiable model string, documented all three provider options, and stated plainly that nothing in the default path needs the file.
- The schema/app version QA assertion was too strict (exact equality). It now allows a schema to lag the app within a major — a feature release that persists no new fields should not force a schema bump — while still catching cross-major drift or a schema ahead of the app.

### Guarantees (unchanged by adding AI)
The model only ever **proposes**. Survivors of sanitisation flow through the existing `agentPlan()`, so a model-proposed move hits the identical WIP / evidence / dependency / progress-mode gates a human drag hits and still requires diff approval. Derived metrics (CPI, SPI, EAC, multiplier, contribution margin) are unwritable by construction. Change orders remain drafts; the model cannot approve anything.

### Quality
QA **530/530 across 33 groups** (+28). Group 19 proves every containment guarantee from **stubbed** model output — no key, no network — including that a blocked model-proposed move leaves the card exactly where it was. The proxy was verified to boot, report honestly with no key, return an actionable error, and survive the failure.

### Verified live (2026-07-27)
The round-trip has now been exercised end to end against OpenRouter (`anthropic/claude-sonnet-5`):

- A request the deterministic parser cannot handle ("the board is jammed, free up capacity in the busiest column") was interpreted into a valid, id-correct action in ~7s. **In Progress went 5 → 4, the WIP finding cleared, and the change was audit-trailed.**
- Asked to close an evidence-gated card, the model *did* propose the move — and **governance blocked it**. The diff showed one `ok` and one `blocked`, the button read "Apply 1 change", and after applying the card had not moved.

### Fixed during live verification
- **Proxy env file was never loaded on any path containing a space.** The inherited `ROOT` resolution hand-parsed `import.meta.url` without URL-decoding, so `Techniek OpsBoard Pro V2` became `Techniek%20OpsBoard%20Pro%20V2`; the proxy then reported itself unconfigured with a valid key sitting in the file. Replaced with `fileURLToPath`. This would have failed for any user whose checkout path contains a space.
- **`index.html` glyph corruption.** A version-bump performed with PowerShell round-tripped UTF-8 through the ANSI codepage, turning `☰ ↶ ↷ ·` into mojibake in the topbar. Restored from the last clean commit and re-bumped correctly; the whole tree was then swept for the same damage (none remaining).

## [5.0.0] — 2026-07-27

First release of **Techniek OpsBoard Pro V2**, a Techniek-branded fork and substantial extension of an inherited project-controls application. The lineage is intentional: V2 keeps the mature PMI/PMBOK engine and adds portfolio inspection, an acting agent, a local knowledge base, and a new design system.

### Added — PM Advisor (deterministic portfolio inspection)
- Grades seven dimensions (Cost · Schedule · Margin · Flow · Risk · Resource · Governance) A–F with an overall health score.
- Ranked findings, each carrying severity, **hard evidence** (the actual numbers), a **recommended action**, and a **drill-through** that resolves to a card, project + tab, board, resource, or view.
- Kanban flow diagnostics: WIP-limit breaches, aging work past 45 days with the oldest item named, bottleneck-stage detection where aged work accumulates, dependency-blocked items, unassigned work, and unestimated work (which silently corrupts BAC, utilization, and forecast).
- PMI diagnostics: CPI cost overrun, negative VAC, forecast EAC exceeding funded value (stop-work exposure), SPI slip with schedule variance in dollars, overdue clustering, and contribution margin against target reported with the earned multiplier.
- Governance and risk: change orders past a decision clock, stale risk reviews, past-due risk responses, and high-exposure risks sitting on an Accept strategy.
- Runs entirely offline with no AI service.

### Added — PM Agent (it can act, not just advise)
- **Command mode** — deterministic natural-language parsing for move, field updates (estimate / logged hours / progress / priority / due), hour logging, assignment with allocation, reschedule, and WIP rebalance. Works with **no AI service running**.
- **Recommendation mode** — proposes a batch of fixes derived from Advisor findings, each carrying its reasoning.
- **Preview → approve → apply**: every plan is shown as a diff with per-action status (`ok` / `blocked` / `invalid`) before anything changes.
- Applies through the **same validated path a human drag uses** — `applyCardMove()` was extracted from `moveCard()` so a batch runs inside one `mutate()` (a single undo step) while still passing `cardMoveValidationMessage()`. WIP limits, evidence gates, dependency gates, and progress-mode isolation all hold for the agent.
- Move gates are **re-checked at apply time**, because an earlier action in the same batch can change the board.
- Unresolvable references are rejected as `invalid` with a human message rather than silently no-oping.
- **Metrics stay derived** — there is deliberately no operation that writes CPI, SPI, EAC, multiplier, or contribution margin; the agent edits only the underlying data those are computed from.
- **Change orders are drafted as `Requested`, never auto-approved** — approval is a CCB decision.
- Every applied batch is audit-trailed as agent-attributed.

### Added — local PM knowledge base (removes the API-key dependency)
- Eight authored documents in `knowledge/*.md` covering PMBOK-informed cost and schedule practice, Kanban WIP and flow/aging, A/E multiplier and contribution margin, risk register discipline, integrated change control, and resource capacity — plus a template for your own procedures.
- `scripts/build-knowledge.mjs` compiles them to `assets/knowledge-corpus.js`. A bundle rather than runtime `fetch()` specifically because `fetch` is blocked on `file://`; the markdown stays the diffable source of truth.
- **BM25 retrieval in the browser** (IDF-weighted term frequency with length normalization) over 33 sections. Returns **cited passages, never generated text**, so nothing can be hallucinated.
- Every document declares a `dimension` and `triggers`, so **each Advisor finding is bound to the playbook that answers it** — guidance arrives attached to live data.
- Users add procedures either by dropping markdown in `knowledge/` and rebuilding, or by uploading `.md` at runtime (stored in the workspace, ranked alongside the built-ins).
- The external OpenAI vector store survives only as an explicitly optional escalation path.

### Added — dark-first Techniek brand system
- Dark control-room theme is the default; the corporate-true light theme remains a toggle and is **forced for print** (print media resets every token to the light palette).
- Techniek corporate constants — `--tek-blue #0057d9`, `--tek-green #2ea043`, `--tek-gold #f2c94c` — and the signature tri-color gradient on the active nav rail, page headers, auth crest, and brief headers.
- 6px/4px radius system, Inter-first stack, per-theme focus ring, tabular numerals on every financial surface.
- Fixed-contrast fills for avatars and Gantt bars so their white labels pass AA in **both** themes.
- **WCAG AA verified computationally** in the live browser: every checked pair ≥ 4.83:1 in both themes.

### Changed
- Product is **Techniek OpsBoard Pro V2**; storage keys `techniek-opsboard-v2[-accounts]`; global `window.TechniekOpsBoard`.
- `APP_VERSION` and `SCHEMA_VERSION` are both `5.0.0`, fixing a version/schema drift inherited from the source application; QA now asserts they cannot diverge again.
- Org taxonomy generalized: `EFS_ORGS` → `ORG_UNITS` (Techniek delivery units), `project.efsOrg` → `project.orgUnit` with legacy migration.
- WBS grouping now derives from the project's own WBS hierarchy (`wbsGroupForCode`) instead of hardcoded activity-code prefixes; per-project special-casing replaced by `hasSourceSystemControls()`.
- Rules of Credit ship six Techniek PMO standard A/E schemas (deliverable, calculation package, drawing package, study, field/commissioning, milestone), each validated to sum to 100%.
- Demo portfolio **derives** budgets and schedule dates from seeded work using the production math, so the demo cannot drift from how the app computes. Multipliers land on 2.4 / 2.7 / 3.0 / 3.2 / 4.5; CM% spans 58–78% around the 66.7% target; CPI 0.50–1.12; SPI 0.72–1.11.
- Demo dates are anchored to a reference day and shifted at build time, so the demo always shows the authored picture instead of decaying into "everything is overdue".
- PM Specialist split by audience: the manager-facing **Ask** surface moved into PM Advisor as *Procedure Q&A*; the admin surfaces (vector-store contents, SharePoint revision freshness) remain as **Procedure Library**.

### Fixed
- Revived three views that had implementations but no route in the source application: **Client Report**, **Audit Trail**, and the portfolio **Risk Register**. Issues and Decisions remain deliberately consolidated into Action Items as typed rows.
- Replaced the last native `confirm()` with the in-app modal.
- Corrected change-order handling in demo tuning so an applied CO no longer inflates the multiplier: the target describes the current (post-change) budget and the baseline is current minus the approved delta, giving truthful baseline-vs-current variance.
- Adding a WBS activated closure-governance gates that were dormant in the source (no project had a WBS). Rather than weakening them, the demo now satisfies them — closed work carries evidence, open work deliberately does not, so the evidence gate is demonstrable.

### Removed
- All prior-vendor identity: product names, logo, org codes, storage keys, and global namespace.
- An inherited real client project (~390 KB of embedded schedule-cost data) and its import module, staffing passes, and dedicated view. **The P6-import machinery is retained**; only the client data was removed.
- A live API key that was present in the source tree's local environment file — never copied into this repository.

### Quality
- QA harness expanded to **502 checks across 32 groups**, all passing. It drives production code paths through `window.TechniekOpsBoard._qa` and independently re-derives every metric from raw data.
- New groups cover the Advisor engine (including reactivity — fixing a WIP breach clears the finding and raises the score), the PM Agent (resolution, parsing, every governance gate, real mutation, audit trail, single-step undo), the knowledge base (retrieval ranks the correct playbook first; a nonsense query returns nothing), the brand system, and navigation completeness in both directions.
- Two vacuous assertions inherited during the port were replaced with real ones (a source grep and genuine view-registry checks).
- CI guardrails extended: knowledge corpus must be in sync with `knowledge/*.md`, no native `alert()`/`confirm()`, corpus files in the required-file manifest.
