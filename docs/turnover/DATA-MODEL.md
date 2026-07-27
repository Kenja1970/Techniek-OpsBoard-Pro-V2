# Data Model — Techniek OpsBoard Pro V2

**Version:** 4.0.0 · **Schema:** `SCHEMA_VERSION` in `app.js` (kept equal to `APP_VERSION`).

## 1. Storage layout

| Key | Store | Contents |
|---|---|---|
| `techniek-opsboard-v2-accounts` | localStorage | `{ users: [{id, displayName, role, hasPass, salt, hash, createdAt}], currentUserId }` |
| `techniek-opsboard-v2::<userId>` | localStorage | One full workspace object per user profile (schema below) |
| `techniek-opsboard-v2` | localStorage | Legacy single-user workspace (migrated into the first profile on first launch) |
| `opsboard-unlocked` | sessionStorage | Passphrase unlock marker for the current browser session |
| `server/data/sharepoint-procedure-registry.json` | disk (proxy) | Procedure revision metadata rows |

Everything else is derived at render time. **There is no server-side workspace
state.** Users move machines via Settings / Data → Export JSON.

## 2. Workspace object

```
{
  version, savedAt, activeBoardId,
  resources[], boards[], portfolios[], programs[], projects[], cards[],
  risks[], issues[], decisions[], actionItems[], changeOrders[],
  resourceEngagements[], resourceAvailability[], imports[], auditTrail[],
  integrationSettings{}, rulesOfCredit[], sharePointProcedures[],
  pmDeliverables[], ragQueries[], vectorStoreFiles[], wbsElements[],
  history[], settings{}
}
```

`migrate()` in `app.js` is the single upgrade path: every new field must get a
default there so pre-existing workspaces load cleanly. Normalizers
(`normalizeWorkItem`, `normalizeResource`, `normalizeProject`,
`normalizeWbsElement`, `normalizeEngagement`) run on every load.

## 3. Entities

### resource
`id, name, role, dept, capacityHrs, costRate, billRate, type (Employee | Subcontractor | Tool / Software | Equipment | Facility | Material | Other), company, unit, status, notes`

### board
`id, name, type, columns: [{id, name, wip}], rosterIds: [resourceId]`
— `wip: 0` means no limit. Column membership of a card IS its Kanban status.

### program / portfolio
`id, name, client|owningOrg, sourceSystem, externalId`

### project
Core: `id, name, client, boardId, programId, portfolioId, projectType, status, budget, billable, billingType (T&M | FP), startDate, endDate, baseline {budget, endDate}`
Integration: `unanetProjectCode, unanetState, unanetUrl, ermasCode, sourceSystem, externalId, orgUnit`
Contract/finance (source-system pattern): `contractNumber, poOrChangeOrderNumber, description, periodOfPerformanceStart/End, multiplier, financialOverride {sourceFile, dataDate, fundedValue, multiplier, targetCostBudget, progressPct, earnedRevenue, billableSpent, actualCost, p6EstimateAtCompletion}, evmOverride, costEACOverride, billEACOverride, fundingProfile[], sourceDocuments[], projectPlans[], utbeaStaffingPass` (marker for the versioned auto-staffing pass; see ARCHITECTURE §4)
— When `financialOverride`/`evmOverride` are present they win over card-derived
rollups (source-system data beats local derivation).

### card (work item)
Identity/placement: `id, boardId, columnId, projectId, title, desc, type, priority, labels[], milestone, order, createdAt`
Schedule: `startDate, due, baselineStart, baselineFinish, scheduleTitle`
Effort/progress: `estimateHours, loggedHours, progress, physicalProgress, progressMode (Manual Physical % | Kanban Stage | Rules of Credit), ruleOfCreditId`
WBS/controls: `outlineNumber, parentId, chargeTask, dependencyWbsCodes[], deps[], dependencyMode, dependencyNote, riskOrBlocker`
Staffing: `assigneeId, resourceAssignments: [{resourceId, allocationPct, role}]` (max 3, normalized; first row drives `assigneeId`), `preparers[], reviewers[], approvers[]` (names from workbook imports)
ERMAS/P6: `ermasBudget, ermasActuals, ermasStart, ermasFinish, p6SourceFile, p6DataDate, p6ActivityName, p6Cpi, p6Spi, p6BaselineLaborUnits, p6ActualLaborUnits, p6PlannedValueLaborUnits, p6EarnedValueLaborUnits, p6BaselineTotalDollars, p6ActualTotalDollars, p6EstimateAtCompletionDollars`
Evidence: `completionEvidence, acceptanceEvidence, evidenceRequired, checklist[], comments[], activity[], importId`

