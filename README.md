# Techniek OpsBoard Pro V2

A local-first **project delivery control center** for engineering work: Kanban execution, PMI/PMBOK earned value, A/E financial controls, resource capacity, and integrated change control — plus a **PM Advisor** that inspects your live portfolio and a **PM Agent** that can act on it.

Zero dependencies, no build step, no account. Open `index.html` and it runs.

![version](https://img.shields.io/badge/version-5.0.0-2f86ff) ![stack](https://img.shields.io/badge/stack-vanilla%20JS-f2c94c) ![build](https://img.shields.io/badge/build-none%20required-2ea043) ![qa](https://img.shields.io/badge/QA-530%2F530%20passing-2ea043) ![pm](https://img.shields.io/badge/PMI%2FPMBOK-EVM%20%C2%B7%20Change%20Control%20%C2%B7%20Risk-0057d9)

> All seeded content is **fictional Techniek demo data**. Currency is **USD**, dates are US-formatted, and reporting follows **PMI / PMBOK** practice.

---

## Run it

**Just open it.** Double-click `index.html`, or drag it into a browser. Works offline from `file://`.

**Or serve it** — needed only for the QA suite's source check and the *optional* external-AI proxy:

```bash
python -m http.server 8100
```

There is no build pipeline. `index.html`, `styles.css`, `app.js`, and `assets/knowledge-corpus.js` are the whole application.

---

## What it does

### Execution
- **Kanban board** — drag/drop, editable columns, **WIP limits with a hard pull-system policy**, per-stage filters, column collapse, compact density, and windowed rendering that stays responsive past 200 cards.
- **Project Workspace** — a per-project cockpit with role-gated tabs: Summary · WBS · Kanban · Gantt · Resources · Financials · Risk Register · Action Items · Changes · FV/EAC · Attachments · Reports.
- **WBS List**, **Gantt & Critical Path** (drag a bar to reschedule; duration preserved), **Action Items** with evidence-gated closure, **Rules of Credit** earned-credit schemas.

### PM controls
- **Earned Value Management** — BAC, PV, EV, AC, CV, SV, CPI, SPI, EAC, VAC at project *and* program level. Program indices aggregate first (ΣEV/ΣAC, ΣEV/ΣPV) rather than averaging per-project ratios.
- **A/E financials** — earned multiplier and contribution margin % against a configurable target, with green / yellow / red status. See [`docs/AEC-FINANCIAL-METRICS.md`](docs/AEC-FINANCIAL-METRICS.md).
- **Three progress modes** — Rules of Credit · Manual Physical % · Kanban Stage, with strict isolation: a drag auto-credits **only** in Kanban Stage mode, so moving a card can never silently corrupt earned value.
- **Integrated change control** — change orders that adjust budget, schedule, and scope atomically on approval, keeping baseline-vs-current variance truthful.
- **Risk register** (PMBOK) — threat *and* opportunity strategies, inherent + residual scoring, triggers, quantified cost/schedule impact.
- **FV/EAC history**, **resource capacity** with a rolling 4-week forecast, append-only **audit trail**, and a printable **Client Report** that excludes internal cost and margin.

### PM Advisor — deterministic portfolio inspection
Grades seven dimensions (Cost · Schedule · Margin · Flow · Risk · Resource · Governance) A–F and returns ranked findings, each carrying **hard evidence** (the actual numbers), a **recommended action**, and a **drill-through** to the offending card, project, resource, or register.

It runs the diagnostics an expert Kanban engineer would — WIP breaches, aging work and bottleneck stages, blocked dependencies, unassigned and unestimated work — alongside PMI checks: CPI/SPI/VAC breaches, EAC exceeding funded value, overdue clustering, margin below target, stale risk reviews, and change orders past a decision clock.

**No AI service required.**

### PM Agent — it can actually change things
Two modes through one validated pipeline:

- **Command mode** — type what you want:
  `move Sensor harness routing to Review` · `set estimate of Win-theme workshop to 12` · `assign Diego Romero to X at 40%` · `push Accessibility audit by 5 days` · `log 6 hours on Y` · `rebalance WIP`
  Parsed deterministically, so it works with **no AI service at all**.
- **Recommendation mode** — the agent reads Advisor findings and proposes a batch of fixes, each carrying its reasoning.

Every action is **previewed as a diff**, validated against the *same* governance a human drag hits (WIP limits, evidence gates, dependencies, progress-mode), applied as **one undoable batch**, and recorded in the audit trail as agent-attributed.

Two rules it will not break: **metrics stay derived** — the agent edits underlying data, never CPI/SPI/EAC/multiplier directly — and **change orders are drafted, never auto-approved**, because approval is a CCB decision.

### Knowledge base — no API key
A local PM corpus (PMBOK-informed cost/schedule practice, Kanban flow, A/E financials, integrated change control, risk discipline, resource capacity) authored as markdown in [`knowledge/`](knowledge/) and searched **in the browser** with BM25 ranking. Answers are **cited passages, never generated**, so nothing can be hallucinated.

The part that matters: every document declares a dimension and trigger phrases, so **each Advisor finding is bound to the playbook that answers it** — guidance arrives attached to your live data instead of waiting to be asked for.

**Add your own procedures** two ways — drop markdown in `knowledge/` and rebuild, or upload `.md` in the UI. See [`docs/KNOWLEDGE-BASE.md`](docs/KNOWLEDGE-BASE.md).

```bash
node scripts/build-knowledge.mjs   # after editing knowledge/*.md
```

An external OpenAI vector store remains available as a strictly **optional** escalation path via `server/pm-specialist-proxy.mjs`; the API key stays server-side and the browser never sees it.

---

## Accounts, roles, and visibility

Local multi-user profiles with isolated workspaces and optional salted-SHA-256 passphrases. Six simulated roles: Admin · Department Manager · Project Manager · Resource Manager · Engineer/Contributor · Viewer.

Financial visibility is limited to the four manager roles; master-resource administration to Admin / Department Manager / Project Manager. Full matrix in [`docs/ROLES-AND-PERMISSIONS.md`](docs/ROLES-AND-PERMISSIONS.md).

**Enterprise SSO** appears as a sign-in option but is deliberately a **stub** — a secure OIDC/SAML flow requires a backend. Local profiles are a convenience gate, **not enterprise security**.

---

## Documentation

| Document | Audience | Contents |
|---|---|---|
| [docs/USER-GUIDE.md](docs/USER-GUIDE.md) | End users | Every application area and how to use it |
| [docs/PM-ADVISOR.md](docs/PM-ADVISOR.md) | PMO, managers | Advisor diagnostics, health scoring, and the PM Agent |
| [docs/KNOWLEDGE-BASE.md](docs/KNOWLEDGE-BASE.md) | PMO, engineering | Corpus format, retrieval, and adding your own procedures |
| [docs/ROLES-AND-PERMISSIONS.md](docs/ROLES-AND-PERMISSIONS.md) | Users, PMO | Functionality matrix by role; sign-in model |
| [docs/turnover/ARCHITECTURE.md](docs/turnover/ARCHITECTURE.md) | Engineering | Stack, file map, code map, boot sequence, invariants |
| [docs/turnover/DATA-MODEL.md](docs/turnover/DATA-MODEL.md) | Engineering | Storage layout, workspace schema, entities, financial derivation |
| [docs/turnover/API-REFERENCE.md](docs/turnover/API-REFERENCE.md) | Engineering | `window.TechniekOpsBoard` surface and optional proxy endpoints |
| [docs/turnover/PRODUCTION-READINESS.md](docs/turnover/PRODUCTION-READINESS.md) | Engineering, PMO | Prioritized P0/P1/P2 gap register and sequencing |
| [docs/qa/QA-REPORT.md](docs/qa/QA-REPORT.md) | QA, PMO | Dated QA runs and coverage |
| [CHANGELOG.md](CHANGELOG.md) | All | Versioned change history |
| Metric references | PMO | [AEC financial](docs/AEC-FINANCIAL-METRICS.md) · [PMI schedule](docs/PMI-SCHEDULE-METRICS.md) · [resources](docs/PMO-RESOURCE-MANAGEMENT.md) · [FV/EAC](docs/FV-EAC-HISTORY.md) · [revision control](docs/REVISION-CONTROL.md) · [roadmap](docs/ROADMAP.md) |

---

## Quality

The QA harness at [`tests/qa.html`](tests/qa.html) drives the **production** code paths through `window.TechniekOpsBoard._qa` and **independently re-derives every metric from raw data**, so a bug cannot hide behind the same bug in the test.

**530 checks across 33 groups, all passing.** Report: [`docs/qa/QA-REPORT.md`](docs/qa/QA-REPORT.md).

```bash
node --check app.js && node --check tests/qa.js
# then open tests/qa.html and confirm window.__QA_RESULTS.failed === 0
```

CI guardrails additionally enforce: versioned relative asset URLs, `APP_VERSION` ↔ `CHANGELOG.md` consistency, knowledge corpus in sync with `knowledge/*.md`, no native `alert()`/`confirm()`, and no debug markers.

---

## Sensitive data warning

Prototype / local-first. **Do not use for CUI, export-controlled, classified, client-proprietary, or sensitive employee data** until server-side persistence, enterprise authentication and authorization, encrypted storage, an immutable audit trail, and a security review are in place — see [`docs/turnover/PRODUCTION-READINESS.md`](docs/turnover/PRODUCTION-READINESS.md).

Data lives in this browser's `localStorage` (schema `5.0.0`, one workspace per profile) unless exported. Export a JSON backup from **Settings / Data** before clearing browser data or moving machines.

## Layout

```
index.html  styles.css  app.js        # the app
assets/     knowledge-corpus.js       # generated PM corpus + logo/favicon
knowledge/  *.md                      # authored knowledge (source of truth)
scripts/    build-knowledge.mjs       # corpus compiler, QA runner, screenshots
server/     pm-specialist-proxy.mjs   # OPTIONAL external vector-store proxy
tests/      qa.html qa.js             # 530-check QA harness
docs/                                 # architecture, data model, guides, QA
```

## License

MIT — see [`LICENSE`](LICENSE).
