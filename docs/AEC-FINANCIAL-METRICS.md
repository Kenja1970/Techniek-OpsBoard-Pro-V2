# A/E Financial Metrics

Research pass: 2026-06-22.

## Source Finding

The app should treat the A/E multiplier as a revenue-to-direct-labor metric, not as total contract value divided by cost-to-date.

Sources reviewed:

- AIA Best Practices, **Budgeting key performance indicators**: defines net revenue / net service revenue as total revenue minus direct expenses, defines `Net Multiplier = Net Revenue / Direct Labor`, states the metric can be monitored by project phase, project manager, unit, and firm, and notes an industry benchmark around `3.0`. It also gives typical overhead around `160%` to `170%`, implying breakeven around `2.60` to `2.70` before profit.  
  https://www.aia.org/sites/default/files/2025-12/AIA_BestPractices_Budgetingkeyperformanceindicators.pdf
- GrowthForce, **The Number One KPI Needed by AEC Firms**: defines `Net Multiplier = Net Operating Revenue / Direct Labor`, describes it as return on direct labor, and cites a healthy AEC range around `2.75` to `3.25`, with an average near `2.99` in the referenced Deltek study.  
  https://www.growthforce.com/blog/the-number-one-kpi-needed-by-aec-firms
- PSMJ, **Case Study: Multiplier Is Above 3.0, So What's the Problem?**: shows why multiplier must be read against overhead and profit. In its example, a `3.19` achieved multiplier barely covers a `3.10` breakeven multiplier because overhead is high.  
  https://go.psmj.com/blog/case-study-multiplier-is-above-3.0-so-whats-the-problem
- Zweig Group, **2025 Financial Performance Report of AEC Firms and Benchmarking Tool**: identifies net service revenue, profitability measures, and labor multipliers as key financial statistics in AEC benchmarking.  
  https://zweiggroup.com/products/2025-financial-performance-report-and-benchmarking-tool

## Implementation Rule

Techniek OpsBoard Pro V2 now uses these formulas:

- `earnedRevenue = billable contract value * project progress %`
- `billableDirectLabor = Î£(logged hours * cost rate)` for billable projects
- `contributionMarginDollars = earnedRevenue - billableDirectLabor`
- `contributionMarginPercent = contributionMarginDollars / earnedRevenue`
- `projectMultiplier = earnedRevenue / billableDirectLabor`
- `contributionMarginPercent = 1 - (1 / projectMultiplier)`
- `projectMultiplier = 1 / (1 - contributionMarginPercent)`
- `portfolioMultiplier = Î£earnedRevenue / Î£billableDirectLabor`
- `budgetBurn = spent / project budget`

`budgetBurn` remains a project-control metric showing how much of the budget has been consumed. It is not a profitability multiplier. The user-facing contribution margin is shown as a percent; dollars are retained internally for alerts and supporting detail.

The default manager target CM is `66.7%`, which is the contribution-margin equivalent of a `3.0x` earned multiplier. In the Projects view, CM is green at or above target, yellow when it is within 10 percentage points below target, and red below that tolerance.

## Range Guidance

Use `3.0x` as the practical A/E benchmark. Treat roughly `2.75x` to `3.25x` as a common healthy operating band when overhead is typical. Values below about `2.6x` to `2.7x` can be below breakeven for firms with typical overhead. Values above `4.0x` to `4.5x` may be possible on specialized, high-realization, or reusable-scope work, but should be treated as high-performing or reviewed for progress/time-entry accuracy rather than assumed as a normal target.

The user-supplied `2.0x` to `4.5x` range is therefore usable as a broad possible range, but the app should not imply that `2.0x` is healthy for a typical A/E firm.

## QA Coverage

`tests/qa.html` group 1 independently re-derives earned revenue, billable direct labor, contribution margin dollars, contribution margin percent, project multiplier, and budget burn from raw cards and resources. Group 1b verifies card detail estimate/logged/progress synchronization. Group 1c verifies the demo benchmark multipliers, the multiplier/CM inverse math, and target CM red/yellow/green classification. Group 4 verifies that portfolio totals roll up the same basis.