### wbsElement
`id, projectId, wbsCode, title, type (Summary | Activity), parentCode, plannedStart, plannedFinish, remainingDuration, percentComplete, sourceBasis`

### risk
`id, projectId, title, category, probability (1–5), impact (1–5), response (Avoid | Mitigate | Transfer | Accept), ownerId, status, trigger, notes` — score = probability × impact.

### issue / decision
Issue: `id, projectId, title, category, priority, status, ownerId, dueDate, description`
Decision: `id, projectId, title, details, impact, status, proposedBy, proposedDate, approvedBy, approvedDate`
— Both are mirrored into `actionItems` (types `Issue` / `Decision`) which is
the operative register in the UI.

### actionItem
`id, projectId, type, title, status, priority, assigneeId, dueDate, description, objectiveEvidence, evidenceRequired, closeoutDate, source`
— Closure requires objective evidence (enforced in the editor).

### changeOrder
`id, projectId, number, title, category (Scope | Schedule | Budget), description, requestedBy, requestedDate, budgetDelta, scheduleDeltaDays, scopeItems [{title, estimate}], status (Requested | Under Review | Approved | Rejected), decidedDate, decidedBy, notes, applied, createdCardIds[], attachments[]`
— Approving + applying a CO adjusts project budget/end date and creates scope
cards; `baseline` keeps the pre-CO values for variance.

### resourceEngagement / resourceAvailability
Engagement: `id, projectId, resourceId, bucket (Weekly | Monthly | Yearly), periodStart, hours, source`
Availability: `id, resourceId, effectiveDate, weeklyCapacity, calendar`

### imports / auditTrail
Import record: `id, type, filename, projectId, rowCount, importedAt, notes`
Audit entry: `id, ts, actor, entity, entityId, action, detail` — append-only;
all imports, CO decisions, and destructive actions write here.

### rulesOfCredit
`id, name, steps: [{step, incrementPct, mathCheckPct, reportedOutPct}], appliesTo, notes` — steps must sum to 100%; applying a step sets card physical progress and synchronizes logged hours.

### pmDeliverables
Workbook deliverables register.

*Removed in v5.2.0:* `sharePointProcedures`, `vectorStoreFiles`, and
`ragQueries` went with the vector-store RAG. `migrate()` **deletes** them from
older workspaces rather than leaving them orphaned — a stale vector-store id
should not survive in a product with no vector store.

### knowledgeDocs
User-uploaded procedure markdown, parsed with frontmatter and ranked alongside
the built-in corpus. This is where user-supplied procedures actually live.

### settings
`role, theme, compact, targetContributionMarginPct (default 66.7 ≙ 3.0x multiplier), autoProgressFromKanban, wipPolicy, apiEndpoint, apiKey (sk-* values are scrubbed on load), agentEndpoint (default http://127.0.0.1:8787)`

`agentEndpoint` replaced `pmSpecialistEndpoint` in v5.2.0; migration carries the
old value forward under the new name.

### history
Six-week portfolio completion trend `[{week, completed, total}]` seeded at
workspace creation and appended by usage; feeds dashboard/report charts.

## 4. Financial derivation (per project)

1. `cardBudget/Consumed/Remaining` per card from estimate/logged hours ×
   blended assignment rates (or ERMAS budget/actuals when present).
2. `projectRollup` sums cards; `projectEVM` derives PV/EV/AC → CV, SV, CPI,
   SPI, EAC per PMI EVM identities.
3. `financialOverride`/`evmOverride` (source-system data, e.g. an imported P6 schedule-cost extract)
   replace derived values when present.
4. Multiplier ↔ contribution margin: `CM% = (1 − 1/multiplier) × 100`;
   status classes keyed to the target CM setting.
