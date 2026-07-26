# FV & EAC History

Implemented: 2026-06-22.

## Purpose

The FV & EAC History view shows when contract value, target cost budget, bill EAC, and cost EAC started diverging. It is available:

- From FV/EAC drill-through buttons on project-oriented dashboard/list rows.
- From the Projects screen.
- As an embedded FV & EAC History tab inside project administration.

## Data Basis

The dataset is built from the project's budget audit trail:

- Baseline project budget.
- Approved change orders.
- Approved scope-card additions.
- Current card assignments, estimates, logged hours, cost rates, and bill rates.

Current formulas:

- `Funded Value`: project baseline budget plus approved budget change orders.
- `Target Cost Budget`: target cost budget plus approved scope-cost changes.
- `Cost EAC`: cumulative assignment forecast using `max(estimate, logged) * cost rate`.
- `Bill EAC`: cumulative bill forecast using `max(estimate, logged) * bill rate`; shown for T&M projects and hidden by default for FP projects.

## Chart Behavior

- Funded Value and Target Cost Budget render as step lines because they change at contract/budget audit events.
- Bill EAC and Cost EAC render as point series because they move with assignment/rate/estimate changes.
- Hovering chart markers exposes exact date, audit event, and value.
- The table includes the full underlying dataset. Table fields can be added or removed with column toggles.

## Backend/API Scaffold

Settings / Data includes Admin-only backend API configuration fields:

- API endpoint.
- API key.

This is a local-first scaffold. In production, API keys should be stored server-side, not in browser localStorage.

## QA Coverage

`tests/qa.html` group 1d verifies:

- T&M histories include Bill EAC.
- FP histories hide Bill EAC by default.
- FV reaches current funded value.
- Cost EAC reaches committed cost.
- Bill EAC reaches bill forecast.
- Target cost budget exists as a step field.
- API endpoint and API key settings persist in the workspace model.

