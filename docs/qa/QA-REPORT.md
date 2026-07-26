# QA / QC Report - Techniek OpsBoard Pro V2

**Version:** 4.7.0  
**Schema:** 4.2.0  
**Status:** 467/467 passing  
**Date:** 2026-07-10

## 2026-07-10 v4.7.0 Role-Based Access Control (RBAC) Hardening QA

Status: 467/467 checks passing. Syntax checks passed for `app.js` and `tests/qa.js`. Headless browser QA passed via `node scripts/run-qa.mjs`.

Scope verified:

- **Workspace tab gating:** `workspaceTabs()` hides Financials and FV/EAC for Engineer/Contributor and Viewer; finance roles retain full tab set (QA group 10b).
- **Metrics filtering:** `filterMetricsForRole()` strips Financial group, dollar Executive rows, and dollar EVM rows for non-finance roles; CPI/SPI and Progress remain (QA group 10b).
- **Viewer settings lockdown:** simulated role selector disabled (top bar + Settings), WIP policy and auto-credit controls disabled, scale/performance panel hidden, Upload & plan board hidden, `generateLoadCards`/`removeLoadCards` toast-blocked.
- **Project admin financial gating:** budget/CO summary and FV/EAC history sections hidden for non-finance roles; CO row clicks toast for Engineer/Viewer.
- **Workspace Summary/Reports:** non-finance roles see SPI/CPI + Progress (not SV$/EAC$); Manager Report financial stat cards and metrics panel finance-gated.
- **Full regression** across prior v4.6.0 scope (resource drill-down, internal/BD metrics, risk register, Kanban WIP, EVM).

Word package regenerated: `docs/word/Techniek-OpsBoard-QA-QC-Report.docx` (and companion DFD / User Guide / Production Upgrade Register) with per-role matrices and role-gated data-flow documentation.

## 2026-07-10 v4.6.0 Resource Drill-down, Internal/BD Metrics & Larger Report Graphs QA

Status: 450/450 checks passing. Syntax checks passed for `app.js` and `tests/qa.js`. Headless browser QA passed via `node scripts/run-qa.mjs`; visual verification of the resource drill-down, Manager Report internal panel, and enlarged charts captured via Playwright.

Scope verified:

- **Resource drill-down:** clicking a resource opens assignments across cards/projects with live utilization; inline allocation edits and card removal drive the real mutation paths (`setResourceAllocationOnCard`, `removeResourceFromCard`) and re-level utilization.
- **Internal vs. delivery classification:** internal/overhead and BD/proposal projects are detected (`isInternalProject`), BD pursuits categorized as Business Development, and non-revenue metrics computed (`internalProjectMetrics`: budget variance, CPI, SPI, on-time rate, throughput). Client-delivery projects remain on contribution-margin/multiplier metrics.
- **Report graph sizing:** enlarged chart grid/cards, radial gauges and donuts, and axis/number type; charts remain theme-aware and print-accurate.
- **FV/EAC calendar axis:** timeline spans project baseline start→finish from Kanban card baselines with legible, evenly spaced ticks.
- **Full regression** across EVM / financials / WBS / governance / Kanban WIP / risk register / resource loading.

Word package regenerated: `docs/word/Techniek-OpsBoard-QA-QC-Report.docx` (and companion DFD / User Guide / Production Upgrade Register).

## 2026-07-09 v4.5.0 Industry-Standard Risk Register & Signed Risk Management Plan QA

Status: 446/446 checks passing. Syntax checks passed for `app.js` and `tests/qa.js`. Headless browser QA passed via `node scripts/run-qa.mjs`.

Scope verified:

- **Industry-standard risk model:** every risk carries a valid type (Threat/Opportunity), inherent probability × impact (1–5), a valid PMBOK response strategy for its type, and status; residual probability × impact present, bounded (1–5), and never exceeding inherent score; identification metadata present (category, trigger, cost impact, schedule impact).
- **Legacy backfill:** `normalizeRisk()` upgrades pre-4.5.0 records (defaults type, residual = inherent, assigns id) on load without data loss.
- **Register operations:** portfolio and project-level risk register CSV export available (`exportRiskRegisterCSV`); add/edit/delete drive the real mutation paths.
- **Signed Risk Management Plan:** stored on the project (local data URL up to 8 MB or SharePoint/DMS link) with revision, signed-by, signed date, approver, and audit-trail entries; carried in the project package/JSON export.
- **Full regression** across EVM / financials / WBS / governance / Kanban WIP / resource administration / time-phased loading / report visuals.

