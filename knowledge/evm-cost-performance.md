---
id: evm-cost-performance
title: Cost performance — CPI, EAC, and variance response
source: PMI / PMBOK Guide practice (earned value management)
dimension: Cost
triggers: cost overrun, cpi, negative vac, eac, forecast exceeds funding, burn
tags: evm, cost, cpi, eac, vac
---

## The identities

Earned value compares three curves on one cost basis:

- **PV** — planned value, the budgeted cost of work scheduled to date
- **EV** — earned value, the budgeted cost of work actually completed
- **AC** — actual cost, what that completed work really cost

From those: `CV = EV − AC`, `CPI = EV ÷ AC`, `EAC = BAC ÷ CPI`, `VAC = BAC − EAC`.

CPI below 1.0 means every dollar spent is buying less than a dollar of planned work. It is the single most stable predictor on a project: research across large programmes has repeatedly shown CPI stabilises within roughly ±0.10 by the 20% completion point and rarely improves without a deliberate intervention. **Treat an early low CPI as the forecast, not as noise.**

## Diagnosing before reacting

A low CPI has a small number of root causes, and the correct response differs sharply:

1. **Rate mix drift** — senior staff doing work priced for junior staff. Check the actual labour mix against the estimate basis. Fix by re-staffing, not by working faster.
2. **Scope growth absorbed silently** — the team is delivering more than the baseline funds. This is the most common and most damaging cause, because it is invisible in the schedule. Fix through change control, not efficiency.
3. **Estimate error** — the original basis was wrong. Re-estimate the remaining work honestly and re-forecast; do not average the error away.
4. **Rework** — quality escapes are being paid for twice. Fix upstream in review/checking, or the CPI will not recover.

## Recommended response

- Re-estimate **remaining** work rather than extrapolating the whole. `EAC = AC + ETC` with a fresh ETC is more defensible than `BAC ÷ CPI` once you know the cause.
- If growth is scope-driven, raise a change order. Absorbing scope to protect a relationship converts a commercial problem into a margin problem and hides it from the client.
- When forecast EAC exceeds funded value, that is a **stop-work exposure**, not a reporting nuance. Escalate before the ceiling is reached; a funding conversation held early is routine, held late it is a dispute.
- Report VAC alongside EAC. EAC answers "what will it cost"; VAC answers "how much trouble is that", which is the question a manager actually has.
