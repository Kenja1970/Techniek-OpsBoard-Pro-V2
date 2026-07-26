## [4.7.0] - 2026-07-10

Role-based access control hardening — workspace, settings, and financial visibility are now consistently gated by user role.

- **Workspace tab gating:** Financials and FV/EAC tabs are hidden for Engineer/Contributor and Viewer via `workspaceTabs()`; finance roles (Admin, Department Manager, Project Manager, Resource Manager) retain full access.
- **Metrics filtering:** `filterMetricsForRole()` strips Financial group rows and dollar EVM/Executive metrics for non-finance roles; CPI, SPI, and physical Progress remain visible as performance indices without dollar exposure.
- **Viewer lockdown:** simulated role selector disabled (top bar + Settings), WIP policy and Kanban auto-credit controls disabled, scale/performance panel hidden, board import disabled, and mutation helpers (`generateLoadCards`, `removeLoadCards`, JSON import/reset/clear) blocked with explicit toasts.
- **Project admin gating:** budget/change-control summary and FV/EAC history sections hidden in project admin for non-finance roles; change-order row clicks blocked for register read-only roles.
- **Reports/Summary alignment:** Manager Report financial stat cards and metrics panel require `canFinance()`; workspace Summary shows SPI/CPI + Progress for non-finance roles instead of SV$/EAC$.
- QA extended to **467/467** (workspace tabs, metric filtering, edit/configure gates per role). Verbose role documentation updated in `docs/ROLES-AND-PERMISSIONS.md`, `docs/USER-GUIDE.md`, Word package (DFD, QA/QC, User Guide, Production Upgrade Register).

## [4.6.0] - 2026-07-10

Resource assignment drill-down, PMI-aligned metrics for internal/BD projects, larger report graphs, and a schedule-scaled FV/EAC timeline.

- **Resource drill-down & re-leveling:** Click any resource on the Resources page (🔍) to open a detail view of every card and project they're assigned to, with live utilization, an over-allocation banner, and a 4-week forecast. Adjust each card's allocation % inline to re-level utilization instantly, Open a card for full team/estimate/schedule edits, or Remove the resource from a card — all audited.
- **Internal vs. client-delivery reporting (PMI/PMO practice):** Internal, overhead, and business-development/proposal efforts (IT, website, internal ops, pursuits) are now classified separately and gauged on **budget adherence (budget variance, CPI), schedule performance (SPI), on-time delivery, and throughput** rather than revenue/contribution margin. The Manager Report splits *Client delivery financials* from a new *Internal & business development performance* panel (with its own budget-adherence, SPI, and progress charts). The Projects list and project workspace surface budget variance for internal work in place of contribution margin. Client-facing delivery keeps the existing financial metrics unchanged.
- **Larger, more legible report graphs:** Manager/Client report charts were enlarged (bigger grid cards, radial gauges/donuts, and axis/number type) for immediate at-a-glance reading, per the app-wide Nielsen Norman UX standard.
- **Schedule-scaled FV/EAC timeline:** The FV & EAC History chart now plots against a real calendar axis spanning the project's baseline start → finish (from the Kanban card baselines), with evenly spaced, legible date ticks; Cost/Bill EAC accrue on each activity's baseline finish instead of clustering on the import date.
- QA extended to **450/450** (internal/BD classification, internal metric computation, BD-pursuit detection). Regenerated Techniek Word package under `docs/word/`.

## [4.5.0] - 2026-07-09

Industry-standard risk register (ISO 31000 / PMBOK) with residual scoring, full add/edit/delete, CSV export, and a signed Risk Management Plan tracked with each project.

- **Industry-standard risk records:** Every risk now carries a **type** (threat/opportunity with the matching PMBOK response strategies — Avoid/Mitigate/Transfer/Accept for threats, Exploit/Enhance/Share/Accept for opportunities), **inherent** and **residual** (post-response) probability × impact scoring, owner, trigger/early-warning indicator, **date identified / last reviewed / response due**, and quantified **cost ($) and schedule (days) impact**. Added `normalizeRisk()` so legacy records are backfilled automatically on load.
- **Fully manageable project register:** The project workspace **Risk Register** tab now supports add / edit / delete inline (click any row to edit), shows inherent and residual scores side-by-side, and includes **Export register (CSV)** at both project and portfolio level. The portfolio Risk Register gains Type and Residual columns.
- **Signed Risk Management Plan (tracked with the project):** Upload the approved, signed plan (PDF/DOCX/XLSX up to 8 MB, stored locally) *or* link the controlled copy in SharePoint/DMS, with **revision, signed-by, signed date, and approver** metadata. Replace supersedes the prior version into a history trail; download/open and remove are one click. The plan travels in the project package and JSON export, and every change is written to the audit trail.
- QA extended to **446/446** (risk type present, residual scoring bounded, identification metadata, `normalizeRisk` backfill of legacy records, CSV export available). Regenerated Techniek Word package under `docs/word/`.

