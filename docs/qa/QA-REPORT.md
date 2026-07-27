# QA / QC Report — Techniek OpsBoard Pro V2

**Version:** 5.2.0 · **Schema:** 5.0.0 · **Date:** 2026-07-27
**Result:** ✅ **523 / 523 checks passed · 0 failures · 33 groups**
**Run:** browser harness at `tests/qa.html`, verified live with zero console errors.

## Method

The suite drives the **production** calculation and mutation code paths through `window.TechniekOpsBoard._qa` and **independently re-derives every metric from raw card data**, so an implementation bug cannot be masked by an identical bug in the test.

Where a check would otherwise be vacuous it is made real — the "no native dialogs" check greps the actual source over XHR rather than asserting `true`, and view reachability is proven in **both** directions (every nav id has a view; every view is reachable except the two deliberately consolidated).

```bash
node --check app.js
node --check tests/qa.js
node scripts/build-knowledge.mjs   # corpus must be in sync with knowledge/*.md
# then open tests/qa.html and confirm window.__QA_RESULTS.failed === 0
```

## Coverage

| # | Group | Checks |
|---|---|---:|
| 1 | Project financial rollups (revenue / contribution / multiplier / burn) | 24 |
| 1b | Card detail effort fields stay synchronized | 5 |
| 1c | Demo sample multiplier benchmarks | 6 |
| 1d | FV & EAC history | 8 |
| 2 | Earned Value Management (BAC/PV/EV/AC/CV/SV/CPI/SPI/EAC) | 48 |
| 3 | Resource utilization & allocation | 33 |
| 3b | Resource administration model | 8 |
| 3c | Agent proxy, **vector-store removal**, rules of credit | 30 |
| 4 | Portfolio totals aggregate projects | 5 |
| 5 | PMI reactivity — card creation updates rollups + EVM | 3 |
| 6 | PMI reactivity — card move to Done cascades everywhere | 7 |
| 7 | PMI reactivity — editing estimate moves committed/BAC | 1 |
| 8 | Critical path (longest dependency chain) | 5 |
| 8b | Stage position drives % complete → reports stay in sync | 5 |
| 8b2 | Manual Physical % retains progress on column move | 4 |
| 8b3 | Hard WIP policy blocks over-limit Kanban pulls | 5 |
| 8c | Program EVM aggregates all projects | 10 |
| 8d | Project administration — add & delete | 5 |
| 8e | Change control — CO approval applies budget/schedule/scope | 12 |
| 8f | Approved change order updates project + program reports | 2 |
| 8g | Gantt reschedule propagates to project + program metrics | 7 |
| 9 | File intake — CSV / Markdown / JSON extraction | 9 |
| 10 | Role-based financial visibility | 6 |
| 10b | Role-based workspace access | 12 |
| 11 | Workspace JSON round-trip integrity | 5 |
| 12 | Workspace, WBS import, governance entities | 40+ |
| 13 | README claim sanity checks | 20+ |
| **14** | **Techniek brand system (dark-first, corporate palette)** | **10** |
| **15** | **PM Advisor deterministic engine** | **20** |
| **16** | **PM Agent — command mode, recommendation mode, governance** | **29** |
| **17** | **Local PM knowledge base and finding playbooks** | **18** |
| **18** | **Navigation completeness** | **7** |
| **19** | **LLM layer — untrusted model output is contained** | **28** |
| | **Total** | **523** |

Bold groups are new in V2.

## What the new groups prove

### PM Advisor (group 15)
Every finding carries severity, dimension, evidence, and action; findings are severity-ranked; each detector fires on the seeded conditions **with the exact numbers** (`5 of 4` for the WIP breach; the oldest item named for aging); every drill-through target resolves; all seven dimensions grade A–F.

Reactivity is **asserted, not assumed** — relieving the seeded WIP breach clears that finding and raises the health score.

### PM Agent (group 16)
Resolution by fuzzy title, id, and WBS code, plus rejection of unmatched references. Deterministic parsing of every supported command form — and confirmation that unknown phrasing **does not fabricate actions**.

Governance is proven against the real gates:

- an evidence-gated card is `blocked` for the agent with the same message a human gets, and **stays put when apply is called**
- a WIP-limited stage blocks the agent's pull
- Rules-of-Credit progress cannot be written by the agent
- an invalid enum value is rejected with guidance

Then real mutation: the estimate actually changes, effort fields stay coherent, the action is audit-trailed, **applying recommendations actually clears the WIP finding**, and the whole batch undoes in one step.

