---
id: kanban-aging-and-flow
title: Work item aging, cycle time, and bottlenecks
source: Kanban practice (flow metrics)
dimension: Flow
triggers: aging work, aged, bottleneck, cycle time, stuck, blocked by open dependencies, throughput
tags: kanban, flow, aging, cycle-time, bottleneck
---

## Aging is the earliest reliable warning

Cycle time is only measurable *after* an item finishes, which makes it a lagging indicator. **Item age** — how long a card has been in progress right now — is available today, on unfinished work, and is therefore the metric to manage by. An item aging past the historical cycle time for its stage will almost certainly finish late; the board is telling you before the due date does.

## Reading an aged item

Aged work is rarely "slow work". It is usually one of:

- **Silently blocked** — waiting on an approval, a vendor, or another discipline, with the dependency undocumented.
- **Too large** — the item was never decomposable to a week's work and has no natural finish.
- **Abandoned** — priority moved, nobody closed the card.
- **Multitasked** — the owner is split across too many parallel items, so every one of them ages.

## Recommended response

- Walk aged items explicitly at every stand-up, oldest first. Age, not priority, sets the review order.
- For each: **finish it, split it, or park it.** Those are the only three honest outcomes. "Still working on it" for the third week running is none of them.
- Make blocking explicit. A blocked item belongs in the dependency register with a named owner and an expected clear date — not idling in a stage where it looks like progress.
- Split oversized items along a deliverable boundary, not an activity boundary. "Draft section 3" finishes; "work on the report" does not.

## Bottleneck detection

When aged work concentrates in one stage, arrival rate is beating exit rate there. That stage is the system constraint, and per the Theory of Constraints, throughput of the whole board equals throughput of that stage. Improving anything upstream of it just grows the queue. Add finishing capacity at the constraint, or reduce its WIP limit to force the imbalance into view.
