# Roles & Permissions — Techniek OpsBoard Pro V2

**Version:** 4.7.0 · **Audience:** end users, PMO reviewers, and the internal engineering team.

This document describes what each user role can see and do in every area of the
application. It is derived directly from the role gates in `app.js`
(`FINANCIAL_ROLES`, `RESOURCE_MANAGE_ROLES`, `REGISTER_GOVERN_ROLES`,
`READONLY_ROLES`, and Admin-only checks) — if code and document ever disagree,
the code is authoritative and this document must be updated.

## 1. The role model

### Roles

| Role | Intended user |
|---|---|
| **Admin** | Application owner / PMO administrator |
| **Department Manager** | Department or program leadership |
| **Project Manager** | PM of record for one or more projects |
| **Resource Manager** | Staffing and utilization owner |
| **Engineer / Contributor** | Task-level team member |
| **Viewer** | Read-only stakeholder (client, auditor, executive guest) |

### Permission gates (as implemented in v4.7.0)

The app enforces five cumulative gates. A role's capability is the union of the
gates it belongs to:

| Gate | Roles included | Controls |
|---|---|---|
| `canEdit` | All roles **except Viewer** | Task-level create/edit (cards, WBS, imports, Gantt drag, action items, rules of credit application) |
| `canConfigureWorkspace` | Same as `canEdit` | Simulated role selector, WIP policy, Kanban auto-credit, scale/performance tools, board import |
| `canFinance` | Admin, Department Manager, Project Manager, Resource Manager | Financials/FV-EAC tabs, cost/revenue/margin/burn/rates, EVM dollar metrics, project admin budget sections, Manager Report financial panels |
| `canManageResources` | Admin, Department Manager, Project Manager, Resource Manager | Resource register administration (add/edit/delete, CSV import, placeholder cleanup, inline allocation edits in drill-down) |
| `canGovernRegisters` | Admin, Department Manager, Project Manager, Resource Manager | Risks, change control, decisions, project administration (create/save/delete, plan revisions, signed Risk Management Plan upload) |
| Admin-only | Admin | Microsoft Fabric ERMAS/accounting connector URL |

### Sign-in model (local-first)

- Users are local browser profiles (`techniek-opsboard-v2-accounts` in
  `localStorage`) with a display name, a role, and an **optional** passphrase
  (salted hash; unlock is remembered per browser session).
- Each profile has its own isolated workspace
  (`techniek-opsboard-v2::<userId>`).
- The signed-in user's role drives visibility. The **Role** selector in the top
  bar simulates other roles for demonstration and review — it is a demo aid,
  not a security control. As of **v4.7.0**, the selector is **disabled** when
  the active role is **Viewer** (in both the top bar and Settings).

> **Security note for turnover:** roles are advisory UI gates, not security.
> All data lives client-side and any user of the browser profile can read
> `localStorage` directly. Enterprise authentication and server-side
> authorization are required before production use with real project data —
> see `docs/turnover/PRODUCTION-READINESS.md`.

## 2. Functionality by application area and role

Legend: ✅ full · 👁 view only · 💲 requires `canFinance` · — hidden/blocked

