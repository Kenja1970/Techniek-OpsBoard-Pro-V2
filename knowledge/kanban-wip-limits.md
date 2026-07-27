---
id: kanban-wip-limits
title: WIP limits and the pull system
source: Kanban practice (Anderson; Lean flow)
dimension: Flow
triggers: wip limit breached, wip, over limit, pull system, stop starting
tags: kanban, flow, wip, pull
---

## Why the limit exists

A work-in-progress limit is the mechanism that turns a board from a *visualisation* into a *system*. Without it, a board records overload; with it, the board refuses overload. Little's Law makes the trade explicit: average cycle time rises in proportion to WIP for a given throughput. Adding more parallel work does not increase delivery — it lengthens every item's wait and defers all value.

## What a breach actually means

A stage over its limit is not a scheduling nuisance. It signals one of three conditions, and the response differs:

1. **Downstream starvation** — the next stage cannot absorb output (reviewers unavailable, client sign-off pending). Fix the downstream constraint; raising the limit here just moves the queue.
2. **Unfinished work being abandoned** — items were started and then set aside. Finish or explicitly park them; parked work belongs out of the active stage.
3. **The limit is genuinely wrong** — capacity changed (team grew, scope narrowed). Change the limit deliberately, as a decision with a date and a rationale, not by silently exceeding it.

## Recommended response

- **Stop starting, start finishing.** Walk the board right-to-left. Pull the closest-to-done item across before starting anything new.
- Return the *least-progressed* item in the offending stage to the previous stage. It carries the least sunk work and the least context loss.
- If the same stage breaches repeatedly, it is your bottleneck. Add finishing capacity there, or lower its limit until the queue drains — counter-intuitive, but a lower limit forces the constraint into the open.
- Record a deliberate limit change rather than tolerating chronic overage. A limit nobody honours teaches the team that limits are decorative.

## What not to do

Do not raise the limit to match current load. That converts a control signal into a rubber stamp and permanently hides the constraint.
