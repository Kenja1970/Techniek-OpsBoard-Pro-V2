# PM Advisor and PM Agent

Two related capabilities on one screen. The **Advisor** inspects; the **Agent** acts. Both are deterministic and work with no AI service running.

**PM Advisor → Findings | Ask & Act | Procedure Q&A**

---

## PM Advisor — deterministic inspection

`advisorFindings()` walks the live workspace and returns ranked findings. Each carries:

| Field | Meaning |
|---|---|
| `severity` | `critical` · `warn` · `info` |
| `dimension` | Cost · Schedule · Margin · Flow · Risk · Resource · Governance |
| `title` | The condition, with the number in it |
| `evidence` | The actual figures — never an adjective |
| `action` | The recommended move |
| `drill` | Target that resolves to a card, project + tab, board, resource, or view |

### What it checks

**Flow (Kanban engineering)**
- WIP-limit breach, reported as *n* of *limit* on the named stage
- Aging work past 45 days, naming the oldest item and its stage
- Bottleneck stage — where aged work concentrates, i.e. arrival beating exit
- Dependency-blocked items
- Unassigned active work (nobody will pull it)
- Unestimated active work (invisible to BAC, capacity, and forecast)

**Cost**
- CPI below 0.9 once actual cost is meaningful, with EV/AC and forecast EAC vs BAC
- Negative VAC while CPI still looks acceptable
- Forecast EAC exceeding funded value — a stop-work exposure, escalated as critical

**Schedule**
- SPI below 0.9 with schedule variance in dollars
- Overdue clustering (two or more on a project)

**Margin**
- Contribution margin below the configured target, reported with the earned multiplier; more than ten points below is critical

**Risk**
- Reviews older than 45 days (a register nobody reviews is theatre)
- Responses past their due date
- High inherent exposure (≥15/25) sitting on an Accept strategy

**Resource**
- Sustained allocation above 110%
- Relief capacity below 25%, so the recommendation can name where to rebalance *from*

**Governance**
- Change orders pending a CCB decision beyond 14 days

### Health scoring

`advisorHealth()` grades each dimension A–F from a severity-weighted penalty (critical 25, warn 10, info 3, floored at 5) and averages them for an overall score. The demo portfolio grades **D/60 with 23 findings** by design — Phase 2 deliberately seeded those problems.

Scoring is intentionally simple and legible. It is a triage signal, not a statistical model; a manager should be able to explain any grade from the findings list.

### Playbooks

Each finding is bound to the knowledge-base document that answers it and renders it inline, cited. See [KNOWLEDGE-BASE.md](KNOWLEDGE-BASE.md).

---

## PM Agent — command and recommendation execution

### Command mode

Typed requests, parsed deterministically — **no AI service needed**:

| Pattern | Example |
|---|---|
| move | `move Sensor harness routing to Review` |
| set field | `set estimate of Win-theme workshop to 12` |
| | `set progress of X to 40` · `set priority of X to high` · `set due of X to 2026-09-01` |
| log hours | `log 6 hours on Accessibility audit` |
| assign | `assign Diego Romero to Case study at 40%` |
| reschedule | `push Accessibility audit by 5 days` · `pull X by 3 days` |
| rebalance | `rebalance WIP` |

Card, resource, and project references resolve by id, WBS code, or fuzzy title match. Phrasing outside these patterns is reported as unresolved rather than guessed at.

### Recommendation mode

**Propose fixes from findings** turns Advisor findings into concrete actions — WIP relief (returning the least-progressed item), assigning unassigned work to the least-loaded active engineer, seeding a nominal estimate on unestimated work. Each proposal carries its reasoning.

### The pipeline

```
actions → agentPlan() → preview (diff) → approve → agentApply() → one mutate()
             │                                          │
        validate every                          re-check move gates,
        action; resolve refs                    apply, audit-trail
```

`agentPlan()` marks each step `ok`, `blocked` (with the governance message), or `invalid` (with what could not be resolved). Only `ok` steps apply.

### Guarantees

1. **Same governance as a human drag.** `applyCardMove()` was extracted from `moveCard()` so a batch runs inside one `mutate()` while still passing `cardMoveValidationMessage()`. WIP limits, evidence gates, dependency gates, WBS membership, and progress-mode isolation all apply.
2. **Gates re-checked at apply time** — an earlier action in the same batch can change the board.
3. **Metrics stay derived.** No operation writes CPI, SPI, EAC, multiplier, or contribution margin. The agent edits the underlying data those are computed from.
4. **Rules-of-Credit progress is not writable** — it is governed by rule steps.
5. **Change orders are drafted `Requested`, never approved.** Approval is a CCB act.
6. **One undo step** per applied batch, and an agent-attributed audit-trail entry.
7. **Invalid references are rejected with a message**, never silently ignored.
8. **Viewer role cannot apply.**

### API

```js
TechniekOpsBoard._qa.advisorFindings()          // ranked findings
TechniekOpsBoard._qa.advisorHealth()            // dimension grades + overall
TechniekOpsBoard._qa.agentParseCommand(text)    // { actions, matched, intent }
TechniekOpsBoard._qa.agentActionsFromFindings() // recommendation-mode actions
TechniekOpsBoard._qa.agentPlan(actions)         // validated plan with statuses
TechniekOpsBoard._qa.agentApply(plan)           // { applied, skipped }
```

## The optional LLM layer

Nothing above requires it. When configured, it adds two things: **interpreting phrasing outside the built-in command patterns**, and **narrating findings** in prose grounded in the deterministic evidence.

It is deliberately **outside the trust path**.

```
user text ──► /api/agent (proxy holds the key) ──► model
                                                    │  JSON
                                                    ▼
                                       agentSanitizeActions()   ← treats output as hostile
                                       op allowlist · id must exist
                                       ranges clamped · unknown fields dropped
                                                    │
                                                    ▼
                                             agentPlan()         ← the SAME governance
                                       WIP · evidence · dependency · progress-mode
                                                    │
                                                    ▼
                                          diff preview ─► you approve ─► apply
```

**What the model cannot do**, enforced in code rather than by prompt:

| | |
|---|---|
| Invent an id | rejected — `cardId does not exist` |
| Reference a column from another board | rejected |
| Write CPI / SPI / EAC / multiplier / CM | dropped — derived metrics are unwritable |
| Emit an unsupported op | rejected |
| Exceed a range (progress 250, allocation 400) | clamped to 100 |
| Bypass a WIP limit or evidence gate | blocked, identically to a human drag |
| Approve a change order | impossible — drafts only |
| Apply anything | impossible — you approve the diff |

Rejections are **shown to you**, not swallowed. If the model is unsure it is instructed to return `clarification` and zero actions rather than guess, and that question is surfaced.

### Configuration

Copy `server/.env.local.example` to `server/.env.local` and set `LLM_API_KEY` + `LLM_MODEL`. The endpoint is any OpenAI-compatible `/chat/completions` gateway — OpenRouter by default, or point `LLM_BASE_URL` at OpenAI or a local Ollama. **The key stays server-side; the browser never receives it.** Then:

```bash
node server/agent-proxy.mjs
```

The UI only offers the AI buttons when `/health` reports a configured model, so the default experience never advertises something that will not work.

### Testing without a key

`agentPlanFromLlmResponse(stub)` drives the entire validate→plan path from a stubbed model response, which is how QA group 19 proves every containment guarantee above with no key and no network.
