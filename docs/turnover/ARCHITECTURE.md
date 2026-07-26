# Architecture — Techniek OpsBoard Pro V2

**Version:** 4.0.0 · **Audience:** internal engineering team receiving this codebase.

## 1. Stack and runtime model

- **Zero-build, zero-dependency front end.** `index.html` + `styles.css` +
  `app.js` (vanilla ES5-compatible JavaScript, single IIFE). No framework, no
  bundler, no npm install. Any static file server runs it:
  `python -m http.server 8081 --bind 127.0.0.1` (canonical local port 8081).
- **One optional Node process** — `server/pm-specialist-proxy.mjs` (Node 18+,
  no npm dependencies) that keeps the OpenAI API key server-side for the PM
  Specialist feature. The rest of the app is fully functional without it.
- **Persistence:** browser `localStorage` only. No database, no server state
  except the SharePoint procedure registry JSON the proxy reads/writes.

## 2. File map

| Path | What it is |
|---|---|
| `index.html` | Static shell: sidebar, topbar, `#view` container, modal/toast hosts. Loads assets with `?v=` cache-busting query strings. |
| `styles.css` | All styling; light/dark theme via `data-theme` attribute. |
| `app.js` | The entire application (~6,100 lines, one IIFE). See §3. |
| `assets/utbea2601-import.js` | `window.Techniek_UTBEA2601_IMPORT_DATA` — UTBEA2601 workbook extract (task rows, rules of credit, deliverables, action items, EV schedule, risk plan, contract funding). |
| `assets/utbea2601-resources.js` | `window.Techniek_UTBEA2601_RESOURCE_CSV` — 662-row resource/assignment-matrix catalog CSV. |
| `server/pm-specialist-proxy.mjs` | Local OpenAI proxy: vector-store file CRUD, file-search Q&A, SharePoint procedure registry. |
| `server/.env.local(.example)` | Proxy secrets: `OPENAI_API_KEY`, `OPENAI_VECTOR_STORE_ID`, `OPENAI_PM_MODEL`, `PM_PROXY_PORT`. Never committed. |
| `server/data/sharepoint-procedure-registry.json` | Procedure revision metadata store (until Microsoft Graph auth is approved). |
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
| UTBEA2601 module | `ensureUTBEA2601ScheduleNativeOnLoad`, `ensureUTBEA2601ResourceCatalogOnLoad`, `applyUTBEA2601P6Controls` (P6 schedule-cost sync — the single source of truth for that project's dates/progress/financial overrides), `applyUTBEA2601ResourceAssignments` (named staffing), `importUTBEA2601Project` |
| Permission helpers | `role()`, `canEdit`, `canFinance`, `canManageResources` |
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

1. `load(userId)` → parse localStorage → `migrate()` (defaults + normalizers +
   sample-project/UTBEA sync).
2. `ensureUTBEA2601ScheduleNativeOnLoad()` — creates or re-syncs the UTBEA2601
   project from the P6 schedule-cost data.
3. `ensureUTBEA2601ResourceCatalogOnLoad()` — seeds the 662-row resource
   catalog on first run.
4. `applyUTBEA2601ResourceAssignments()` — fills named staffing on any
   UTBEA2601 card that has no manual staffing (runs after the catalog exists).
5. `render()`; `save()` if anything changed.

## 4. UTBEA2601 data flow (the real-project showcase)

```
P6 schedule-cost workbook extract          Assignment-matrix CSV
 (assets/utbea2601-import.js)          (assets/utbea2601-resources.js)
              │                                      │
              ▼                                      ▼
   applyUTBEA2601P6Controls()  ◄──── ensureUTBEA2601ResourceCatalogOnLoad()
   · project funded value / multiplier / CPI / SPI / EAC overrides
   · WBS elements + card dates/progress from P6 activities
   · Task-3 gating on E1010 completion
              │
              ▼
   applyUTBEA2601ResourceAssignments()
   · leveled named staffing across a seven-person logical-role bench
     (PM, lead preparer, two principal-engineer reviewers, two staff
     engineers, Lead PMA for controls/records)
   · versioned pass (project.utbeaStaffingPass): recognizes and re-levels
     its OWN prior auto-staffing patterns; never touches manual staffing
   · never changes status, progress, or columns
```

Card progress, dates, and dollars for UTBEA2601 are **always re-derived from
the P6 source on load** — manual edits to those fields do not survive a
reload by design. Manual staffing edits DO survive (the staffing pass only
replaces rows that exactly match one of its own earlier auto-generated
patterns, and otherwise fills empty cards only).

## 5. PM Specialist proxy (leave-alone module)

The browser never holds the OpenAI key. It calls the local proxy
(`http://127.0.0.1:8787` by default, configurable in Settings):

- `GET /health` · `GET/POST/DELETE /api/vector-store/files` ·
  `POST /api/vector-store/upload` · `POST /api/file-search` ·
  `GET/POST /api/sharepoint-registry`

Answers are constrained to vector-store file-search results (`storeOnly`);
if retrieval returns nothing the proxy substitutes a fixed
"not available in the procedure store" response. CORS is pinned to
`http://127.0.0.1:8081`.

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