## [4.4.0] - 2026-07-09

Time-phased resource loading, a deepened delivery bench, printable Gantt, and high-end report visuals.

- **Time-phased utilization (correct model):** Utilization is now a real weekly load — each card's *remaining* effort share is spread across its live working weeks (`remaining ÷ remaining weeks ÷ weekly capacity`) instead of measuring the whole-project backlog against a single week. This turns nonsensical readings (e.g., 5,480%) into realistic engineering resource-loading percentages. Added `cardRemainingWeeks()` and a `weeklyDemand` figure to `resourceUtil()`.
- **Deepened UTBEA2601 bench (7 → 13):** Brought in additional named staff at the appropriate levels — second/third lead preparers (Arey, Bittanit), a third independent reviewer (Andrews), two more staff engineers (Acharya, Boggess), and a deputy project-controls PMA (Hawes). Re-leveled the assignment map by task family (Task 1/2/3) so large recurring and support-package activities spread across the bench. Result: on the HFIR project only the PM remains over 100% (during mandatory one-week client-review/close-out weeks) instead of six over-allocated staff.
- **Staffing pass 3:** Versioned staffing now recognizes and re-levels its own pass-1 and pass-2 auto-staffing on existing workspaces while never clobbering manual edits; statuses, progress, and P6 metrics are untouched and the pass remains idempotent.
- **Gantt → PDF:** The Gantt & Critical Path view (board and project workspace) has a **Print / PDF** button that prints in landscape with color-accurate bars and the critical path preserved, then reverts orientation.
- **High-end report graphs:** Added a zero-dependency inline-SVG chart library (donut/pie, radial gauge, grouped bars, horizontal bars). The **Manager Report** now leads with a *Portfolio visual snapshot* (budget vs earned vs direct labor, PV/EV/AC earned value, program CPI/SPI gauges, schedule-health and budget-burn donuts, progress-by-project bars). The **Client Report** carries a client-safe *Status at a glance* (overall progress, milestone and deliverable completion, schedule health, workstream progress) — no cost or margin data. Charts are theme-aware and print accurately.
- QA extended to **441/441** (time-phased weekly demand and utilization per resource, deepened bench ≥ 12, only a few over 100%, distinct Task 1/2/3 lead preparers). Regenerated Techniek Word package under `docs/word/`.

## [4.3.0] - 2026-07-09

Resource assignment UX overhaul to Nielsen Norman standards, with a standing UX order for the whole project.

