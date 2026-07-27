# User Guide — Techniek OpsBoard Pro V2

**Version:** 4.7.0 · For role-by-role access rules see
[ROLES-AND-PERMISSIONS.md](ROLES-AND-PERMISSIONS.md).

## Getting started

1. Open `index.html` directly — it runs offline from `file://`. To serve it
   instead: `python -m http.server 8100`, then open http://localhost:8100/.
2. First launch creates a **Local Admin** profile and a fully seeded fictional
   Techniek portfolio: seven projects spanning delivery, pursuit, and internal
   work, with a deliberate WIP breach, aging cards, pending change orders,
   stale risks, and an over-allocated engineer — so PM Advisor has real
   findings to show.
3. Nothing else is required. The PM knowledge base, PM Advisor, and PM Agent's
   command mode all run locally with **no API key and no network**. The
   optional agent proxy (`node server/agent-proxy.mjs`) is only needed if you
   want the agent to interpret free-form requests the deterministic parser
   cannot match, or to narrate findings.

**Keyboard:** `/` search · `N` new card · `?` help · `Ctrl+Z / Ctrl+Shift+Z`
undo/redo · `Esc` close modal.

## Application areas

### Dashboard
Portfolio-level status: active/overdue/due-soon cards, contribution margin vs
the 3.0x multiplier target, workflow health per board, and the ten most
important alerts. Financial tiles appear only for finance-enabled roles.

### Project Workspace
## PM Advisor

Three tabs, and the place to start each morning.

- **Findings** — a graded health card per dimension (Cost · Schedule · Margin ·
  Flow · Risk · Resource · Governance) and a ranked list of what is wrong, each
  with the actual numbers, the recommended move, an **Open** button that jumps
  straight to the offending card/project/resource, and an expandable **Playbook**
  citing the procedure that covers it.
- **Ask & Act** — type a change (`move Sensor harness routing to Review`,
  `set estimate of X to 12`, `assign Diego Romero to Y at 40%`,
  `push Z by 5 days`, `rebalance WIP`) or press **Propose fixes from findings**.
  You get a diff to review before anything happens; blocked actions show the
  governance reason and cannot be applied. Applying is one undo step.
- **Procedure Q&A** — search the local PM knowledge base. Results are cited
  passages from real documents, never generated text. Add your own `.md`
  procedures here, or commit them under `knowledge/`.

None of this needs an API key or a network connection.

## Project Workspace

The per-project control center. Pick a project at the top; tabs:

- **Summary** — key facts, funded value, multiplier, CPI/SPI, condition.
- **WBS List** — editable WBS register (add/edit/delete/upload/export).
  Projects imported from a schedule system keep their native Activity IDs.
- **Kanban** — project-filtered board; card movement is validated against
  dependencies (e.g. Task 3 work is gated until E1010 closes) and can be set
  to not auto-credit progress.
- **Gantt** — bars per card; drag to reschedule (updates start/finish/duration
  and downstream metrics). Critical path is highlighted.
- **Resources** — named staffing per card with allocation percentages, plus
  project engagement rollups. Click the 🔍 on any resource to drill into every
  card and project they are assigned to, see live utilization and a 4-week
  forecast, and re-level by editing an allocation % inline, opening a card, or
  removing the assignment.
- **Internal vs. client-delivery metrics** — internal/overhead and
  business-development/proposal work (IT, website, internal ops, pursuits) is
  measured on budget adherence (budget variance, CPI), schedule performance
  (SPI), on-time delivery, and throughput rather than revenue or contribution
  margin. The Manager Report separates *Client delivery financials* from an
  *Internal & business development performance* panel. Client-facing billable
  delivery keeps earned-revenue, contribution-margin, and multiplier metrics.
- **Financials / FV-EAC** *(finance roles only: Admin, Department Manager,
  Project Manager, Resource Manager)* — BAC, PV, EV, AC, CV, SV, CPI, SPI,
  EAC, funded value, target cost budget, bill/cost EAC, margin history. These
  tabs are **not shown** to Engineer/Contributor or Viewer roles. If you open
  Financials or FV/EAC without finance permission you see a role warning banner.
- **Risk Register / Action Items / Changes** — governance registers scoped to
  the project. The Risk Register follows ISO 31000 / PMBOK: each risk is a
  **Threat or Opportunity** with the matching response strategies, inherent and
  **residual** (post-response) probability × impact scoring, owner, trigger,
  date identified / last reviewed / response due, and quantified cost/schedule
  impact. Add, edit (click a row), and delete risks, and **export the register
  to CSV**. Upload the **signed Risk Management Plan** (PDF/DOCX up to 8 MB) — or
  link the controlled SharePoint copy — with revision, signed-by, signed date,
  and approver; it travels with the project and is captured in exports and the
  audit trail.
- **Reports** — printable project report (browser print → PDF).

### WBS List / Kanban Board / Gantt & Critical Path
The same engines as the workspace tabs, across all boards. Kanban columns
carry WIP limits with board-level WIP status; cards show WBS/Schedule-ID
badges, billing and blocker markers. The **Gantt & Critical Path** view has a
**Print / PDF** button that prints the timeline in landscape with
color-accurate bars and a highlighted critical path.

