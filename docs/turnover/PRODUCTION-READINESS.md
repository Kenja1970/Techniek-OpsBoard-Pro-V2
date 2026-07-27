# Production Readiness — gap register for the internal engineering team

**Version:** 4.2.0 · Honest list of what stands between this build and production.
Priorities: **P0** = required before any real project data · **P1** = multi-user
production · **P2** = class-above-Jira Kanban/PMI polish.

> Techniek-branded Word edition: `docs/word/Techniek-OpsBoard-Production-Upgrade-Register.docx`

## Closed in 4.2.0 (no longer gaps)

| Item | Resolution |
|---|---|
| Manual Physical % overwritten by Kanban moves | Auto-credit only for `Kanban Stage` |
| WIP limits visual-only | Hard pull-system policy (default); soft optional |
| Simple-average project % skewing EV | Effort-weighted by estimate hours |
| Sample Manual dependency illegal in live terms | Done → Review → Ready chain + migrate repair |
| `moveCard` used wrong board | Resolves from `card.boardId` |

## P0 — before real data

| # | Item | Current state | Required action |
|---|---|---|---|
| 1 | **Authentication & authorization** | Local browser profiles; roles are advisory UI gates; any user can switch roles in the top bar. Register-level V15 boundaries are enforced in the UI as of v4.1.0 (Team Members read-only on Risks/Changes/Decisions) | Enterprise SSO (Entra ID per Techniek standard), server-side role enforcement, and per-record ownership ("edit **own** Issues" needs a user↔resource identity mapping) |
| 2 | **Data at rest** | All workspace data in plaintext `localStorage`; optional passphrase gates the UI only, not the data | Server-side persistence with encryption at rest; remove the CUI/export-control exposure called out in the README warning |
| 3 | **LLM key handling** | Key lives in `server/.env.local` on the host running the proxy, gitignored and never sent to the browser | Rotate any key that has lived on a workstation disk before wider distribution; move to a managed secret store. Blast radius shrank in v5.2.0 — the proxy no longer holds an OpenAI account key with file-upload and vector-store-delete scope, only an inference key |
| 4 | **Proxy endpoint auth** | Both endpoints (`/health`, `/api/agent`) are unauthenticated; CORS pins the browser origin but any local process can call them | Add an auth token or session check to `/api/agent`; rate-limit it. Surface shrank from seven endpoints to two in v5.2.0 |
| 5 | **XSS audit** | Rendering is `innerHTML`-heavy; interpolated values go through `esc()` by convention | Systematic audit that every user-controlled string passes `esc()`; add a CSP header at the hosting layer; consider DOM-building over string HTML in editors |

## P1 — for multi-user production

| # | Item | Current state | Required action |
|---|---|---|---|
| 6 | **Backend persistence & sync** | One workspace per browser profile; JSON export is the only backup/transfer | API + database of the team's choice; `migrate()` in `app.js` documents every schema default needed for import of existing exports |
| 7 | **Concurrency** | Last-write-wins inside one browser; no cross-user story | Entity-level optimistic locking once a backend exists; the append-only `auditTrail` is the anchor for conflict forensics |
| 8 | **CI-enforced QA** | 384-check browser suite runs manually (`tests/qa.html`); CI only syntax-checks | Drive `tests/qa.html` headlessly (Playwright/Puppeteer) in `guardrails.yml`; fail the build on any red check |
| 9 | **Modularize `app.js`** | ~6,100 lines, one IIFE, ~1,160 functions | Split into native ES modules along the section seams in `ARCHITECTURE.md` §3 (no bundler needed); do this **before** feature additions |
| 10 | **Live integrations** | Unanet/ERMAS/Fabric/Power BI/SharePoint/Teams are link fields and import files only | Build adapters per the V15 Unanet Integration requirements after security approval; the data model already carries the external keys (`unanetProjectCode`, `ermasCode`, `externalId`, `orgUnit`) |
| 11 | **SharePoint procedure registry** | JSON file the proxy overwrites whole; manual freshness tracking | Replace with Microsoft Graph/SharePoint queries once app registration is approved |

## P2 — quality and scale

| # | Item | Notes |
|---|---|---|
| 12 | V15 screen gaps | Programs/Portfolios management screens; Business Case, Project Charter, Status, Lessons Learned, and Project Dashboard tabs; Schedule Templates; resource Skills/Availability/Project Calendar depth (Marque360-funded CR area) |
| 13 | Hosted PDF generation | Reports export via the browser print dialog today |
| 14 | Baseline snapshots | Single `baseline {budget, endDate}` per project; V15 Task Baselines expects named, dated baseline sets |
| 15 | Performance | Full-view re-render per mutation is fine at demo scale (≤ a few hundred cards); revisit if card counts grow 10× |
| 16 | localStorage ceiling | ~5 MB/origin; the seeded workspace (662 resources + registers) is well within it, but imports of large programs will not be — backend (item 6) resolves this |
| 17 | Cumulative Flow + cycle/lead time | Class-above-Jira Kanban analytics not yet present |
| 18 | Earned Schedule SV(t)/SPI(t) | Documented in PMI-SCHEDULE-METRICS; keep SV($) labeled separately when added |
| 19 | Service classes / swimlanes | Expedite / Fixed-date / Standard / Intangible not modeled |

## Explicitly out of scope for the handover

- **Knowledge base** — deliberately local and retrieval-only (cited passages,
  never generated). `assets/knowledge-corpus.js` is generated; edit
  `knowledge/*.md` and rebuild rather than patching the bundle.
- **PM Agent governance** — the agent shares `cardMoveValidationMessage()` and
  `applyCardMove()` with the human drag path on purpose. Do not add a second
  mutation route for it; that would let agent actions bypass WIP, evidence,
  dependency, and progress-mode gates.
- **Optional agent proxy** — the LLM path is an enhancement, not a dependency.
  Nothing in the default product path calls it, and the API key must stay
  server-side. The proxy must remain **stateless and non-authoritative**: it
  relays model output, and the client validates. Do not move a trust decision
  into it.

## Suggested sequencing

1. Items 3 & 4 (hours) → 2. item 9 modularization (days) → 3. items 1, 2, 6
   together as the backend milestone (weeks) → 4. item 8 as soon as CI exists
   → 5. items 10–12 per PMO priority.
