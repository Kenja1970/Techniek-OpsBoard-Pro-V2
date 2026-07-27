/* GENERATED FILE - do not edit.
   Source: knowledge/*.md   Rebuild: node scripts/build-knowledge.mjs
   Bundled as JS because the app must run from file://, where fetch() is blocked. */
window.TECHNIEK_KNOWLEDGE = [
 {
  "id": "ae-multiplier-margin",
  "title": "A/E earned multiplier and contribution margin",
  "source": "Architecture / Engineering financial practice",
  "dimension": "Margin",
  "triggers": [
   "contribution margin",
   "margin below target",
   "multiplier",
   "cm below",
   "profitability"
  ],
  "tags": [
   "margin",
   "multiplier",
   "ae",
   "financial"
  ],
  "file": "knowledge/ae-multiplier-margin.md",
  "sections": [
   {
    "heading": "The two numbers are the same number",
    "text": "```\nmultiplier = earned revenue / billable direct labor\nCM%        = (earned revenue - billable direct labor) / earned revenue\nCM%        = 1 - (1 / multiplier)      multiplier = 1 / (1 - CM%)\n```\n\n| Multiplier | CM%   |\n|-----------:|------:|\n| 2.4x       | 58.3% |\n| 3.0x       | 66.7% |\n| 4.5x       | 77.8% |\n\nQuote the multiplier to engineers (it maps to rate tables) and CM% to executives (it maps to the P&L). They are algebraically identical, so never let a report show them disagreeing."
   },
   {
    "heading": "Why margin erodes",
    "text": "Contribution margin falls for structural reasons far more often than for effort reasons:\n\n1. **Staffing mix drift** — a principal doing work priced at a staff-engineer rate. The hours are productive and the margin still collapses. This is the dominant cause and is invisible unless you watch the mix.\n2. **Unbilled scope** — work performed outside the funded baseline. The labour is real, the revenue is not.\n3. **Rework** — paid twice, earned once.\n4. **Discounted rates carried into execution** — a pursuit concession that was never re-based in the delivery plan."
   },
   {
    "heading": "Recommended response",
    "text": "- Diagnose the mix before touching the schedule. Compare actual labour distribution by grade against the estimate basis; that comparison usually explains most of the gap on its own.\n- Re-assign work to the grade it was priced at. If the work genuinely requires seniority, the *estimate* was wrong — reprice it or raise a change order.\n- Distinguish **margin below target** from **margin negative**. Below target is a mix problem to manage; negative means you are paying to work, which is an immediate commercial escalation.\n- Track margin on **earned** revenue, not billed revenue. Billing lags reality and will tell you the good news late and the bad news later."
   },
   {
    "heading": "Setting the target",
    "text": "A target CM of 66.7% (a 3.0x multiplier) is a common A/E benchmark, but the meaningful target is the one that covers overhead plus profit for *your* structure. Set it deliberately, review it annually, and colour projects against it — at or above target is healthy, within ten points is a watch item, more than ten points below needs intervention this month."
   }
  ]
 },
 {
  "id": "evm-cost-performance",
  "title": "Cost performance — CPI, EAC, and variance response",
  "source": "PMI / PMBOK Guide practice (earned value management)",
  "dimension": "Cost",
  "triggers": [
   "cost overrun",
   "cpi",
   "negative vac",
   "eac",
   "forecast exceeds funding",
   "burn"
  ],
  "tags": [
   "evm",
   "cost",
   "cpi",
   "eac",
   "vac"
  ],
  "file": "knowledge/evm-cost-performance.md",
  "sections": [
   {
    "heading": "The identities",
    "text": "Earned value compares three curves on one cost basis:\n\n- **PV** — planned value, the budgeted cost of work scheduled to date\n- **EV** — earned value, the budgeted cost of work actually completed\n- **AC** — actual cost, what that completed work really cost\n\nFrom those: `CV = EV − AC`, `CPI = EV ÷ AC`, `EAC = BAC ÷ CPI`, `VAC = BAC − EAC`.\n\nCPI below 1.0 means every dollar spent is buying less than a dollar of planned work. It is the single most stable predictor on a project: research across large programmes has repeatedly shown CPI stabilises within roughly ±0.10 by the 20% completion point and rarely improves without a deliberate intervention. **Treat an early low CPI as the forecast, not as noise.**"
   },
   {
    "heading": "Diagnosing before reacting",
    "text": "A low CPI has a small number of root causes, and the correct response differs sharply:\n\n1. **Rate mix drift** — senior staff doing work priced for junior staff. Check the actual labour mix against the estimate basis. Fix by re-staffing, not by working faster.\n2. **Scope growth absorbed silently** — the team is delivering more than the baseline funds. This is the most common and most damaging cause, because it is invisible in the schedule. Fix through change control, not efficiency.\n3. **Estimate error** — the original basis was wrong. Re-estimate the remaining work honestly and re-forecast; do not average the error away.\n4. **Rework** — quality escapes are being paid for twice. Fix upstream in review/checking, or the CPI will not recover."
   },
   {
    "heading": "Recommended response",
    "text": "- Re-estimate **remaining** work rather than extrapolating the whole. `EAC = AC + ETC` with a fresh ETC is more defensible than `BAC ÷ CPI` once you know the cause.\n- If growth is scope-driven, raise a change order. Absorbing scope to protect a relationship converts a commercial problem into a margin problem and hides it from the client.\n- When forecast EAC exceeds funded value, that is a **stop-work exposure**, not a reporting nuance. Escalate before the ceiling is reached; a funding conversation held early is routine, held late it is a dispute.\n- Report VAC alongside EAC. EAC answers \"what will it cost\"; VAC answers \"how much trouble is that\", which is the question a manager actually has."
   }
  ]
 },
 {
  "id": "evm-schedule-performance",
  "title": "Schedule performance — SPI, critical path, and recovery",
  "source": "PMI / PMBOK Guide practice (schedule management)",
  "dimension": "Schedule",
  "triggers": [
   "behind schedule",
   "spi",
   "schedule variance",
   "overdue",
   "critical path",
   "slip"
  ],
  "tags": [
   "evm",
   "schedule",
   "spi",
   "critical-path"
  ],
  "file": "knowledge/evm-schedule-performance.md",
  "sections": [
   {
    "heading": "What SPI does and does not tell you",
    "text": "`SV = EV − PV` and `SPI = EV ÷ PV`, both expressed in cost units under traditional EVM. SPI below 1.0 means less work has been earned than was planned by now.\n\nTwo cautions that matter in practice:\n\n- **SPI converges to 1.0 as a project finishes**, regardless of lateness, because EV and PV both approach BAC. Late in a project SPI is nearly useless — use remaining float and the critical path instead.\n- **SPI is blind to criticality.** A project can show SPI 1.0 while every completed item was non-critical and the critical path has slipped badly. Always read SPI *with* the critical path, never instead of it."
   },
   {
    "heading": "Recommended response",
    "text": "- Identify the driving path first. Effort spent recovering non-critical work buys nothing.\n- **Fast-track** (overlap sequential work) before **crashing** (adding resources). Fast-tracking costs risk and rework exposure; crashing costs money and, per Brooks, adds ramp-up delay on knowledge work. Both beat silent slippage.\n- Re-sequence around the constraint where the logic is preferential rather than mandatory. Much network logic is habit, not physics.\n- Protect the finish milestone explicitly. If recovery is not credible, **re-baseline through change control** — a schedule everyone privately knows is dead stops functioning as a control.\n- Triage overdue items rather than letting them accumulate. Every silent slip erodes the credibility of the whole forecast, and a register of stale overdue work trains the team to ignore due dates."
   },
   {
    "heading": "Overdue clustering",
    "text": "When overdue items concentrate in one project or one discipline, the cause is systemic — capacity, dependency, or an unrealistic baseline — not individual. Fix the system; chasing individuals on a systemic constraint produces heroics and burnout without changing throughput."
   }
  ]
 },
 {
  "id": "integrated-change-control",
  "title": "Integrated change control and the CCB",
  "source": "PMI / PMBOK Guide practice (integrated change control)",
  "dimension": "Governance",
  "triggers": [
   "change order",
   "pending decision",
   "ccb",
   "baseline",
   "scope creep",
   "co-"
  ],
  "tags": [
   "governance",
   "change-control",
   "ccb",
   "baseline"
  ],
  "file": "knowledge/integrated-change-control.md",
  "sections": [
   {
    "heading": "The purpose is baseline integrity",
    "text": "Integrated change control exists so that the **baseline stays truthful**. Every approved change must adjust scope, schedule, and cost together — a change that moves budget without moving the schedule, or adds scope without adding either, corrupts every downstream metric. Once the baseline is fiction, CPI and SPI become fiction with it."
   },
   {
    "heading": "Undecided is the expensive state",
    "text": "A change order sitting in *Requested* or *Under Review* is not neutral. The team is usually already doing the work — that is why it was raised — so the cost is being incurred against an unfunded baseline. The longer it sits, the more of the change is delivered before anyone decides whether to fund it.\n\n**Put pending change orders on a decision clock.** Anything beyond about two weeks needs either a decision or an explicit, dated deferral with the delivery consequence stated."
   },
   {
    "heading": "What a defensible change order carries",
    "text": "- The **driver** — client request, differing site condition, regulatory shift, error. Drivers determine who pays.\n- **Scope delta**, expressed as concrete deliverables rather than narrative.\n- **Cost delta** with its basis of estimate.\n- **Schedule delta** in days, with the affected milestone named.\n- The **do-nothing option** and its consequence. A board cannot approve a change it cannot compare against."
   },
   {
    "heading": "Approval is a CCB act",
    "text": "Approval authority belongs to the change control board, at the level matching the threshold. It is not a project-manager convenience and it is not something an automated assistant should perform. Tools may *draft* a change order; only the authorised body approves one.\n\nOn approval, apply the change atomically: adjust the funded value, shift the schedule, and materialise the new scope as real work items — so the baseline and the board never disagree."
   },
   {
    "heading": "Recommended response",
    "text": "- Track baseline-versus-current explicitly so approved change is visible as variance rather than absorbed into the original number.\n- Reject silent scope. Work performed outside the baseline without a change order will surface later as a margin problem, and by then it is a commercial dispute rather than a governance step."
   }
  ]
 },
 {
  "id": "kanban-aging-and-flow",
  "title": "Work item aging, cycle time, and bottlenecks",
  "source": "Kanban practice (flow metrics)",
  "dimension": "Flow",
  "triggers": [
   "aging work",
   "aged",
   "bottleneck",
   "cycle time",
   "stuck",
   "blocked by open dependencies",
   "throughput"
  ],
  "tags": [
   "kanban",
   "flow",
   "aging",
   "cycle-time",
   "bottleneck"
  ],
  "file": "knowledge/kanban-aging-and-flow.md",
  "sections": [
   {
    "heading": "Aging is the earliest reliable warning",
    "text": "Cycle time is only measurable *after* an item finishes, which makes it a lagging indicator. **Item age** — how long a card has been in progress right now — is available today, on unfinished work, and is therefore the metric to manage by. An item aging past the historical cycle time for its stage will almost certainly finish late; the board is telling you before the due date does."
   },
   {
    "heading": "Reading an aged item",
    "text": "Aged work is rarely \"slow work\". It is usually one of:\n\n- **Silently blocked** — waiting on an approval, a vendor, or another discipline, with the dependency undocumented.\n- **Too large** — the item was never decomposable to a week's work and has no natural finish.\n- **Abandoned** — priority moved, nobody closed the card.\n- **Multitasked** — the owner is split across too many parallel items, so every one of them ages."
   },
   {
    "heading": "Recommended response",
    "text": "- Walk aged items explicitly at every stand-up, oldest first. Age, not priority, sets the review order.\n- For each: **finish it, split it, or park it.** Those are the only three honest outcomes. \"Still working on it\" for the third week running is none of them.\n- Make blocking explicit. A blocked item belongs in the dependency register with a named owner and an expected clear date — not idling in a stage where it looks like progress.\n- Split oversized items along a deliverable boundary, not an activity boundary. \"Draft section 3\" finishes; \"work on the report\" does not."
   },
   {
    "heading": "Bottleneck detection",
    "text": "When aged work concentrates in one stage, arrival rate is beating exit rate there. That stage is the system constraint, and per the Theory of Constraints, throughput of the whole board equals throughput of that stage. Improving anything upstream of it just grows the queue. Add finishing capacity at the constraint, or reduce its WIP limit to force the imbalance into view."
   }
  ]
 },
 {
  "id": "kanban-wip-limits",
  "title": "WIP limits and the pull system",
  "source": "Kanban practice (Anderson; Lean flow)",
  "dimension": "Flow",
  "triggers": [
   "wip limit breached",
   "wip",
   "over limit",
   "pull system",
   "stop starting"
  ],
  "tags": [
   "kanban",
   "flow",
   "wip",
   "pull"
  ],
  "file": "knowledge/kanban-wip-limits.md",
  "sections": [
   {
    "heading": "Why the limit exists",
    "text": "A work-in-progress limit is the mechanism that turns a board from a *visualisation* into a *system*. Without it, a board records overload; with it, the board refuses overload. Little's Law makes the trade explicit: average cycle time rises in proportion to WIP for a given throughput. Adding more parallel work does not increase delivery — it lengthens every item's wait and defers all value."
   },
   {
    "heading": "What a breach actually means",
    "text": "A stage over its limit is not a scheduling nuisance. It signals one of three conditions, and the response differs:\n\n1. **Downstream starvation** — the next stage cannot absorb output (reviewers unavailable, client sign-off pending). Fix the downstream constraint; raising the limit here just moves the queue.\n2. **Unfinished work being abandoned** — items were started and then set aside. Finish or explicitly park them; parked work belongs out of the active stage.\n3. **The limit is genuinely wrong** — capacity changed (team grew, scope narrowed). Change the limit deliberately, as a decision with a date and a rationale, not by silently exceeding it."
   },
   {
    "heading": "Recommended response",
    "text": "- **Stop starting, start finishing.** Walk the board right-to-left. Pull the closest-to-done item across before starting anything new.\n- Return the *least-progressed* item in the offending stage to the previous stage. It carries the least sunk work and the least context loss.\n- If the same stage breaches repeatedly, it is your bottleneck. Add finishing capacity there, or lower its limit until the queue drains — counter-intuitive, but a lower limit forces the constraint into the open.\n- Record a deliberate limit change rather than tolerating chronic overage. A limit nobody honours teaches the team that limits are decorative."
   },
   {
    "heading": "What not to do",
    "text": "Do not raise the limit to match current load. That converts a control signal into a rubber stamp and permanently hides the constraint."
   }
  ]
 },
 {
  "id": "resource-capacity",
  "title": "Resource loading, over-allocation, and capacity",
  "source": "PMO resource management practice",
  "dimension": "Resource",
  "triggers": [
   "over-allocated",
   "utilization",
   "capacity",
   "unassigned",
   "relief capacity",
   "allocation"
  ],
  "tags": [
   "resource",
   "capacity",
   "utilization",
   "pmo"
  ],
  "file": "knowledge/resource-capacity.md",
  "sections": [
   {
    "heading": "Sustained over-allocation is a schedule risk, not effort",
    "text": "A resource above roughly 110% of capacity is not simply \"busy\". The overload expresses itself as: multitasking (which multiplies cycle time across every item they touch), deferred reviews (which starve downstream stages), quality escapes, and eventually attrition. Utilisation above 100% for more than a sprint or two is a planning error being paid for by a person."
   },
   {
    "heading": "Read utilisation as remaining work, not booked hours",
    "text": "Booked-hours utilisation flatters. Compute load as **remaining effort ÷ remaining weeks ÷ weekly capacity**. That reflects what is actually still owed, time-phased, and it moves when work finishes — which is the behaviour you want from a leading indicator."
   },
   {
    "heading": "Recommended response, in order",
    "text": "1. **Rebalance** — move work to available capacity. Always check the bench first; relief capacity is usually sitting in the same register.\n2. **Re-sequence** — if two assignments collide, one of them frequently has float. Moving it costs nothing.\n3. **Subcontract or add a tool** — a subcontract crew or a paid analysis tool can absorb a peak without a permanent hire. Model it as a resource with its own cost and bill rate so the margin impact is visible before you commit.\n4. **Extend dates through change control** — legitimate and honest when the first three are exhausted.\n5. **Descope** — the last lever, and it belongs to the client conversation."
   },
   {
    "heading": "Unassigned work",
    "text": "An active item with no responsible owner is not merely untracked — nobody will pull it. Assign a named lead (one person, accountable) even when several people contribute; shared ownership reliably becomes no ownership. Where the tool models a team with allocation percentages, the lead row *is* the accountable owner."
   },
   {
    "heading": "Unestimated work",
    "text": "Work carrying no estimate is invisible to earned value, capacity, and forecast. It silently deflates BAC and makes utilisation look better than it is. A coarse estimate beats none — the purpose is to make the work visible to the arithmetic, not to be precise."
   }
  ]
 },
 {
  "id": "risk-register-discipline",
  "title": "Risk register discipline and response strategies",
  "source": "PMI / PMBOK Guide practice (risk management)",
  "dimension": "Risk",
  "triggers": [
   "risk",
   "review discipline",
   "stale",
   "past due",
   "accept strategy",
   "exposure",
   "probability",
   "impact"
  ],
  "tags": [
   "risk",
   "pmbok",
   "register",
   "response"
  ],
  "file": "knowledge/risk-register-discipline.md",
  "sections": [
   {
    "heading": "A register nobody reviews is theatre",
    "text": "The value of a risk register is entirely in its **review cadence**, not its completeness. A beautifully populated register last reviewed two months ago is a historical document. Risks that are not re-scored drift silently: probability changes as the project moves, and the register keeps reporting the day it was written.\n\nReview open risks at every project review. Re-score probability and impact, update the trigger, and record the review date. If a risk has not moved in three reviews, it is either closed or it was never a risk — decide which."
   },
   {
    "heading": "Threats and opportunities",
    "text": "PMBOK defines symmetric strategies. Registers that only carry threats systematically under-manage upside.\n\n| Threats | Opportunities |\n|---|---|\n| Avoid — remove the cause | Exploit — make it certain |\n| Mitigate — reduce probability or impact | Enhance — increase probability or impact |\n| Transfer — move liability (insurance, contract) | Share — partner to capture it |\n| Accept — take it knowingly | Accept — take it knowingly |\n\n**Escalate** applies to both when the risk sits outside your authority."
   },
   {
    "heading": "Inherent vs residual",
    "text": "Score both. **Inherent** is exposure before response; **residual** is exposure after. Registers carrying only one number cannot demonstrate that the response is working — and that demonstration is the entire point of the mitigation."
   },
   {
    "heading": "Accept is a decision, not a default",
    "text": "A high-exposure risk sitting on an Accept strategy is the register's most important smell. Acceptance is legitimate when it is deliberate, documented, and taken at the right authority level. It is illegitimate when it means \"nobody chose a response\". Check which one you have — the register looks identical either way."
   },
   {
    "heading": "Recommended response",
    "text": "- Give every open risk a named owner, a trigger (the early-warning condition), and a response due date.\n- Quantify cost and schedule impact where you can. \"High\" is unactionable; \"$65k and 21 days\" starts a conversation with a client.\n- When a response passes its due date and the risk is still open, escalate ownership. An overdue mitigation has already become an accepted risk by default."
   }
  ]
 }
];