Word package regenerated: `docs/word/Techniek-OpsBoard-QA-QC-Report.docx` (and companion DFD / User Guide / Production Upgrade Register).

## 2026-07-09 v4.4.0 Time-Phased Loading, Bench Depth, Gantt PDF & Report Charts QA

Status: 441/441 checks passing. Syntax checks passed for `app.js` and `tests/qa.js`. Headless browser QA passed via `node scripts/run-qa.mjs`. Visual verification captured via `node scripts/shot-reports.mjs` (Manager Report, Client Report, Gantt).

Scope verified:

- **Time-phased utilization:** `resourceUtil()` weekly demand and utilization independently re-derived per resource (`remaining share ÷ card remaining weeks ÷ weekly capacity`); `cardRemainingWeeks()` bounded ≥ 1; 4-week forecast still reconciles to total remaining.
- **Deepened bench & leveling:** UTBEA2601 staffed by ≥ 12 named resources; only a few employees (the PM) exceed 100% time-phased utilization; distinct Task 1/2/3 lead preparers; retained invariants — max individual share ≤ 40% of assigned hours, distinct Task 5 leads, 50/50 PM–controls LOE split, PMA-led records management, PM-only client-review tracking, staffing-pass idempotence and manual-edit preservation (pass 3 recognizes pass-1 and pass-2 auto-staffing).
- **Full regression** across EVM / financials / WBS / governance / Kanban WIP / resource administration.
- Gantt Print/PDF and report chart rendering verified visually (charts are inline SVG, theme-aware, and print with color accuracy).

Word package regenerated: `docs/word/Techniek-OpsBoard-QA-QC-Report.docx` (and companion DFD / User Guide / Production Upgrade Register).

## 2026-07-09 v4.3.0 Resource Assignment UX (Nielsen Norman) QA

Status: 427/427 checks passing. Syntax checks passed for `app.js` and `tests/qa.js`. Headless browser QA passed via `node scripts/run-qa.mjs`. Visual verification captured via `node scripts/shot.mjs`.

Scope verified: card face names the responsible (lead) resource with visible allocation % without hover; allocation percentages render on the card surface; unassigned work is flagged; the responsible lead is the card's primary assignee; unified searchable Team & allocation editor replaces the redundant Assignee dropdown; full regression across EVM / financials / WBS / governance / Kanban WIP.

Standing order: `.cursor/rules/ux-nielsen-norman.mdc` (always-applied) enforces the 10 Nielsen Norman heuristics on all future UI work.

Word package regenerated: `docs/word/Techniek-OpsBoard-QA-QC-Report.docx` (and companion DFD / User Guide / Production Upgrade Register).

## 2026-07-09 v4.2.0 Kanban / PMI Production Hardening QA

Status: 423/423 checks passing. Syntax checks passed for `app.js` and `tests/qa.js`. Headless browser QA passed via `node scripts/run-qa.mjs`.

Scope verified: Manual Physical % retention on column move; hard WIP pull blocking with soft override; effort-weighted project progress for EV; Manual/Kanban sample dependency and stage-geometry consistency across Summary/Financials/Reports; moveCard board resolution from card.boardId; Settings WIP policy; schema 4.2.0.

Word package: `docs/word/Techniek-OpsBoard-QA-QC-Report.docx` (and companion DFD / User Guide / Production Upgrade Register).

## 2026-07-09 v4.1.0 Role Boundaries & Resource Leveling QA

Status: 410/410 checks passing. Syntax checks passed for `app.js` and `tests/qa.js`. Browser QA passed at http://127.0.0.1:8081/tests/qa.html.

Scope verified: register-governance gates for all six roles (Engineer/Contributor and Viewer read-only on risks, change control, decisions, and project administration; Resource Manager now administers the resource register), UTBEA2601 leveled staffing (bench of 7 named resources, max individual share ≤ 40% of assigned hours, distinct Task 5 package leads, 50/50 PM–controls split on LOE weekly management, PMA-led records management), staffing-pass idempotence and manual-edit preservation, schema promotion to 4.1.0, and full regression coverage.

## 2026-07-09 v4.0.0 Turnover QA

Status: 399/399 checks passing. Syntax checks passed for `app.js` and `tests/qa.js`. Browser QA passed at http://127.0.0.1:8081/tests/qa.html.

Scope verified: UTBEA2601 named staffing on all 26 schedule activities (assignment presence, PM-only client-review tracking, preparer/reviewer/PM split on deliverable prep, no status/progress/column changes, idempotent second pass), schema promotion to 4.0.0, and full financial / EVM / resource / WBS / governance regression coverage.

