# Architecture — Techniek OpsBoard Pro V2

**Version:** 4.0.0 · **Audience:** internal engineering team receiving this codebase.

## 1. Stack and runtime model

- **Zero-build, zero-dependency front end.** `index.html` + `styles.css` +
  `app.js` (vanilla ES5-compatible JavaScript, single IIFE). No framework, no
  bundler, no npm install. Any static file server runs it:
  `python -m http.server 8081 --bind 127.0.0.1` (canonical local port 8081).
- **One optional Node process** — `server/agent-proxy.mjs` (Node 18+, no npm
  dependencies) that keeps the LLM API key server-side for the PM Agent's
  interpret/narrate modes. The rest of the app is fully functional without it.
- **Persistence:** browser `localStorage` only. No database and **no server
  state at all** — the proxy became stateless in v5.2.0 when the SharePoint
  registry file was removed with the vector-store RAG.

## 2. File map

| Path | What it is |
|---|---|
| `index.html` | Static shell: sidebar, topbar, `#view` container, modal/toast hosts. Loads assets with `?v=` cache-busting query strings. |
| `styles.css` | All styling; light/dark theme via `data-theme` attribute. |
| `app.js` | The entire application (one IIFE). See §3. |
| `knowledge/*.md` | Authored PM knowledge corpus — **source of truth**. See `docs/KNOWLEDGE-BASE.md`. |
| `assets/knowledge-corpus.js` | `window.TECHNIEK_KNOWLEDGE` — generated from `knowledge/*.md` by `scripts/build-knowledge.mjs`. A script bundle rather than a runtime `fetch()` because `fetch` is blocked on `file://`. CI fails if it is stale. |
| `assets/techniek-logo.png`, `assets/favicon.svg` | Brand marks. |
| `scripts/build-knowledge.mjs` | Corpus compiler (markdown + frontmatter → bundle). |
| `server/agent-proxy.mjs` | **Optional** stateless LLM proxy: `/health` and `/api/agent` only. Nothing in the default product path requires it. |
| `server/.env.local(.example)` | Proxy secrets: `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`, `ALLOWED_ORIGINS`, `PM_PROXY_PORT`. Never committed. |
| `tests/qa.html`, `tests/qa.js` | Browser QA suite (see §6). |
| `.github/workflows/guardrails.yml` | Optional CI: syntax checks, required files, version-marker consistency, debug-marker scan. |
| `docs/` | Product, QA, and turnover documentation. |

## 3. app.js code map

The file is a single IIFE organized in banner-commented sections, in order:

| Section (approx. order) | Contents |
|---|---|
| Constants | `STORAGE_KEY`, `SCHEMA_VERSION`, `APP_VERSION`, roles/gates, resource types, nav registry (`NAV`), label colors, column render cap |
| Small utilities | `uid`, `esc` (HTML escaping — use for ALL interpolated strings), date/money/percent formatters, DOM helpers (`$`, `el`) |
| Demo workspace | `demoWorkspace()` — the entire fictional seed dataset; `buildInitialHistory` |
| State management | `state`, `undoStack`/`redoStack`, `load`/`save`, `migrate` (schema upgrades — every new field gets a default here), `mutate`/`commit` (undo-aware mutation wrapper) |
| Accounts / auth gate | Local profiles, optional passphrase (salted hash), session unlock, `enterApp` boot sequence |
| Permission helpers | `role()`, `canEdit`, `canFinance`, `canManageResources`, `canAdminResources` |
| Knowledge base | `kbDocuments`, `kbPassages`, `kbSearch` (BM25), `kbPlaybookForFinding` (binds a finding to its playbook), `kbParseMarkdown`, `kbImportPrompt` |
| PM Advisor | `advisorFindings()` (flow / cost / schedule / margin / risk / resource / governance detectors), `advisorHealth()` (A–F per dimension), `advisorDrill()` |
| PM Agent | `agentResolveCard/Resource/Project/Column` (fuzzy), `agentParseCommand` (deterministic NL → actions), `agentRebalanceActions`, `agentActionsFromFindings`, `agentPlan` (validate + resolve), `agentApply` (single-`mutate` batch) |
| Card/financial calc | `cardAssignments` (max 3, persisted), blended rates, `cardCost/Budget/Consumed/Remaining`, EVM (`projectEVM`, `programEVM`), multiplier/contribution-margin math, critical path, variance flags |
| Views | One `renderX()` per nav id: dashboard, workspace (tabbed), wbslist, board (Kanban + DnD), resources, projects, changecontrol, gantt, actionitems, rulescredit, pmspecialist, reports, settings, help |
| Editors/modals | `openCardEditor`, project/risk/issue/decision/CO/action-item/rule editors, confirm modals |
| Import/export | `extractTasks` (CSV/TSV/JSON/MD), `parseCesP6Csv`, `importWbsTasks`, `importResourcesFromText`, `exportProjectPackage`, JSON workspace export/import |
| Global bindings | Keyboard shortcuts (`/` search, `N` new card, `?` help, Ctrl+Z/Y), search, board select, role select |
| `init()` | Boot: load accounts → auth gate or `enterApp` |
| Public API | `window.TechniekOpsBoard` (+ `window.TechniekOpsBoard` compatibility alias) — see `API-REFERENCE.md` |