| Area (left nav) | Admin | Dept Mgr | Project Mgr | Resource Mgr | Engineer / Contributor | Viewer |
|---|---|---|---|---|---|---|
| **Dashboard** (portfolio KPIs, workflow health) | ✅ | ✅ | ✅ | ✅ | ✅ (no 💲 tiles) | 👁 (no 💲 tiles) |
| **Project Workspace** — Summary, WBS, Kanban, Gantt, Resources, Registers, Reports | ✅ | ✅ | ✅ | ✅ | ✅ | 👁 |
| **Project Workspace — Financials tab** | ✅ 💲 | ✅ 💲 | ✅ 💲 | ✅ 💲 | — (tab hidden) | — |
| **Project Workspace — FV/EAC tab** | ✅ 💲 | ✅ 💲 | ✅ 💲 | ✅ 💲 | — (tab hidden) | — |
| **Project Workspace — Summary** (SPI/CPI for non-finance; full EVM $ for finance) | ✅ | ✅ | ✅ | ✅ | SPI/CPI + Progress only | 👁 SPI/CPI + Progress |
| **WBS List** (add/edit/delete/upload/export WBS elements) | ✅ | ✅ | ✅ | ✅ | ✅ | 👁 |
| **Kanban Board** (drag cards, WIP limits, new card) | ✅ | ✅ | ✅ | ✅ | ✅ | 👁 (drag disabled) |
| **Resources** — register administration | ✅ | ✅ | ✅ | ✅ | 👁 | 👁 |
| **Resources** — drill-down inline allocation edit | ✅ | ✅ | ✅ | ✅ | — | — |
| **Resources** — cost/bill rates visible | 💲 | 💲 | 💲 | 💲 | — | — |
| **Risk Register** (add/edit/delete, plan upload) | ✅ | ✅ | ✅ | ✅ | 👁 | 👁 |
| **Projects** (create, edit, delete, plan revisions, change orders) | ✅ | ✅ | ✅ | ✅ | 👁 | 👁 |
| **Projects — budget/CO/FV history in admin modal** | 💲 | 💲 | 💲 | 💲 | — (sections hidden) | — |
| **Change Control** (raise/approve/apply change orders) | ✅ | ✅ | ✅ | ✅ | 👁 | 👁 |
| **Decisions register** (add/edit decision records) | ✅ | ✅ | ✅ | ✅ | 👁 | 👁 |
| **Gantt & Critical Path** (bar drag reschedules dates) | ✅ | ✅ | ✅ | ✅ | ✅ | 👁 (drag disabled) |
| **Action Items** — Issues, Actions, Evidence, RFIs | ✅ | ✅ | ✅ | ✅ | ✅ | 👁 |
| **Action Items** — Decision records | ✅ | ✅ | ✅ | ✅ | 👁 | 👁 |
| **Rules of Credit** (schemas: add/edit/delete; apply steps to cards) | ✅ | ✅ | ✅ | ✅ | ✅ | 👁 |
| **PM Advisor — Procedure Q&A** (local corpus) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (read-only; upload blocked) |
| **Manager Report** (portfolio report, print/PDF export) | ✅ 💲 | ✅ 💲 | ✅ 💲 | ✅ 💲 | ✅ (no 💲 sections) | 👁 (no 💲) |
| **Settings — simulated role, WIP policy, auto-credit** | ✅ | ✅ | ✅ | ✅ | ✅ | — (disabled) |
| **Settings — scale/performance (demo card load)** | ✅ | ✅ | ✅ | ✅ | ✅ | — (panel hidden) |
| **Settings / Data** — export JSON / reports CSV | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Settings / Data** — import JSON, reset demo, clear local data | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| **Settings / Data** — Upload & plan board | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| **Settings / Data** — financial targets (target CM %) | 💲 | 💲 | 💲 | 💲 | — | — |
| **Settings / Data** — Microsoft Fabric connector URL | ✅ | 👁 | 👁 | 👁 | 👁 | 👁 |
| **Undo / Redo, search, theme** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

## 3. Behavioral notes per role

### Admin

- Everything below, plus the only role that can edit the Microsoft Fabric
  ERMAS/accounting connector link (access to the linked Fabric workspace is
  still controlled by Microsoft Fabric permissions).
- Default profile created on first launch is `Local Admin` (no passphrase).
- Full workspace configuration: role simulation, WIP policy, Kanban auto-credit,
  scale tools, imports, and all governance registers.

### Department Manager *(default role for new profiles)*

- Full editing plus financial visibility and resource administration.
- Cannot edit the Fabric connector link.
- Sees Financials and FV/EAC workspace tabs; Manager Report financial panels.

### Project Manager

- Same as Department Manager in this MVP (full edit + finance + resource
  administration + register governance). Scoping a PM to *their* projects
  only is a backend authorization concern deferred to production hardening.

### Resource Manager

- Financial visibility (rates, margins) **and** resource register
  administration — the role owns the staffing register, utilization, and
  engagement rollups, and holds governance authority on the project
  registers.
- Resource drill-down supports inline allocation edits and removal (re-leveling).

### Engineer / Contributor *(V15 "Team Member")*

- Full task-level execution: cards, WBS, action items (Issues, Actions,
  Evidence, RFIs), rules-of-credit application, imports, Gantt reschedule.
