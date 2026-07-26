# PMI Schedule Metrics

This note records the 2026-06-22 review of schedule metrics in Techniek OpsBoard Pro V2.

## Decision

Traditional earned value schedule variance should be displayed in dollars in this app.

Reason:
- The app computes `PV` and `EV` on a cost basis.
- Traditional EVM schedule variance is `SV = EV - PV`.
- Because `EV` and `PV` are dollar values here, `SV` is also a dollar value.
- The Manager Report now labels this explicitly as `SV ($)`.

The schedule performance index remains unitless:

```text
SPI = EV / PV
```

## Current Application Formula

Project-level EVM:

```text
BAC = committed planned cost, falling back to project budget
PV  = BAC * elapsed schedule fraction
EV  = BAC * percent complete
AC  = actual cost from logged effort
CV  = EV - AC
SV  = EV - PV
CPI = EV / AC
SPI = EV / PV
EAC = BAC / CPI
```

Program-level EVM:

```text
Program BAC = sum(project BAC)
Program PV  = sum(project PV)
Program EV  = sum(project EV)
Program AC  = sum(project AC)
Program CV  = sum(project EV) - sum(project AC)
Program SV  = sum(project EV) - sum(project PV)
Program CPI = sum(project EV) / sum(project AC)
Program SPI = sum(project EV) / sum(project PV)
```

This aggregate approach avoids averaging project indices.

## Time-Based Schedule Variance

Time-based schedule variance is a separate earned-schedule concept, usually written as `SV(t)`. It should not replace `SV ($)` unless the app explicitly adds earned-schedule calculations and labels them separately.

Recommended future enhancement:
- Add earned schedule `ES`.
- Add `SV(t) = ES - AT`, where `AT` is actual time.
- Add `SPI(t) = ES / AT`.
- Keep `SV ($)` and `SPI ($)` in the EVM section for compatibility with traditional EVM reporting.

## Sources Reviewed

- [external task-board service product page](https://www.microsoft.com/en-us/microsoft-365/external task-board service/microsoft-external task-board service) for current external task-board service feature language.
- [Earned Schedule overview](https://en.wikipedia.org/wiki/Earned_schedule) for the distinction between traditional `SV($)`/`SPI($)` and time-domain `SV(t)`/`SPI(t)`.
- [Earned Value Management overview](https://en.wikipedia.org/wiki/Earned_value_management) for PV/EV/AC, EVM schedule/cost tracking, and PMBOK-linked definitions.
- [Lipke, "Schedule is Different"](https://www.earnedschedule.com/Docs/Schedule%20is%20Different.pdf) for earned-schedule rationale.
- [Nielsen Norman Group 10 Usability Heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/) for automation UX guardrails around feedback, undo/redo, consistency, error prevention, and efficiency.