### Knowledge base (group 17)
Corpus loads and covers all seven dimensions. Retrieval quality is asserted by **outcome, not presence**: a WIP question ranks `kanban-wip-limits` *first*, a margin question ranks `ae-multiplier-margin` first, a CPI question ranks `evm-cost-performance` first, scores descend monotonically, and **a nonsense query returns nothing rather than a wrong answer**.

Finding→playbook binding is verified, as is uploading a markdown procedure and retrieving it by content with frontmatter preserved.

### LLM layer (group 19) — proven without a key
`agentPlanFromLlmResponse(stub)` drives the entire validate→plan path from a **stubbed** model response, so every containment guarantee is proven deterministically with no key and no network.

Hostile output is rejected rather than hopefully passed through: invented card ids, a column from another board, unknown resource/project ids, unsupported ops, non-object entries, and zero-day reschedules all fail with a reason — and **nothing hostile survives sanitisation**.

Attempts to write derived metrics (`cpi`, `spi`, `eac`, `multiplier`) are dropped, because those are computed, not stored. Valid output is coerced instead of trusted: progress `250` clamps to `100`, allocation `400` clamps to `100`, `"HIGH"` normalises to `high`, unknown fields vanish.

Then the important one: a **model-proposed move hits the same governance gate as a human drag** — an evidence-gated card is `blocked`, and calling apply leaves it where it was. Rejections are surfaced to the user, and a model that is unsure returns a `clarification` with zero actions rather than guessing.

### Brand system (14) and Navigation (18)
Dark tokens are the default; Techniek corporate constants and the signature gradient are present; the radius system is 6px; chart series 1–3 are the corporate colors with no legacy vendor teal. Client Report, Audit Trail, and the portfolio Risk Register are reachable; Issues/Decisions stay consolidated into Action Items; no view is orphaned; no native `alert()`/`confirm()` remains in source.

## Accessibility

WCAG contrast verified computationally in the live browser against the computed custom properties, in both themes: **every checked pair ≥ 4.83:1** (AA for normal text). Light-theme status colors were darkened (`danger #b91c1c`, `warn #92400e`, `ok #166534`) after initial values measured 3.9–4.3 on their soft chips.

### Vector-store removal (group 3c) — v5.2.0
The external OpenAI vector-store RAG was removed. The suite proves it is **gone, not just hidden**: no nav entry, no registered `pmspecialist` view, no `vectorStoreFiles` / `sharePointProcedures` / `ragQueries` in state, no `openAiVectorStoreId` in settings, and a **real source grep** confirming `/api/vector-store`, `/api/file-search`, and `/api/sharepoint-registry` no longer appear in `app.js`.

The migration is tested against a synthetic 5.1.0 workspace: the retired keys must be deleted **and** `agentEndpoint` must inherit the old `pmSpecialistEndpoint` value rather than silently resetting to the default. The first version of that fixture cloned current state, which already had `agentEndpoint`, so the migration guard correctly declined to fire — the fixture was wrong, not the code, and it now deletes the key to model a genuine 5.1.0 save.

CI enforces the same rule independently: the build fails if any vector-store endpoint or `OPENAI_*` variable reappears.

## Known limitations

### Live LLM verification — 2026-07-27
Group 19 proves containment from stubbed output. The round-trip itself has now also been run against OpenRouter (`anthropic/claude-sonnet-5`):

| Test | Result |
|---|---|
| Natural language the parser can't handle → action | ✅ interpreted in ~7s, ids correct, In Progress 5 → 4, WIP finding cleared, audit-trailed |
| Model asked to close an evidence-gated card | ✅ model proposed it; **governance blocked it** — diff showed `blocked`, "Apply 1 change", card did not move |
| Proxy with no key | ✅ reports `configured: false`, returns an actionable error, survives |

The second row is the one that matters: containment was proven against a real model that genuinely attempted the forbidden action, not only against a stub.
- The QA source-grep check is skipped when `tests/qa.html` is opened directly from `file://` (XHR is blocked); it runs when served over HTTP, and CI enforces the same rule independently.

## Result

v5.0.0 passes **530/530** with zero console errors and clean `node --check` on `app.js`, `tests/qa.js`, and the optional proxy. The suite is committed so every future change can be re-validated.

---

## History

Earlier releases of the upstream application (4.x) are superseded by this V2 baseline; their QA history is retained in the source repository from which V2 was forked.