- **Read-only** on the Risk Register, Change Control, the Decisions register,
  Decision-type action items, and project administration (create/save/
  delete/plan revisions) — per the V15 security-role requirement.
- **No financial data anywhere** — Financials/FV-EAC tabs are **not shown**;
  project admin hides budget/CO/FV sections; rates, margins, burn, and EVM
  dollar values (BAC, PV, EV, AC, CV, SV, EAC, funded value) are filtered from
  Summary, Reports, and the metrics panel. **SPI and CPI** remain visible as
  schedule/cost *indices* (non-dollar performance indicators).
- Can configure workspace policy (WIP, auto-credit, role simulation) — unlike
  Viewer.

### Viewer

- Read-only across every area; edit affordances are hidden or show a
  read-only notice and toast on attempted mutation.
- **Cannot change system settings:** simulated role selector disabled (top bar
  and Settings), WIP policy and Kanban auto-credit controls disabled, scale/
  performance panel hidden, board import disabled.
- Kanban/Gantt drag disabled; card editors open in read-only mode.
- Procedure Q&A: may search the corpus and read cited passages, but may not
  upload procedure files.
- Settings / Data: may export JSON / reports CSV for review; import, reset,
  clear, and Upload & plan board are disabled.

## 4. Project Workspace tab visibility by role

`workspaceTabs()` drives which tabs appear when a project is selected:

| Tab | Admin / Dept Mgr / PM / Resource Mgr | Engineer / Contributor | Viewer |
|---|---|---|---|
| Summary | ✅ | ✅ (non-$ metrics) | 👁 |
| WBS List | ✅ | ✅ | 👁 |
| Kanban | ✅ | ✅ | 👁 |
| Gantt | ✅ | ✅ | 👁 |
| Resources | ✅ | ✅ | 👁 |
| **Financials** | ✅ | — | — |
| Risk Register | ✅ edit / 👁 eng | 👁 | 👁 |
| Action Items | ✅ | ✅ | 👁 |
| Changes | ✅ edit / 👁 eng | 👁 | 👁 |
| **FV/EAC** | ✅ | — | — |
| Attachments | ✅ | ✅ | 👁 |
| Reports | ✅ 💲 panels | ✅ (no 💲) | 👁 |

## 5. Metrics panel filtering (non-finance roles)

`filterMetricsForRole()` strips dollar-sensitive rows for Engineer/Contributor
and Viewer:

| Metric group | Finance roles | Engineer / Viewer |
|---|---|---|
| **Financial** (funded value, margin, burn, rates) | All rows | Hidden |
| **Executive** | All rows | **Progress** only |
| **EVM** | BAC, PV, EV, AC, CV, SV, CPI, SPI, EAC | **CPI, SPI** only |
| **P6 Source** (file name, import date) | Visible | Visible |
| **Schedule Controls** (source-system projects) | Full override set | Non-dollar controls only |

Default metric group for non-finance roles: **EVM** (not Executive).

## 6. Requirement traceability

The V15 requirements (§ Security Roles, updated 4/9/2026) call for Team
Members to have read-only access to Risks, Changes, and Decisions while still
adding/editing their own Issues. As of v4.7.0 the **Engineer / Contributor**
role enforces exactly this boundary at the register level, with financial tabs
and dollar metrics fully gated. *Per-record ownership* ("edit **own** Issues")
still requires a user↔resource identity mapping that only exists once enterprise
authentication lands — tracked in `docs/turnover/PRODUCTION-READINESS.md` (P0
item 1).

### v4.7.0 RBAC hardening checklist (verified in QA group 10b, 467/467)

| Control | Viewer blocked | Engineer restricted |
|---|---|---|
| Top-bar role selector | Disabled + toast | Allowed |
| Settings role / WIP / auto-credit | Disabled | Allowed |
| Scale & performance panel | Hidden | Visible |
| Upload & plan board | Hidden | Allowed |
| Financials / FV-EAC tabs | Hidden | Hidden |
| Project admin budget/CO/FV sections | Hidden | Hidden |
| CO row click → editor | Toast (read-only) | Toast (read-only) |
| `generateLoadCards` / `removeLoadCards` | Toast (read-only) | Allowed |
| JSON import / reset / clear | Disabled | Allowed |
| Resource drill-down inline edit | — | Disabled (manager roles only) |
