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

**Agent proxy & procedures** — `agentProxyConfig()`, `setAgentEndpoint(url)`,
`localPmSearch`, `pmProgressSupported()`, `migrateRaw(ws)` (migrates a detached
workspace object so QA can assert schema migrations without touching live
state).

*Removed in v5.2.0 with the vector-store RAG:* `pmSpecialistConfig`,
`setPmSpecialistConfig`, `pmSpecialistTabs`, `pmSpecialistStoreOnly`,
`buildProjectPromptContext`, `procedureVersionStatus`,
`refreshProcedureStatuses`, `pmAnswerSummary`, `pmCitationLabel`, `pmCopyText`,
`vectorStoreFileName`, `vectorStoreAllFilesSupported`.

**Import/export** — `importWbsTasks(projectId, parsed)`,
`exportProjectPackage(projectId)`, `setApiConfig`, `setFabricConnectorUrl`,
`fabricConnectorUrl()`, `setAutoProgressFromKanban(v)`,
`reportPdfAvailable()`, `showNewCardButtonForView`.

## 2. Agent proxy — HTTP endpoints

`server/agent-proxy.mjs`. Base URL `http://127.0.0.1:8787` (override with
`PM_PROXY_PORT`). Configuration comes from `server/.env.local`; the API key
never reaches the browser. CORS is an env-configurable localhost allowlist.

**The whole surface is two endpoints.** Nothing in the default product path
requires the proxy at all.

| Method & path | Body / params | Returns |
|---|---|---|
| `GET /health` | — | `{ok, agent:{configured, baseUrl, model}}` — never echoes the key |
| `POST /api/agent` | `{mode:"interpret"\|"narrate", question, context}` | `{ok, narrative, clarification, actions[], parseError, model}` |

`interpret` turns a request into structured actions; `narrate` turns
already-computed deterministic findings into an executive brief. In both cases
the proxy **only reports what the model returned** — the client re-validates
every action against board governance before anything can be applied.

**Removed in v5.2.0** with the external vector-store RAG: `/api/file-search`,
`GET|POST|DELETE /api/vector-store/files`, `/api/vector-store/upload`, and
`GET|POST /api/sharepoint-registry`. The hand-rolled multipart parser and the
unlocked whole-file registry write went with them, closing two of the gaps
listed in `PRODUCTION-READINESS.md`.

**Remaining production gap:** both endpoints are unauthenticated on localhost.

## 3. Environment variables (proxy)

| Variable | Default | Purpose |
|---|---|---|
| `LLM_BASE_URL` | `https://openrouter.ai/api/v1` | Any OpenAI-compatible `/chat/completions` gateway |
| `LLM_API_KEY` | — (required for AI) | Gateway key; keep only in `server/.env.local` |
| `LLM_MODEL` | — (required for AI) | Model id as the gateway names it |
| `LLM_MAX_TOKENS` | `1500` | Response cap |
| `ALLOWED_ORIGINS` | localhost 8100/8081/8080 | CORS allowlist; never set a public origin |
| `PM_PROXY_PORT` | `8787` | Listen port (127.0.0.1 only) |