#### Team & allocation on a card
Each card face names the **Responsible (lead)** person with their role and a
visible allocation %, then shows any additional team members as labeled
percentage chips (e.g. "Imran 30%"). Cards with no resource are flagged as
**Unassigned**. Open a card to edit the unified **Team & allocation** control:
the first row is the Responsible lead (and the card's primary assignee), each
row uses a searchable picker that filters the whole resource register by name,
role, or department, and a live total shows whether the card is balanced, under,
or over 100%. Add up to three resources on demand.

### Resources
Register of employees, TBD roles, subcontractors, tools, equipment,
facilities, and materials with capacity and (finance roles) cost/bill rates.
**Utilization is time-phased** — each card's remaining effort share is spread
across its live working weeks (remaining ÷ remaining weeks ÷ weekly capacity),
so the percentage is a real weekly load rather than the whole-project backlog
measured against one week. Filter by Over 100% / 90–100% / Under 90%, and
reduce over-allocation by adding resources to a card's Team & allocation
control or lowering a share. Admin actions (add/edit/delete, CSV import,
placeholder cleanup) require a resource-management role.

### Reports (Manager & Client)
The **Manager Report** opens with a *Portfolio visual snapshot*: budget vs
earned vs direct labor, PV/EV/AC earned value, program CPI/SPI gauges,
schedule-health and budget-burn donuts, and progress-by-project bars — then the
full financial, EVM, and program tables. The **Client Report** (Project
Workspace → Reports) carries a client-safe *Status at a glance* (overall
progress, milestone and deliverable completion, schedule health, and workstream
progress) with no cost or margin data. All charts are inline SVG, theme-aware,
and print accurately to PDF.

### Projects
Create and administer projects: budgets, baselines, billing type, program/
portfolio assignment, source-system codes, plan revision uploads, and change
orders.

### Change Control
Cross-project change-order register with per-project filtering. A CO carries
budget/schedule deltas and scope items; approving and applying it adjusts the
project baseline-vs-current variance and creates the scope cards.

### Action Items
Unified issues/decisions register. Every item is project-specific, assignable,
statused, and can only be closed with objective evidence.

### Rules of Credit
Earned-credit schemas (steps summing to 100%). Applying a step to a card sets
its physical percent complete and synchronizes logged hours. Schemas are
sortable by usage on the selected project.

### Procedure Q&A
Lives in **PM Advisor → Procedure Q&A**. Ranked BM25 retrieval over the local
corpus in `knowledge/`, returning **cited passages, never generated text** — so
it cannot invent guidance. No key, no proxy, works offline.

*(The former standalone **PM Specialist** / **Procedure Library** view and its
OpenAI vector store were removed in v5.2.0. The procedures themselves were
never in the store; they are markdown files you can read, diff, and extend.)*

### Manager Report
Executive portfolio report: workflow summaries, financial posture, EVM,
governance counts. Print to PDF from the browser.

### Settings / Data
Role/theme preferences, target contribution margin *(finance roles)*, Kanban
auto-progress toggle, WIP policy *(edit roles only)*, optional agent-proxy
endpoint, Microsoft Fabric connector link
(Admin-editable), JSON export/import of the whole workspace, and demo-data
reset.

**Role-based settings (v4.7.0):**

| Setting | Admin / Mgr / PM / Engineer | Viewer |
|---|---|---|
| Simulated role (top bar + Settings) | ✅ | — disabled |
| Kanban WIP policy (hard/soft) | ✅ | — disabled |
| Auto-credit Kanban stage progress | ✅ | — disabled |
| Scale & performance (demo card load) | ✅ | — panel hidden |
| Upload & plan board | ✅ | — button hidden |
| Export JSON / CSV | ✅ | ✅ |
| Import JSON / reset / clear | ✅ | — disabled |
| Target contribution margin % | 💲 finance roles | — |

## Roles — who can do what (summary)

Full matrix: [ROLES-AND-PERMISSIONS.md](ROLES-AND-PERMISSIONS.md). The
simulated **Role** selector in the top bar is a **demo aid** until Entra ID
SSO lands — it is disabled for Viewer.

| Role | Typical use | Key limits |
|---|---|---|
| **Admin** | PMO owner | + Fabric connector edit |
| **Department Manager** | Program leadership | Full edit + finance |
| **Project Manager** | Delivery PM | Full edit + finance |
| **Resource Manager** | Staffing owner | + resource register admin |
| **Engineer / Contributor** | Task execution | No $; registers read-only |
| **Viewer** | Audit / client guest | Read-only everywhere |

**Engineer / Contributor** can execute work (cards, WBS, Gantt, issues) but
cannot edit risks, change orders, decisions, or project administration. They
see SPI/CPI and physical progress — not budget, margin, or EVM dollars.

**Viewer** cannot change any system settings, import data, or drag Kanban/Gantt
items. Export for review is allowed.

## Data safety

Data lives only in this browser profile. **Export JSON from Settings / Data
before clearing browser data or switching machines.** Projects carrying
source-system overrides (`financialOverride` / `evmOverride` from an imported
P6 or ERMAS extract) report those values in preference to locally derived
rollups; everything else is computed live from your cards.

Procedure files you upload to the knowledge base are stored with the workspace
and travel with the JSON export. Procedures committed under `knowledge/` ship
with the application itself.
