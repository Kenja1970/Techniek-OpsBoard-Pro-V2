# API Reference — Techniek OpsBoard Pro V2

**Version:** 4.0.0

Two programmatic surfaces exist: the browser global `window.TechniekOpsBoard`
and the local PM Specialist proxy's HTTP endpoints.

## 1. Browser API — `window.TechniekOpsBoard`

`window.TechniekOpsBoard` is a compatibility alias of the same object (older QA
and import consumers); prefer `TechniekOpsBoard` in new code.

### Stable public members

| Member | Purpose |
|---|---|
| `version`, `schema` | `APP_VERSION` / `SCHEMA_VERSION` strings |
| `parseFile(text, filename)` | Parse general CSV/TSV/JSON/Markdown task files into normalized PM tasks |
| `parseCesP6Csv(text, filename)` | Parse CES/P6-style WBS CSV/TSV (hierarchy, charge tasks, resources) |

### `_qa` surface

`_qa` exposes the **real production functions** so the QA suite (and any
automation) drives actual code paths. It is not versioned as a public
contract — the internal team may reshape it — but every member currently in
use by `tests/qa.js` must keep working or the suite must be updated in the
same change. Grouped:

**State & lookup** — `state()`, `resetDemo()`, `projectById`, `resourceById`,
`boardCards`, `cardsForProject`, `cardAssignments(cardId)`,
`assignmentSummary(cardId)`, `navIds()`, `uid`, `fmtDate`, `historyTail()`.

**Financial / EVM** — `projectRollup(pid)`, `projectEVM(pid)`,
`programEVM`, `projectFinancialHistory(pid)`, `projectMultiplier(pid)`,
`contributionMarginFromMultiplier`, `multiplierFromContributionMargin`,
`targetContributionMarginRatio`, `contributionMarginStatusClass`,
`setTargetContributionMarginPct(v)`, `cardCost`, `cardCommitted`,
`cardBudget/Consumed/Remaining(cardId)`, `contractValue(pid)`,
`portfolioTotals`, `taskVarianceFlags/Class(cardId)`.

**Schedule / WBS / Kanban** — `criticalPath(boardId)`, `columnIds(boardId)`,
`lastColumnId(boardId)`, `stageProgress(boardId, colId)`,
`moveCardRaw(cardId, colId)`, `rescheduleCardRaw(cardId, deltaDays)`,
`cardMoveValidationMessage`, `dependencyCards/BlockLabel(cardId)`,
`projectWbsElements`, `wbsByCode`, `cardWbsCode`, `isLegacyWbsCode`,
`addWbsElementRaw(pid, w)`, `deleteWbsElementRaw(pid, code)`, `parseWbsCsv`,
`boardWipSummary`, `workflowSummaryRows`, `insights`.

**Registers & governance** — `actionItemsForProject(pid)`,
`deleteActionItemRaw(id)`, `changeOrders()`, `changeOrdersForProject(pid)`,
`coById`, `createCORaw`, `setCOStatusRaw`, `coBudgetImpact`,
`coScheduleImpact`, `attachChangeOrderFileRaw`, `addProjectRaw`,
`deleteProjectRaw`, `addProjectPlanRaw/deleteProjectPlanRaw`,
`addCardRaw`, `setEstimate`.

**Resources** — `resourceUtil(rid)`, `resourceEngagementRollup`,
`importResourcesFromText`, `resourceCsvTemplate`,
`cleanGeneratedResourcePlaceholders()`, `cardResourceShare(cardId, rid)`,
`canManageResourcesFor(role)`, `canFinanceFor(role)`.

**Rules of Credit** — `rulesOfCreditValidation`, `applyRuleOfCredit`,
`ruleUsageCounts`, `add/update/deleteRuleOfCreditRaw`,
`sortedRuleIdsForProject(pid)`, `selectedRuleId()`.

**Metrics & org** — `projectMetricRows`, `selectedMetricRows`,
`projectResourceRows`, `orgUnitOptions()`, `projectOrgUnit(pid)`,
`setProjectOrgUnitRaw(pid, org)`, `isTask3Blocked`.