The browser QA suite in `tests/qa.html` drives the production code paths through `window.TechniekOpsBoard._qa` and independently re-derives financial, EVM, resource, import, WBS, variance, and governance behavior from raw workspace data.

## Coverage Added In v3.0.0

- Product namespace moved to `window.TechniekOpsBoard` with legacy alias retained.
- Project Workspace, program/portfolio seed data, integration settings, issues, decisions, and audit trail entities are present.
- WBS-capable work items include outline, charge task, physical percent complete, ERMAS budget/actual/start/finish, and import linkage.
- CES/P6 CSV import parses WBS hierarchy, creates work items, maps charge tasks, creates missing resources, and records import/audit history.
- ERMAS variance logic flags task budget high as red, task budget low as yellow, early start as yellow, and late finish as yellow.
- Resource engagement rollups calculate weekly, monthly, yearly, and weekly-equivalent planned hours.
- Existing contribution margin, multiplier, FV/EAC, EVM, Gantt rescheduling, change control, and resource administration checks remain passing.

## PM Specialist / UTBEA2601

Added QA coverage for server-side secret handling, vector-store configuration, procedure version status, rules-of-credit validation, UTBEA2601 workbook import, WBS hierarchy creation, deliverables, open action items, and ROC-driven progress/logged-hour synchronization.


## 2026-07-07 Browser QA

Status: 285/285 checks passing. Syntax checks passed for app.js, tests/qa.js, and server/pm-specialist-proxy.mjs. Live smoke test passed for http://127.0.0.1:8081/ and proxy health at http://127.0.0.1:8787/health.


## 2026-07-07 Next Round QA

Status: 293/293 checks passing. Verified PM Specialist excludes UTBEA2601 project controls, Rules of Credit schemas parse to 100%, UTBEA2601 card progress/assignments/baseline dates/risk/funding data load from source files, project resource rows derive from card data, and contract value/EAC reporting is dynamic.


## 2026-07-08 v3.8.0 Production QA

Status: 364/364 checks passing. Syntax checks passed for `app.js`, `tests/qa.js`, and `server/pm-specialist-proxy.mjs`. Browser QA passed at http://127.0.0.1:8081/tests/qa.html. Live smoke checks passed for http://127.0.0.1:8081/ and proxy health at http://127.0.0.1:8787/health.

Additional v3.8 checks verify vector-store full pagination beyond 100 files, PM Assistance working progress support, weighted multi-resource card assignments, dependency/blocker editing logic, rules-of-credit table editing, and the two compact sample projects for manual physical progress and Kanban-stage progress.


## 2026-07-08 v3.9.0 Production QA

Status: 374/374 checks passing. Syntax checks passed for `app.js`, `tests/qa.js`, and `server/pm-specialist-proxy.mjs`. Browser QA passed at http://127.0.0.1:8081/tests/qa.html.

Scope verified: UTBEA2601 P6 schedule-cost controls, funded value $1,672,733.55, 2.7x multiplier, CPI/SPI from the workbook, workflow-wide dashboard summary, ten-alert cap, change-order file tracking, PM Specialist project-specific Ask context, vector-store editability, WBS/resources/action-item regressions, and PMI EVM identities.


## 2026-07-08 v3.9.1 Production QA

Status: 380/380 checks passing. Syntax checks passed for `app.js`, `tests/qa.js`, and `server/pm-specialist-proxy.mjs`. Browser QA passed at http://127.0.0.1:8081/tests/qa.html.

Scope verified: UTBEA2601 auto-create/sync on load, selectable Project Workspace metrics, P6 funded value exact display, 2.7x multiplier, CPI/SPI, and PM Specialist Ask project-context focus alignment for profitability, schedule, and compliance questions.


## 2026-07-08 v3.9.2 Production QA

Status: 382/382 checks passing. Syntax checks passed for `app.js`, `tests/qa.js`, and `server/pm-specialist-proxy.mjs`. Browser QA passed at http://127.0.0.1:8081/tests/qa.html.

Scope verified: visible Settings / Data Microsoft Fabric connector for ERMAS/accounting data, configurable Fabric URL persistence, Open Fabric data UI link, and existing UTBEA2601 / PM Specialist regression coverage.


## 2026-07-09 v3.9.3 Production QA

Status: 384/384 checks passing. Syntax checks passed for `app.js` and `tests/qa.js`. Browser QA passed at http://127.0.0.1:8081/tests/qa.html.

Scope verified: board-level Kanban WIP control status, over-limit WIP summary detection, per-column WIP tooltips, and existing financial / EVM / resource / WBS / governance regression coverage.
