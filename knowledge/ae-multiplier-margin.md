---
id: ae-multiplier-margin
title: A/E earned multiplier and contribution margin
source: Architecture / Engineering financial practice
dimension: Margin
triggers: contribution margin, margin below target, multiplier, cm below, profitability
tags: margin, multiplier, ae, financial
---

## The two numbers are the same number

```
multiplier = earned revenue / billable direct labor
CM%        = (earned revenue - billable direct labor) / earned revenue
CM%        = 1 - (1 / multiplier)      multiplier = 1 / (1 - CM%)
```

| Multiplier | CM%   |
|-----------:|------:|
| 2.4x       | 58.3% |
| 3.0x       | 66.7% |
| 4.5x       | 77.8% |

Quote the multiplier to engineers (it maps to rate tables) and CM% to executives (it maps to the P&L). They are algebraically identical, so never let a report show them disagreeing.

## Why margin erodes

Contribution margin falls for structural reasons far more often than for effort reasons:

1. **Staffing mix drift** — a principal doing work priced at a staff-engineer rate. The hours are productive and the margin still collapses. This is the dominant cause and is invisible unless you watch the mix.
2. **Unbilled scope** — work performed outside the funded baseline. The labour is real, the revenue is not.
3. **Rework** — paid twice, earned once.
4. **Discounted rates carried into execution** — a pursuit concession that was never re-based in the delivery plan.

## Recommended response

- Diagnose the mix before touching the schedule. Compare actual labour distribution by grade against the estimate basis; that comparison usually explains most of the gap on its own.
- Re-assign work to the grade it was priced at. If the work genuinely requires seniority, the *estimate* was wrong — reprice it or raise a change order.
- Distinguish **margin below target** from **margin negative**. Below target is a mix problem to manage; negative means you are paying to work, which is an immediate commercial escalation.
- Track margin on **earned** revenue, not billed revenue. Billing lags reality and will tell you the good news late and the bad news later.

## Setting the target

A target CM of 66.7% (a 3.0x multiplier) is a common A/E benchmark, but the meaningful target is the one that covers overhead plus profit for *your* structure. Set it deliberately, review it annually, and colour projects against it — at or above target is healthy, within ten points is a watch item, more than ten points below needs intervention this month.