- **Card face:** Each card now names the **Responsible (lead)** person with their role and a visible allocation % (no hover required). Additional team members render as labeled percentage chips (e.g., "Imran 30%"), and cards with no resource are clearly flagged as **Unassigned**. (NN #1 visibility, #6 recognition.)
- **Unified editor:** Removed the redundant standalone "Assignee" dropdown. The card editor now has a single **Team & allocation** control — the lead row is the card's primary assignee (one source of truth). (NN #4 consistency, #8 minimalism.)
- **Searchable resource picker:** Replaced the weak native datalist with a custom combobox that filters the entire resource register by name, role, department, type, or company, showing avatar + name + context, with full keyboard support (↑/↓/Enter/Esc). (NN #6 recognition, #7 flexibility.)
- **Live validation:** The editor shows a live allocation total with balanced / under / over-allocated status; resources are added on demand up to three. (NN #5 error prevention.)
- **Read-only card view** now shows the responsible lead plus the full allocated team.
- **Standing order:** Added `.cursor/rules/ux-nielsen-norman.mdc` (always-applied) requiring every future UI change to meet or exceed the 10 Nielsen Norman heuristics, and to reuse the `resourcePicker` / `buildTeamEditor` / `cardTeamHTML` patterns.
- QA extended to **427/427** (card names responsible lead, allocation % visible without hover, unassigned flagged, lead = primary assignee). Regenerated Techniek Word package under `docs/word/`.

## [4.2.0] - 2026-07-09

Production-grade Kanban / PMI hardening and Techniek Word documentation package.

- **Critical:** Manual Physical % and Rules of Credit progress are no longer overwritten when cards move on the Kanban board; auto-credit applies only to `Kanban Stage` mode.
- **Kanban pull system:** Hard WIP policy (default) blocks pulls that would exceed a stage limit; soft policy warns and allows. Configurable in Settings.
- **EVM:** Project percent complete is now effort-weighted by estimate hours so Summary / Financials / Reports stay consistent with large vs small activities.
- **moveCard** resolves the board from `card.boardId` (not only the active board) so multi-board workspaces reorder and stage-credit correctly.
- **Sample projects:** Manual Progress Sample uses a production-legal dependency chain (Done → Review → Ready); Kanban Stage Sample progress is re-derived from column geometry; migrate repairs existing local workspaces.
- QA extended (Manual retention, hard WIP, sample EV consistency). Techniek-branded Word package under `docs/word/` (QA/QC Report, Data Flow Diagrams, User Guide, Production Upgrade Register).

## [4.1.0] - 2026-07-09

Role-boundary enforcement and UTBEA2601 resource leveling.

- Enforced logical role boundaries in the views: Engineer / Contributor (V15 "Team Member") is now read-only on the Risk Register, Change Control, the Decisions register, Decision-type action items, and project administration, while retaining full task execution and the ability to raise/edit Issues, Actions, Evidence, and RFIs.
- Resource Manager now administers the resource register (previously excluded — a logical gap).
- Viewer keeps JSON/CSV export for review but loses import, reset-demo, and clear-local-data actions in Settings / Data.
- Leveled UTBEA2601 staffing across a seven-person logical-role bench: PM (Brown), lead preparer (Gromatzky), principal-engineer reviewers (Bartlett, Altmayer), staff-engineer support (Ball, Aybar Villafane), and Lead PMA for project controls/records (Brooks). LOE management activities split PM/controls, QA document upload is PMA-led records management, Task 5 support packages have distinct leads, and no resource carries more than ~31% of assigned hours (previously two people carried effectively all of it).
- Staffing pass is now versioned (`utbeaStaffingPass`): it recognizes and re-levels its own earlier auto-staffing while never touching manual staffing edits; statuses, progress, and P6 metrics remain untouched.
- QA suite extended to 410 checks (register-governance gates per role, leveling distribution, distinct Task 5 leads, LOE splits, PMA records ownership); schema promoted to 4.1.0.

## [4.0.0] - 2026-07-09

Turnover release: production-review hardening and a complete outgoing documentation package for handoff to the internal engineering team.

- Added named staffing to every UTBEA2601 schedule activity from the workbook assignment data (Brown/PM, Gromatzky/Preparer, Bartlett/Reviewer); client review-and-approve milestones are PM-tracked only. Statuses, progress, columns, and P6 metrics are untouched, the pass never overrides manual staffing, and it is idempotent (verified by QA).
- Staffing runs on load after the resource catalog seeds, so existing workspaces pick it up without a reset.
- Removed development artifacts from seeded data (migration-note activity text, sample-card wording now reads as reference work items).
- New documentation set: `docs/USER-GUIDE.md`, `docs/ROLES-AND-PERMISSIONS.md` (functionality matrix for all six roles derived from the code gates), and `docs/turnover/` (ARCHITECTURE, DATA-MODEL, API-REFERENCE, PRODUCTION-READINESS with prioritized P0/P1/P2 gap register).
- Rewrote `README.md` around the documentation index and current capabilities; version history lives here in the changelog only.
- QA suite extended to 399 checks (UTBEA2601 staffing coverage); schema promoted to 4.0.0.

## 3.9.3 - 2026-07-09
- Added a board-level Kanban WIP control status badge and per-column WIP tooltips so over-limit stages remain visible even when board filters are active.
- Added QA coverage for WIP summary reporting and over-limit detection.

## 3.9.2 - 2026-07-08
- Added a visible Settings / Data Microsoft Fabric data connector panel for ERMAS and accounting data, with an editable Fabric URL and Open Fabric data link.
- Added migration/default state and QA coverage for the Fabric ERMAS/accounting connector setting.

## 3.9.1 - 2026-07-08
- Made UTBEA2601 auto-create/synchronize on app load when missing from local browser data.
- Added selectable Project Workspace metrics for executive, financial, EVM, and P6-source controls so UTBEA2601 funded value, 2.7x multiplier, CPI, SPI, CM, EAC, and source basis are visible.
- Strengthened PM Specialist Ask project-context prompts so responses align to the selected focus: profitability, schedule, compliance, or general PM support.

## 3.9.0 - 2026-07-08
- Synchronized UTBEA2601 to the P6 schedule-cost workbook with funded value $1,672,733.55, 2.7x multiplier controls, P6 CPI/SPI, schedule dates, activity progress, and P6 source trace fields.
- Updated the dashboard to show holistic workflow health across all boards and capped insights/alerts at ten total.
- Added change-order file upload/tracking, project-specific PM Specialist Ask context, and tighter global New Card visibility.

## 3.8.0 - 2026-07-08
- Added full vector-store file pagination so PM Specialist can list the actual store count beyond the OpenAI 100-file page limit, with a scrollable in-window file table.
- Added a PM Assistance working progress bar and tightened answer presentation for copy-ready Techniek PM brief formatting.
- Added up to three percentage-based resource assignments per card, preserving assigned-user initials while driving utilization, card cost, EAC, and project resource reports from weighted allocations.
- Added editable dependency/blocker logic on cards, including linked work items, dependency WBS codes, and selectable blocking rules.
- Rebuilt rules-of-credit editing as a table with add/delete row controls and direct edit access from linked cards.
- Added two compact sample projects: one manual physical-progress project and one Kanban-stage-progress project, seeded safely into existing workspaces without replacing UTBEA2601.
- Updated QA to independently re-derive weighted resource allocation, blended card rates, dependency logic, vector pagination support, and PM Assistance progress behavior.

## 3.7.0 - 2026-07-08
- Tightened the card editor into a denser, scoped compact modal while preserving responsive labels and controls.
- Added multi-file vector-store upload from the PM Specialist Vector Store tab.
- Restyled PM Assistance output as a branded Techniek copy-ready brief with concise citations and expandable source details.
- Updated the PM Assistance proxy persona to respond as a practical senior PM partner using only retrieved vector-store material.

## 3.6.0 - 2026-07-08
- Added project-level WBS elements with add/edit/delete/upload controls and schedule-native WBS / Schedule ID display.
- Rebuilt UTBEA2601 from the March schedule amendment using Activity IDs such as A1025, C1020, D1040, E1010, F1000, and G1000.
- Removed legacy numeric WBS display for UTBEA2601 cards and added validation for schedule-coded WBS references, billing evidence, closed-card evidence, and Task 3 gating.

## 3.5.0 - 2026-07-08
- Enriched PM Specialist vector-store file listing with OpenAI file metadata so managers can see file names, size/purpose, status, add uploads, attach existing files, and delete vector-store files.
- Restricted PM Specialist answers to retrieved vector-store content; local application search is no longer used as an answer fallback.
- Added Rules of Credit edit/delete controls, project-use sorting, and usage counts.
- Added list-level delete controls to the Action Items table.

## 3.4.0 - 2026-07-08
- Made the rules-of-credit workflow explicitly deliverable-driven: deliverables map to WBS work packages, WBS packages map to activities, and activities earn progress through objective rules.
- Added action item deletion, project-filtered change control, project-plan revision management, and generated-resource placeholder cleanup.
- Stopped UTBEA2601 imports from creating default-rate resource rows for every preparer; preparer names remain on cards unless a real rated resource exists.

## 3.3.0 - 2026-07-08
- Reduced UTBEA2601 Kanban scope to five milestone-level task cards with child payment/subcard detail and workbook source traceability.
- Consolidated issues and decisions into project-scoped action items with assignees, status, due dates, evidence requirements, and closeout evidence.
- Removed Audit Trail from the control-center navigation while preserving internal audit data for imports and governance.
- Split WBS List from Kanban Board, made project resources dense/searchable/ranked, and added report PDF export via browser Save as PDF.
- Added rules-of-credit progress governance so Kanban movement can be prevented from auto-awarding physical percent complete.

﻿# Changelog

## 3.2.0 - UTBEA2601 source alignment and rules of credit

- Removed UTBEA2601 project controls from PM Specialist and added a first-class Rules of Credit module.
- Expanded UTBEA2601 source import to use task-list preparers, `% Task` progress, EV schedule baseline dates, risk-plan metadata, and contract funding profile.
- Added Kanban project filtering, dynamic project resource rollups, and contract value/EAC reporting in Project Workspace reports.

## 3.1.0 - PM Specialist and UTBEA2601 import

- Added PM Specialist workspace with Ask, Vector Store, SharePoint Check, Rules of Credit, and UTBEA2601 tabs.
- Added server-side OpenAI proxy for vector-store file list/add/delete/upload and Responses API file search.
- Imported UTBEA2601 workbook seed with activities, deliverables, open action items, resources, and rules-of-credit templates.
- Removed browser-side API key storage for OpenAI secrets; keys now belong in non-committed `server/.env.local`.

## 3.0.0 - Techniek OpsBoard Pro V2

- Renamed and repositioned the app as Techniek OpsBoard Pro V2.
- Added Project Workspace tabs for Summary, WBS/Kanban, Gantt, Resources, Financials, Risks, Issues, Changes, Decisions, FV/EAC, Attachments, and Reports.
- Added WBS-capable work-item fields, CES/P6 CSV import, project package export, and ERMAS variance logic.
- Added program, portfolio, issue, decision, resource engagement, resource availability, import, integration settings, and audit-trail entities.
- Added public namespace `window.TechniekOpsBoard` and retained `window.TechniekOpsBoard` as a compatibility alias.
- Expanded QA to 264/264 passing checks.