**PM Advisor** — `advisorFindings()` returns ranked findings
(`{severity, dimension, title, evidence, action, drill}`);
`advisorHealth()` returns `{dimensions{...A–F}, overall{score,grade}, findings}`.

**PM Agent** — `agentParseCommand(text)` → `{actions, matched, intent}`;
`agentActionsFromFindings()`, `agentRebalanceActions()`;
`agentPlan(actions)` → steps with `status` `ok|blocked|invalid`, a `message`,
and a human `describe`; `agentApply(plan)` → `{applied, skipped}` (single
`mutate`, audit-trailed); `agentResolveCard(text)`, `agentResolveResource(text)`.

**Knowledge base** — `kbDocuments()`, `kbSearch(query, limit)` →
`[{passage, score}]` BM25-ranked, `kbPlaybookForFinding(finding)` →
`{doc, passage}`, `kbParseMarkdown(md, filename)`, `kbAddDocRaw(md, filename)`.

**Views** — `viewExists(id)`, `viewIds()`, `navIds()`.

**PM Specialist** *(leave-alone module)* — `pmSpecialistConfig()`,
`setPmSpecialistConfig(endpoint, vectorStoreId)`, `pmSpecialistTabs()`,
`pmSpecialistStoreOnly()`, `buildProjectPromptContext`, `localPmSearch`,
`procedureVersionStatus`, `refreshProcedureStatuses`, `pmAnswerSummary`,
`pmCitationLabel`, `pmCopyText`, `vectorStoreFileName`,
`vectorStoreAllFilesSupported()`, `pmProgressSupported()`.

**Import/export** — `importWbsTasks(projectId, parsed)`,
`exportProjectPackage(projectId)`, `setApiConfig`, `setFabricConnectorUrl`,
`fabricConnectorUrl()`, `setAutoProgressFromKanban(v)`,
`reportPdfAvailable()`, `showNewCardButtonForView`.

## 2. PM Specialist proxy — HTTP endpoints

Base URL: `http://127.0.0.1:8787` (override with `PM_PROXY_PORT`).
Configuration comes from `server/.env.local`; the API key never reaches the
browser. CORS allows `http://127.0.0.1:8081` only.

| Method & path | Body / params | Returns |
|---|---|---|
| `GET /health` | — | `{ok, keyConfigured, vectorStoreId, model}` |
| `GET /api/vector-store/files` | `?vectorStoreId=&limit=&all=1` | Vector-store file rows enriched with filename/bytes/purpose; paginates past 100 when `all=1` |
| `POST /api/vector-store/files` | `{file_id, vectorStoreId?, attributes?}` | Attaches an existing OpenAI file to the store |
| `DELETE /api/vector-store/files/:fileId` | `?vectorStoreId=` | Detaches the file |
| `POST /api/vector-store/upload` | multipart `file` (+ `vectorStoreId`) | Uploads to OpenAI Files (purpose `assistants`) then attaches |
| `POST /api/file-search` | `{question, vectorStoreId?, model?, maxResults?}` | `{outputText, results, raw, storeOnly: true}` — Responses API + `file_search` tool, store-grounded only |
| `GET /api/sharepoint-registry` | — | `{data: [...]}` procedure revision rows |
| `POST /api/sharepoint-registry` | `{data: [...]}` | Overwrites the registry JSON |

**Known production gaps** (see `PRODUCTION-READINESS.md`): endpoints are
unauthenticated on localhost, multipart parsing is hand-rolled, and the
registry write is a whole-file overwrite with no locking.

## 3. Environment variables (proxy)

| Variable | Default | Purpose |
|---|---|---|
| `OPENAI_API_KEY` | — (required) | OpenAI service key; keep only in `server/.env.local` |
| `OPENAI_VECTOR_STORE_ID` | `vs_6a4c…bdb4` | Default vector store for file-search |
| `OPENAI_PM_MODEL` | `gpt-5.5` | Responses API model |
| `PM_PROXY_PORT` | `8787` | Listen port (127.0.0.1 only) |