### Rendering model

- No virtual DOM. Each view function clears `#view` and rebuilds it from
  `state`. `render()` re-renders the active view; mutations go through
  `mutate(fn)` which snapshots for undo, runs `fn`, saves, and re-renders.
- **Rule:** never write to `state` outside `mutate()` unless you are in a
  load/migration path that explicitly calls `save()` afterward.

### Boot sequence (`enterApp`)

1. `load(userId)` → parse localStorage → `migrate()` (defaults, normalizers,
   sample-project consistency repair).
2. `render()`; `save()` on first run for that profile.

The boot path is deliberately free of side-effecting sync passes. A prior
version re-derived one project's dates, progress, and dollars from an embedded
source-system extract on **every** load, which meant manual edits to those
fields silently did not survive a reload. That module and its client data were
removed in V2; the P6/CES **import** machinery is retained and is now
user-initiated rather than automatic.

## 4. PM Advisor, PM Agent, and the knowledge base

```
                    state (live workspace)
                            │
                            ▼
                   advisorFindings()
   flow · cost · schedule · margin · risk · resource · governance
   each finding: severity, evidence (real numbers), action, drill target
                     │                       │
        ┌────────────┘                       └────────────┐
        ▼                                                 ▼
  advisorHealth()                          kbPlaybookForFinding()
  A–F per dimension                        binds finding → knowledge/*.md
  + overall score                          passage, rendered inline, cited
        │
        ▼
  agentActionsFromFindings()  ─┐
                               ├─►  agentPlan()  ──►  preview (diff)
  agentParseCommand(text)     ─┘    validate + resolve      │
  (deterministic NL parsing)         ok/blocked/invalid      ▼
                                                        agentApply()
                                             one mutate() = one undo step
                                     re-checks move gates, audit-trails result
```

**Invariants that must not be broken:**

1. Card moves — human *or* agent — pass `cardMoveValidationMessage()` and then
   `applyCardMove()`. `moveCard()` is simply `validate + mutate(applyCardMove)`;
   the agent reuses the same two pieces so a batch is one undo step while the
   governance is identical.
2. **Metrics are derived, never written.** No agent operation sets CPI, SPI,
   EAC, multiplier, or contribution margin — only the underlying data.
3. Stage position drives percent-complete **only** in `Kanban Stage` progress
   mode. `Rules of Credit` and `Manual Physical %` retain governed progress, or
   a drag would silently corrupt earned value.
4. Change orders are drafted `Requested`; approval is a CCB act, never
   automated.
5. Knowledge answers are **retrieved passages, never generated text**.

## 5. Agent proxy (optional, stateless)

The browser never holds an API key. It calls the local proxy
(`http://127.0.0.1:8787` by default, configurable in Settings):

- `GET /health` · `POST /api/agent`

That is the entire surface. The proxy holds no state, writes no files, and
**makes no trust decisions** — it relays the model's response and the client
re-validates every proposed action against board governance before anything can
be applied. CORS is an env-configurable localhost allowlist.

Procedure retrieval does not involve the proxy: it runs in the browser over the
bundled corpus (§4). The OpenAI vector-store path this section used to describe
was removed in v5.2.0.

## 6. Quality system

- `tests/qa.html` runs `tests/qa.js` in a browser against the real
  `window.TechniekOpsBoard._qa` surface — production code paths, not a
  reimplementation. Keep it green; every behavior change adds checks.
- CI guardrails (`guardrails.yml`): `node --check` both JS files, required
  files present, versioned asset references, `APP_VERSION` ↔ `CHANGELOG.md`
  consistency, no `console.log`/`debugger`/`FIXME` in `app.js`.
- Release discipline: bump `APP_VERSION`/`SCHEMA_VERSION`, add a
  `CHANGELOG.md` entry, append a dated section to `docs/qa/QA-REPORT.md`,
  bump the `?v=` query strings in `index.html` when `app.js`/`styles.css`
  change.
