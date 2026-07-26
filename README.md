# Techniek OpsBoard Pro V2

A local-first project delivery control center for Techniek Engineering: native
WBS/Kanban execution, Gantt scheduling, resource planning, PMI/PMBOK earned
value financial controls, governance registers, audit trail, and
import/export adapters — "Planner-class task execution, plus project
controls," with no build pipeline and no server dependency.

> All seeded content is fictional Techniek demo data except the UTBEA2601
> showcase project, which synchronizes from its P6 schedule-cost source files.
> Currency is USD, dates are US-formatted, reporting follows PMI/PMBOK EVM.

![version](https://img.shields.io/badge/version-4.7.0-blue) ![stack](https://img.shields.io/badge/stack-vanilla%20JS-yellow) ![build](https://img.shields.io/badge/build-none%20required-success) ![qa](https://img.shields.io/badge/QA-467%2F467%20passing-success) ![pm](https://img.shields.io/badge/PMI%2FPMBOK-EVM%20%C2%B7%20WBS%20%C2%B7%20Audit-0f766e)

## Run it

```bash
python -m http.server 8081 --bind 127.0.0.1
# open http://127.0.0.1:8081/
```

`index.html`, `styles.css`, and `app.js` are the application — any static
server works. Optional PM Specialist proxy (OpenAI key stays server-side):

```bash
# once: copy server/.env.local.example to server/.env.local and set OPENAI_API_KEY
node server/pm-specialist-proxy.mjs
```

## Documentation

| Document | Audience | Contents |
|---|---|---|
| [docs/USER-GUIDE.md](docs/USER-GUIDE.md) | End users | Every application area and how to use it |
| [docs/word/](docs/word/) | PMO, QA, leadership | Techniek-branded MS Word package: QA/QC Report, Data Flow Diagrams, User Guide, Production Upgrade Register |
| [docs/ROLES-AND-PERMISSIONS.md](docs/ROLES-AND-PERMISSIONS.md) | Users, PMO, engineering | Functionality matrix by user role; sign-in model |
| [docs/turnover/ARCHITECTURE.md](docs/turnover/ARCHITECTURE.md) | Engineering | Stack, file map, `app.js` code map, boot sequence, UTBEA2601 data flow |
| [docs/turnover/DATA-MODEL.md](docs/turnover/DATA-MODEL.md) | Engineering | Storage layout, workspace schema, every entity, financial derivation |
| [docs/turnover/API-REFERENCE.md](docs/turnover/API-REFERENCE.md) | Engineering | `window.TechniekOpsBoard` surface and proxy HTTP endpoints |
| [docs/turnover/PRODUCTION-READINESS.md](docs/turnover/PRODUCTION-READINESS.md) | Engineering, PMO | Prioritized gap register (P0/P1/P2) and sequencing to production |
| [docs/qa/QA-REPORT.md](docs/qa/QA-REPORT.md) | QA, PMO | Dated QA runs and scope |
| [CHANGELOG.md](CHANGELOG.md) | All | Versioned change history |
| Metric references | PMO | [AEC financial metrics](docs/AEC-FINANCIAL-METRICS.md) · [PMI schedule metrics](docs/PMI-SCHEDULE-METRICS.md) · [resource management](docs/PMO-RESOURCE-MANAGEMENT.md) · [FV/EAC history](docs/FV-EAC-HISTORY.md) · [revision control](docs/REVISION-CONTROL.md) · [roadmap](docs/ROADMAP.md) |

## Capabilities

- **Project Workspace** — Summary, WBS List, Kanban, Gantt, Resources,
  Financials, Risk Register, Action Items, Changes, FV/EAC, Attachments, and
  Reports tabs per project.
- **Execution** — WBS-capable work items (outline, charge task, dependencies,
  physical % complete, ERMAS budget/actuals), drag-and-drop Kanban with WIP
  limits and board-level WIP status, Gantt bar rescheduling, critical path.
- **Financial controls** — BAC/PV/EV/AC/CV/SV/CPI/SPI/EAC, contribution
  margin vs 3.0x multiplier target, funded value, bill/cost EAC; per-card
  weighted multi-resource costing.
- **Governance** — risks, action items (evidence-gated closure), change
  control with baseline variance, decisions, FV/EAC history, append-only
  audit trail; role-gated financial visibility and administration.
- **UTBEA2601 showcase** — HFIR Pressure Vessel Replacement project
  synchronized from P6 schedule-cost source data: funded value, 2.7x
  multiplier, CPI/SPI, schedule-native activity WBS, Task-3 gating on E1010,
  and leveled named staffing across a logical-role bench (PM, lead preparer,
  independent reviewers, staff support, and project-controls PMA) from the
  assignment matrix.
- **Rules of Credit** — earned-credit schemas driving physical progress with
  logged-hour synchronization.
- **PM Specialist** — procedure-grounded Q&A constrained to the configured
  OpenAI vector store, vector-store file management, SharePoint procedure
  freshness tracking. OpenAI calls route through the local proxy; the browser
  stores only the proxy URL and vector-store id.
- **Import/export** — CES/P6 WBS CSV import, resource catalog CSV import,
  general CSV/TSV/JSON/Markdown task parsing, project package export, full
  workspace JSON export/import.

## Quality

`tests/qa.html` runs a 423-check browser suite that drives production code
paths through `window.TechniekOpsBoard._qa` — financial, EVM, resource, import,
WBS, variance, role, Kanban WIP, progress-mode isolation, and governance
behavior re-derived independently from raw workspace data. CI guardrails
syntax-check the bundle, enforce version-marker consistency, and reject debug
markers. Headless runner: `node scripts/run-qa.mjs`.

## Data & revision control

Workspace data lives in browser `localStorage` (schema `4.1.0`, one workspace
per local user profile). Export JSON from **Settings / Data** before clearing
browser data or moving machines. Version markers, `CHANGELOG.md`, and dated
QA report entries provide release traceability; local Git is recommended once
available.

## Sensitive data warning

Prototype / local-first MVP. Do **not** use for CUI, export-controlled,
classified, proprietary client, or sensitive employee data until the P0/P1
items in
[docs/turnover/PRODUCTION-READINESS.md](docs/turnover/PRODUCTION-READINESS.md)
(enterprise authentication, server-side authorization, encrypted persistence,
secret management, security review) are complete.
