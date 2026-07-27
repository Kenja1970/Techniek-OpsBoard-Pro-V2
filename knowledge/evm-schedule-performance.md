---
id: evm-schedule-performance
title: Schedule performance — SPI, critical path, and recovery
source: PMI / PMBOK Guide practice (schedule management)
dimension: Schedule
triggers: behind schedule, spi, schedule variance, overdue, critical path, slip
tags: evm, schedule, spi, critical-path
---

## What SPI does and does not tell you

`SV = EV − PV` and `SPI = EV ÷ PV`, both expressed in cost units under traditional EVM. SPI below 1.0 means less work has been earned than was planned by now.

Two cautions that matter in practice:

- **SPI converges to 1.0 as a project finishes**, regardless of lateness, because EV and PV both approach BAC. Late in a project SPI is nearly useless — use remaining float and the critical path instead.
- **SPI is blind to criticality.** A project can show SPI 1.0 while every completed item was non-critical and the critical path has slipped badly. Always read SPI *with* the critical path, never instead of it.

## Recommended response

- Identify the driving path first. Effort spent recovering non-critical work buys nothing.
- **Fast-track** (overlap sequential work) before **crashing** (adding resources). Fast-tracking costs risk and rework exposure; crashing costs money and, per Brooks, adds ramp-up delay on knowledge work. Both beat silent slippage.
- Re-sequence around the constraint where the logic is preferential rather than mandatory. Much network logic is habit, not physics.
- Protect the finish milestone explicitly. If recovery is not credible, **re-baseline through change control** — a schedule everyone privately knows is dead stops functioning as a control.
- Triage overdue items rather than letting them accumulate. Every silent slip erodes the credibility of the whole forecast, and a register of stale overdue work trains the team to ignore due dates.

## Overdue clustering

When overdue items concentrate in one project or one discipline, the cause is systemic — capacity, dependency, or an unrealistic baseline — not individual. Fix the system; chasing individuals on a systemic constraint produces heroics and burnout without changing throughput.
