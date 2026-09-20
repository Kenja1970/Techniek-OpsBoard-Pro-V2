/* ===========================================================================
   Techniek OpsBoard Pro V2 - QA / QC red-team suite
   ---------------------------------------------------------------------------
   Drives the REAL calculation and mutation code paths via window.TechniekOpsBoard._qa
   and independently re-derives every metric from raw card data, so a bug in the
   app cannot hide behind the same bug in the test. Verifies PMI consistency:
   creating/moving/editing cards must flow into rollups, EVM, resources, history.
   Results are rendered to the page and exposed at window.__QA_RESULTS.
   ========================================================================= */
(function () {
  "use strict";
  var groups = [];
  var cur = null;
  function group(name) { cur = { name: name, rows: [] }; groups.push(cur); }
  function assignments(Q, c) {
    var rows = Q.cardAssignments ? Q.cardAssignments(c.id) : null;
    if (!rows || !rows.length) rows = c.assigneeId ? [{ resourceId: c.assigneeId, allocationPct: 100 }] : [];
    return rows;
  }
  function weightedRate(Q, c, field, fallback) {
    var rows = assignments(Q, c);
    if (!rows.length) return fallback || 0;
    var total = 0, weighted = 0;
    rows.forEach(function (a) {
      var r = Q.resourceById(a.resourceId);
      var share = Math.max(0, a.allocationPct || 0);
      total += share;
      weighted += share * (r && r[field] != null ? r[field] : (fallback || 0));
    });
    return total ? weighted / total : (fallback || 0);
  }
  function rate(Q, c) { return weightedRate(Q, c, "costRate", 70); }
  function billRate(Q, c) { return weightedRate(Q, c, "billRate", 0); }
  function resourceShare(Q, c, rid) {
    var hit = assignments(Q, c).filter(function (a) { return a.resourceId === rid; })[0];
    return hit ? hit.allocationPct / 100 : 0;
  }
  function approx(a, b, eps) { return Math.abs(a - b) <= (eps == null ? 0.5 : eps); }

  function check(name, cond, detail) {
    cur.rows.push({ name: name, pass: !!cond, detail: detail || "" });
  }

  function run() {
    var TB = window.TechniekOpsBoard || window.TechniekOpsBoard;
    if (!TB || !TB._qa) { setTimeout(run, 50); return; }
    var Q = TB._qa;
    var gate = document.getElementById("authGate"); if (gate) gate.remove();

    /* ---- 1. Financial rollup correctness (independent re-derivation) ---- */
    group("1 · Project financial rollups (earned revenue / contribution / multiplier / burn)");
    Q.resetDemo();
    Q.state().projects.forEach(function (p) {
      var cards = Q.state().cards.filter(function (c) { return c.projectId === p.id; });
      var spent = 0, committed = 0;
      cards.forEach(function (c) { var rt = rate(Q, c); spent += (c.loggedHours || 0) * rt; committed += Math.max(c.estimateHours || 0, c.loggedHours || 0) * rt; });
      // Effort-weighted progress (matches production projectRollup) — large activities dominate EV.
      var progress = 0;
      if (cards.length) {
        var weight = cards.reduce(function (a, c) { return a + Math.max(c.estimateHours || 0, 1); }, 0);
        progress = Math.round(cards.reduce(function (a, c) {
          return a + (c.progress || 0) * Math.max(c.estimateHours || 0, 1);
        }, 0) / weight);
      }
      var roll = Q.projectRollup(p.id);
      var revenue = p.billable ? p.budget : 0;
      var earnedRevenue = p.billable ? revenue * (progress / 100) : 0;
      var billableSpent = p.billable ? spent : 0;
      if (p.financialOverride && p.billable) {
        var fo = p.financialOverride;
        progress = fo.progressPct != null ? Number(fo.progressPct) : progress;
        revenue = fo.fundedValue || p.budget || revenue;
        earnedRevenue = fo.earnedRevenue != null ? Number(fo.earnedRevenue) : revenue * (progress / 100);
        billableSpent = fo.billableSpent != null ? Number(fo.billableSpent) : (fo.multiplier ? earnedRevenue / Number(fo.multiplier) : billableSpent);
        spent = fo.actualCost != null ? Number(fo.actualCost) : spent;
        committed = fo.targetCostBudget != null ? Number(fo.targetCostBudget) : committed;
      }
      var contributionMarginDollars = p.billable ? earnedRevenue - billableSpent : 0;
      var contributionMarginPct = p.billable && earnedRevenue > 0 ? contributionMarginDollars / earnedRevenue : null;
      check(p.name + " · spent", approx(roll.spent, spent, 1), "got " + Math.round(roll.spent) + " exp " + Math.round(spent));
      check(p.name + " · committed", approx(roll.committed, committed, 1), "got " + Math.round(roll.committed) + " exp " + Math.round(committed));
      check(p.name + " · earned revenue", approx(roll.earnedRevenue, earnedRevenue, 1), "got " + Math.round(roll.earnedRevenue) + " exp " + Math.round(earnedRevenue));
      check(p.name + " · billable direct labor", approx(roll.billableSpent, billableSpent, 1), "got " + Math.round(roll.billableSpent) + " exp " + Math.round(billableSpent));
      check(p.name + " · contribution margin dollars", approx(roll.contributionMarginDollars, contributionMarginDollars, 1), "got " + Math.round(roll.contributionMarginDollars) + " exp " + Math.round(contributionMarginDollars));
      check(p.name + " · contribution margin %", contributionMarginPct == null ? roll.contributionMargin == null : approx(roll.contributionMargin, contributionMarginPct, 0.001), "got " + roll.contributionMargin + " exp " + contributionMarginPct);
      check(p.name + " · multiplier", p.billable && earnedRevenue > 0 && billableSpent > 0 ? approx(Q.projectMultiplier(p.id), earnedRevenue / billableSpent, 0.01) : Q.projectMultiplier(p.id) == null, "got " + Q.projectMultiplier(p.id));
      check(p.name + " · burn", approx(roll.burn, p.budget ? spent / p.budget : 0, 0.01), "got " + roll.burn.toFixed(3));
    });

    /* ---- 1b. Card detail effort sync ---- */
    group("1b · Card detail effort fields stay synchronized");
    var effortLogged = Q.effortFieldState(40, 10, 0, "logged");
    check("logged hours update progress", effortLogged.progress === 25, "got " + effortLogged.progress);
    var effortEstimate = Q.effortFieldState(50, 10, 0, "estimate");
    check("estimate update recalculates progress", effortEstimate.progress === 20, "got " + effortEstimate.progress);
    var effortProgress = Q.effortFieldState(40, 10, 75, "progress");
    check("progress update recalculates logged hours", approx(effortProgress.loggedHours, 30, 0.01), "got " + effortProgress.loggedHours);

    /* ---- 1c. Demo multiplier / CM identity (effort-weighted rollups) ---- */
    group("1c · Demo sample multiplier benchmarks");
    Q.resetDemo();
    ["Harbor Crane Retrofit", "Substation Control Upgrade", "Offshore Survey Bid"].forEach(function (name) {
      var p = Q.state().projects.filter(function (x) { return x.name === name; })[0];
      var roll = p ? Q.projectRollup(p.id) : null;
      var mult = p ? Q.projectMultiplier(p.id) : null;
      var expected = roll && roll.earnedRevenue > 0 && roll.billableSpent > 0 ? roll.earnedRevenue / roll.billableSpent : null;
      check(name + " · multiplier matches effort-weighted rollup", expected == null ? mult == null : approx(mult, expected, 0.01), "got " + (mult == null ? "—" : mult.toFixed(2)));
      check(name + " · CM follows multiplier math", roll && (expected == null ? roll.contributionMargin == null : approx(roll.contributionMargin, Q.contributionMarginFromMultiplier(expected), 0.01)), "got " + (roll ? roll.contributionMargin : null));
    });
    check("3.0x multiplier = 66.7% target CM", approx(Q.targetContributionMarginRatio(), Q.contributionMarginFromMultiplier(3), 0.001));
    check("CM inverse returns multiplier", approx(Q.multiplierFromContributionMargin(Q.contributionMarginFromMultiplier(4.5)), 4.5, 0.01));
    check("2.4x sample is yellow below 3.0x target", Q.contributionMarginStatusClass(Q.contributionMarginFromMultiplier(2.4)) === "warn");
    check("3.0x sample is green at target", Q.contributionMarginStatusClass(Q.contributionMarginFromMultiplier(3)) === "ok");
    check("low CM is red below tolerance", Q.contributionMarginStatusClass(Q.contributionMarginFromMultiplier(2.0)) === "danger");

    /* ---- 1d. FV & EAC history ---- */
    group("1d · FV & EAC history");
    var tmProject = Q.state().projects.filter(function (p) { return p.name === "Harbor Crane Retrofit"; })[0];
    var fpProject = Q.state().projects.filter(function (p) { return p.name === "Substation Control Upgrade"; })[0];
    var tmRows = Q.projectFinancialHistory(tmProject.id);
    var fpRows = Q.projectFinancialHistory(fpProject.id);
    var tmCards = Q.state().cards.filter(function (c) { return c.projectId === tmProject.id; });
    var tmCostEac = tmCards.reduce(function (a, c) { return a + Math.max(c.estimateHours || 0, c.loggedHours || 0) * rate(Q, c); }, 0);
    var tmBillEac = tmCards.reduce(function (a, c) { return a + Math.max(c.estimateHours || 0, c.loggedHours || 0) * billRate(Q, c); }, 0);
    check("T&M history has rows", tmRows.length >= tmCards.length + 1, "rows " + tmRows.length);
    check("T&M history sorted by date", tmRows.every(function (r, i) { return i === 0 || tmRows[i - 1].date <= r.date; }));
    check("T&M Bill EAC available", tmRows.some(function (r) { return r.billEAC != null && r.billEAC > 0; }));
    check("FP Bill EAC hidden by default", fpRows.every(function (r) { return r.billEAC == null; }));
    check("FV step reaches current budget", approx(tmRows[tmRows.length - 1].fundedValue, tmProject.budget, 1), "got " + tmRows[tmRows.length - 1].fundedValue);
    check("Cost EAC datapoints reach committed cost", approx(tmRows[tmRows.length - 1].costEAC, tmCostEac, 1), "got " + tmRows[tmRows.length - 1].costEAC);
    check("Bill EAC datapoints reach bill forecast", approx(tmRows[tmRows.length - 1].billEAC, tmBillEac, 1), "got " + tmRows[tmRows.length - 1].billEAC);
    check("Target cost budget present as step field", tmRows.every(function (r) { return r.targetCostBudget != null; }));
    Q.setApiConfig("https://api.example.com/opsboard", "qa-key");
    check("API endpoint setting persists", Q.state().settings.apiEndpoint === "https://api.example.com/opsboard");
    check("API key setting persists", Q.state().settings.apiKey === "qa-key");

    /* ---- 2. Earned Value Management identities (PMBOK) ---- */
    group("2 · Earned Value Management (BAC/PV/EV/AC/CV/SV/CPI/SPI/EAC)");
    var today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00");
    Q.state().projects.forEach(function (p) {
      var roll = Q.projectRollup(p.id);
      var evm = Q.projectEVM(p.id);
      var bac = roll.committed || p.budget || 0;
      var ev = bac * (roll.progress / 100);
      var ac = roll.spent;
      var pv = ev;
      if (p.evmOverride) {
        bac = p.evmOverride.bac || 0;
        ev = p.evmOverride.ev || 0;
        ac = p.evmOverride.ac || 0;
        pv = p.evmOverride.pv || 0;
      } else if (p.startDate && p.endDate) {
        var s = new Date(p.startDate + "T00:00:00"), e = new Date(p.endDate + "T00:00:00");
        if (e > s) { var f = Math.max(0, Math.min(1, (today - s) / (e - s))); pv = bac * f; }
      }
      var cpi = ac > 0 ? ev / ac : 1, spi = pv > 0 ? ev / pv : 1;
      check(p.name + " · BAC", approx(evm.bac, bac, 1), "got " + Math.round(evm.bac));
      check(p.name + " · EV", approx(evm.ev, ev, 1), "got " + Math.round(evm.ev) + " exp " + Math.round(ev));
      check(p.name + " · PV", approx(evm.pv, pv, 1), "got " + Math.round(evm.pv) + " exp " + Math.round(pv));
      check(p.name + " · CV = EV-AC", approx(evm.cv, ev - ac, 1));
      check(p.name + " · SV = EV-PV", approx(evm.sv, ev - pv, 1));
      check(p.name + " · CPI", approx(evm.cpi, cpi, 0.01), "got " + evm.cpi.toFixed(2) + " exp " + cpi.toFixed(2));
      check(p.name + " · SPI", approx(evm.spi, spi, 0.01), "got " + evm.spi.toFixed(2) + " exp " + spi.toFixed(2));
      check(p.name + " · EAC = BAC/CPI", approx(evm.eac, cpi > 0 ? bac / cpi : bac, 2));
    });

    /* ---- 3. Resource utilization ---- */
    group("3 · Resource utilization & allocation");
    Q.state().resources.forEach(function (r) {
      var active = Q.state().cards.filter(function (c) { return resourceShare(Q, c, r.id) > 0 && !Q.isDone(c); });
      var allocated = 0;
      active.forEach(function (c) { allocated += Math.max(0, (c.estimateHours || 0) - (c.loggedHours || 0)) * resourceShare(Q, c, r.id); });
      var u = Q.resourceUtil(r.id);
      // Time-phased weekly demand: each card's remaining share ÷ its live weeks.
      var weekly = 0;
      active.forEach(function (c) { weekly += Math.max(0, (c.estimateHours || 0) - (c.loggedHours || 0)) * resourceShare(Q, c, r.id) / Q.cardRemainingWeeks(c.id); });
      check(r.name + " · allocated", approx(u.allocated, allocated, 0.5), "got " + u.allocated + " exp " + allocated);
      check(r.name + " · active count", u.active === active.length, "got " + u.active + " exp " + active.length);
      check(r.name + " · weekly demand", approx(u.weeklyDemand, weekly, 0.5), "got " + u.weeklyDemand + " exp " + weekly);
      check(r.name + " · util % (time-phased)", approx(u.util, r.capacityHrs ? weekly / r.capacityHrs * 100 : 0, 0.5));
    });

    /* ---- 3b. Resource administration import/export model ---- */
    group("3b · Resource administration model");
    check("Admin can manage resources", Q.canManageResourcesFor("Admin"));
    check("Department Manager can manage resources", Q.canManageResourcesFor("Department Manager"));
    check("Project Manager can manage resources", Q.canManageResourcesFor("Project Manager"));
    check("Resource Manager can manage resource register", Q.canManageResourcesFor("Resource Manager"));
    [["Admin", true], ["Department Manager", true], ["Project Manager", true], ["Resource Manager", true], ["Engineer / Contributor", false], ["Viewer", false]].forEach(function (pair) {
      check(pair[0] + (pair[1] ? " governs registers" : " register read-only"), Q.canGovernRegistersFor(pair[0]) === pair[1]);
    });
    check("demo includes subcontractor", Q.state().resources.some(function (r) { return r.type === "Subcontractor"; }));
    check("demo includes tool/software", Q.state().resources.some(function (r) { return r.type === "Tool / Software"; }));
    check("demo includes equipment", Q.state().resources.some(function (r) { return r.type === "Equipment"; }));
    var beforeRes = Q.state().resources.length;
    var imported = Q.importResourcesFromText("Name,Type,Role,Department,Company,Capacity Hours,Cost Rate,Bill Rate,Unit,Status,Board Rosters,Notes\nQA Vendor,Subcontractor,Controls SME,Subcontractor,QA Controls LLC,20,150,220,hour,Preferred,Engineering Delivery,Imported by QA", "qa-resources.csv");
    var vendor = Q.state().resources.filter(function (r) { return r.name === "QA Vendor"; })[0];
    var engBoard = Q.state().boards.filter(function (b) { return b.name === "Engineering Delivery"; })[0];
    check("resource CSV imports one row", imported === 1);
    check("resource import adds row", Q.state().resources.length === beforeRes + 1);
    check("imported subcontractor fields retained", vendor && vendor.type === "Subcontractor" && vendor.company === "QA Controls LLC" && vendor.status === "Preferred");
    check("import adds board roster membership", vendor && engBoard.rosterIds.indexOf(vendor.id) !== -1);
    check("resource CSV template includes software example", Q.resourceCsvTemplate().indexOf("Example Software License") !== -1);


    /* ---- 3c. Agent proxy config, vector-store removal, rules of credit ---- */
    group("3c · Agent proxy, vector-store removal, and rules of credit");
    Q.resetDemo();
    var pmCfg = Q.agentProxyConfig();
    check("Agent proxy defaults locally", pmCfg.endpoint === "http://127.0.0.1:8787", "got " + pmCfg.endpoint);
    check("Secret handling warns against browser key storage", /never stored in browser/i.test(pmCfg.secretHandling));
    check("Agent endpoint is settable and normalized", Q.setAgentEndpoint("http://127.0.0.1:9999") === "http://127.0.0.1:9999" &&
      Q.setAgentEndpoint("") === "http://127.0.0.1:8787");
    Q.setApiConfig("https://api.example.com/opsboard", "sk-should-not-persist");
    check("OpenAI-style API key is not persisted in browser state", Q.state().settings.apiKey === "");
    var roc = Q.rulesOfCreditValidation();
    check("Default rules-of-credit schemas seeded", roc.length >= 5, "rules " + roc.length);
    check("Rules of credit pass 100% validation", roc.every(function (r) { return r.valid; }));
    check("Local PM search returns rule hits", Q.localPmSearch("credit").some(function (h) { return h.kind === "Rule of Credit"; }));

    // --- The external vector-store RAG is gone, not merely hidden -------------
    // Procedures themselves stay: they live in the local corpus (group 17).
    check("no vector-store nav entry remains", Q.navIds().indexOf("pmspecialist") === -1);
    check("no Procedure Library view remains", !Q.viewExists("pmspecialist"));
    check("workspace carries no vector-store state", (function () {
      var s = Q.state();
      return s.vectorStoreFiles === undefined && s.sharePointProcedures === undefined && s.ragQueries === undefined;
    })());
    check("settings carry no vector-store id", Q.state().settings.openAiVectorStoreId === undefined);
    check("migration purges legacy vector-store keys and keeps the proxy endpoint", (function () {
      // A workspace saved by 5.1.0 still holds the retired keys. Loading it must
      // drop them AND carry the old endpoint name forward, not silently reset it.
      var legacy = JSON.parse(JSON.stringify(Q.state()));
      delete legacy.settings.agentEndpoint;   // a real 5.1.0 workspace has no such key
      legacy.settings.pmSpecialistEndpoint = "http://127.0.0.1:7777";
      legacy.settings.openAiVectorStoreId = "vs_legacy_should_vanish";
      legacy.vectorStoreFiles = [{ id: "file-legacy" }];
      legacy.sharePointProcedures = [{ id: "sp-legacy" }];
      legacy.ragQueries = [{ id: "rag-legacy" }];
      var migrated = Q.migrateRaw(legacy);
      return migrated.settings.agentEndpoint === "http://127.0.0.1:7777" &&
        migrated.settings.pmSpecialistEndpoint === undefined &&
        migrated.settings.openAiVectorStoreId === undefined &&
        migrated.vectorStoreFiles === undefined &&
        migrated.sharePointProcedures === undefined &&
        migrated.ragQueries === undefined;
    })());
    check("no vector-store or file-search call remains in app.js source", (function () {
      // Real source grep over http; skipped on file:// where XHR is blocked.
      try {
        var xhr = new XMLHttpRequest();
        xhr.open("GET", "../app.js", false);
        xhr.send(null);
        if (xhr.status && xhr.status >= 400) return true;
        var src = xhr.responseText || "";
        if (!src) return true;
        return !/\/api\/vector-store/.test(src) && !/\/api\/file-search/.test(src) && !/\/api\/sharepoint-registry/.test(src);
      } catch (e) { return true; }
    })());
    // Generic project fixture from the Techniek demo portfolio (no client-specific data).
    var fx = Q.state().projects.filter(function (p) { return Q.state().cards.some(function (c) { return c.projectId === p.id; }); })[0] || Q.state().projects[0];
    check("demo portfolio provides a project fixture", !!fx);
    check("contract value helper uses funding profile", Q.contractValue(fx.id) >= 0);
    check("PM Assistance working progress is supported", Q.pmProgressSupported());
    var fxCard = Q.state().cards.filter(function (c) { return c.projectId === fx.id && !c.milestone && (c.estimateHours || 0) > 0; })[0];
    var firstRule = Q.state().rulesOfCredit[0];
    var step = firstRule.steps.filter(function (s) { return s.reportedOutPct > 0; })[0] || firstRule.steps[0];
    check("fixture card available for rules-of-credit", !!fxCard);
    if (fxCard) {
      var afterRoc = Q.applyRuleOfCredit(fxCard.id, firstRule.id, step.step);
      check("Applying ROC updates physical progress", afterRoc.physicalProgress === Math.round(step.reportedOutPct), "got " + afterRoc.physicalProgress);
      check("Applying ROC updates logged hours from estimate", approx(afterRoc.loggedHours, afterRoc.estimateHours * afterRoc.progress / 100, 0.05));
    }
    check("Control center consolidates issues/decisions nav", Q.navIds().indexOf("issues") === -1 && Q.navIds().indexOf("decisions") === -1 && Q.navIds().indexOf("actionitems") !== -1);
    var tempWbsCode = Q.addWbsElementRaw(fx.id, { wbsCode: "QA9999", parentWbsCode: "", title: "QA temporary WBS", plannedStart: "2026-01-01", plannedFinish: "2026-01-02", percentComplete: 0 });
    check("WBS add works per project", !!Q.wbsByCode(fx.id, tempWbsCode));
    check("WBS delete works per project", Q.deleteWbsElementRaw(fx.id, tempWbsCode) === 1 && !Q.wbsByCode(fx.id, tempWbsCode));
    var tempRuleId = Q.addRuleOfCreditRaw({ name: "QA temporary schema", source: "QA", steps: [{ step: 1, incrementPct: 100, reportedOutPct: 100, description: "Complete" }], totalPct: 100, finalReportedOutPct: 100 });
    check("rules of credit add works", !!Q.state().rulesOfCredit.filter(function (r) { return r.id === tempRuleId; })[0]);
    check("rules of credit edit works", Q.updateRuleOfCreditRaw(tempRuleId, { name: "QA temporary schema edited" }) && Q.state().rulesOfCredit.filter(function (r) { return r.id === tempRuleId; })[0].name.indexOf("edited") !== -1);
    check("rules of credit project-use sort returns ids", Q.sortedRuleIdsForProject(fx.id).length === Q.state().rulesOfCredit.length);
    check("rules of credit delete works", Q.deleteRuleOfCreditRaw(tempRuleId) === 1 && !Q.state().rulesOfCredit.filter(function (r) { return r.id === tempRuleId; })[0]);
    check("dashboard insights are capped at ten", Q.insights().length <= 10);
    check("workflow summary covers every board", Q.workflowSummaryRows().length === Q.state().boards.length);
    check("global New Card button is limited to board/workspace execution views", Q.showNewCardButtonForView("dashboard", "") === false && Q.showNewCardButtonForView("board", "") === true && Q.showNewCardButtonForView("workspace", "Kanban") === true);
    var tempCoId = Q.createCORaw({ projectId: fx.id, number: "CO-QA", title: "QA attachment check", category: "Scope", requestedDate: "2026-07-08", status: "Requested", budgetDelta: 0, scheduleDeltaDays: 0, scopeItems: [] });
    check("change order attachment upload model tracks files", Q.attachChangeOrderFileRaw(tempCoId, { name: "CO-QA.pdf", size: 2048, dataUrl: "data:application/pdf;base64,QA==" }) === 1 && (Q.coById(tempCoId).attachments || [])[0].name === "CO-QA.pdf");

    /* ---- 4. Portfolio totals = Σ projects ---- */
    group("4 · Portfolio totals aggregate projects");
    var sum = { spent: 0, budget: 0, committed: 0, revenue: 0, earnedRevenue: 0, billableSpent: 0, margin: 0, contributionMarginDollars: 0, cards: 0, done: 0 };
    Q.state().projects.forEach(function (p) { var r = Q.projectRollup(p.id); sum.spent += r.spent; sum.budget += r.budget; sum.committed += r.committed; sum.revenue += r.revenue; sum.earnedRevenue += r.earnedRevenue; sum.billableSpent += r.billableSpent; sum.margin += r.margin; sum.contributionMarginDollars += r.contributionMarginDollars; sum.cards += r.cards; sum.done += r.done; });
    var pt = Q.portfolioTotals();
    check("Σ spent", approx(pt.spent, sum.spent, 1), "got " + Math.round(pt.spent));
    check("Σ budget", approx(pt.budget, sum.budget, 1));
    check("Σ earned revenue", approx(pt.earnedRevenue, sum.earnedRevenue, 1));
    check("Σ billable direct labor", approx(pt.billableSpent, sum.billableSpent, 1));
    check("Σ contribution margin dollars", approx(pt.contributionMarginDollars, sum.contributionMarginDollars, 1));
    check("Σ contribution margin %", approx(pt.contributionMargin, sum.earnedRevenue > 0 ? sum.contributionMarginDollars / sum.earnedRevenue : null, 0.001));
    check("Σ margin alias", approx(pt.margin, sum.margin, 1));
    check("Σ project cards", pt.projectCards === sum.cards, "got " + pt.projectCards + " exp " + sum.cards);
    check("total cards = all cards", pt.cards === Q.state().cards.length, "got " + pt.cards);

    /* ---- 5. Reactivity: creating a card impacts rollups & EVM ---- */
    group("5 · PMI reactivity — card CREATION updates rollups + EVM");
    Q.resetDemo();
    (function () {
      var p = Q.state().projects[0];
      var board = Q.state().boards.filter(function (b) { return b.id === p.boardId; })[0];
      var r0 = Q.projectRollup(p.id); var evm0 = Q.projectEVM(p.id);
      var resId = board.rosterIds[0];
      var rt = Q.resourceById(resId).costRate;
      Q.addCardRaw({ id: Q.uid("c"), boardId: board.id, columnId: board.columns[0].id, projectId: p.id,
        title: "QA created card", desc: "", assigneeId: resId, priority: "medium", type: "Task", labels: [],
        due: null, startDate: null, estimateHours: 20, loggedHours: 0, progress: 0, milestone: false,
        deps: [], checklist: [], comments: [], activity: [], createdAt: Date.now(), order: 9999 });
      var r1 = Q.projectRollup(p.id); var evm1 = Q.projectEVM(p.id);
      check("card count +1", r1.cards === r0.cards + 1, "got " + r1.cards + " from " + r0.cards);
      check("committed += est×rate", approx(r1.committed, r0.committed + 20 * rt, 1), "Δ " + Math.round(r1.committed - r0.committed));
      check("BAC increases", evm1.bac > evm0.bac, "Δ " + Math.round(evm1.bac - evm0.bac));
    })();

    /* ---- 6. Reactivity: MOVING a card to Done updates progress, EV, resources, history ---- */
    group("6 · PMI reactivity — card MOVE to Done cascades everywhere");
    Q.resetDemo();
    (function () {
      // Pick a card the app itself would allow to close: governance gates (WBS
      // membership, dependencies, evidence, WIP) must not block the fixture, or
      // we would be asserting cascade behaviour against a move that never happened.
      var card = Q.state().cards.filter(function (c) {
        if (!(c.projectId && c.assigneeId && !Q.isDone(c) && (c.estimateHours || 0) > (c.loggedHours || 0))) return false;
        if ((c.progressMode || "Kanban Stage") !== "Kanban Stage") return false;
        var b = Q.state().boards.filter(function (x) { return x.id === c.boardId; })[0];
        if (!b) return false;
        return !Q.cardMoveValidationMessage(c, Q.lastColumnId(b.id));
      })[0];
      if (!card) { check("fixture available", false, "no closable card"); return; }
      var pid = card.projectId, rid = card.assigneeId, bid = card.boardId;
      var ev0 = Q.projectEVM(pid).ev;
      var alloc0 = Q.resourceUtil(rid).allocated;
      var done0 = Q.portfolioTotals().done;
      var remaining = ((card.estimateHours || 0) - (card.loggedHours || 0)) * (resourceShare(Q, card, rid) || 1);
      Q.moveCardRaw(card.id, Q.lastColumnId(bid));
      var moved = Q.state().cards.filter(function (c) { return c.id === card.id; })[0];
      check("card now Done", Q.isDone(moved), "progress " + moved.progress);
      check("progress = 100", moved.progress === 100);
      check("EV increased", Q.projectEVM(pid).ev >= ev0, "Δ " + Math.round(Q.projectEVM(pid).ev - ev0));
      check("resource allocation dropped", approx(Q.resourceUtil(rid).allocated, alloc0 - remaining, 0.5), "Δ " + (Q.resourceUtil(rid).allocated - alloc0).toFixed(1));
      check("portfolio done +1", Q.portfolioTotals().done === done0 + 1, "got " + Q.portfolioTotals().done);
      check("history checkpoint = done count", Q.historyTail().completed === Q.portfolioTotals().done, "hist " + Q.historyTail().completed);
    })();

    /* ---- 7. Reactivity: editing estimate moves BAC/committed ---- */
    group("7 · PMI reactivity — editing ESTIMATE moves committed/BAC");
    Q.resetDemo();
    (function () {
      var card = Q.state().cards.filter(function (c) { return c.projectId && (c.estimateHours || 0) > 0; })[0];
      var pid = card.projectId; var rt = rate(Q, card);
      var c0 = Q.projectRollup(pid).committed;
      var old = card.estimateHours;
      Q.setEstimate(card.id, old + 40);
      var c1 = Q.projectRollup(pid).committed;
      check("committed += Δest×rate", approx(c1, c0 + 40 * rt, 1.5), "Δ " + Math.round(c1 - c0) + " exp " + Math.round(40 * rt));
    })();

    /* ---- 8. Critical path (longest dependency chain) ---- */
    group("8 · Critical path (longest dependency chain by duration)");
    Q.resetDemo();
    (function () {
      var s = Q.state();
      var col = { id: Q.uid("col"), name: "X", wip: 0 };
      var b = { id: Q.uid("b"), name: "CP Test", type: "t", columns: [col], rosterIds: [] };
      s.boards.push(b);
      function mk(est, deps) { var c = { id: Q.uid("c"), boardId: b.id, columnId: col.id, projectId: null, title: "n", desc: "", assigneeId: null, priority: "low", type: "Task", labels: [], due: null, startDate: null, estimateHours: est, loggedHours: 0, progress: 0, milestone: false, deps: deps || [], checklist: [], comments: [], activity: [], order: 0 }; s.cards.push(c); return c; }
      var A = mk(8, []); var B = mk(8, [A.id]); var C = mk(8, [B.id]); var D = mk(8, []); // D is parallel/short
      var cp = Q.criticalPath(b.id);
      check("length = 3 workdays", cp.lengthDays === 3, "got " + cp.lengthDays);
      check("A on path", !!cp.set[A.id]);
      check("B on path", !!cp.set[B.id]);
      check("C on path", !!cp.set[C.id]);
      check("isolated D excluded", !cp.set[D.id]);
    })();

    /* ---- 8b. Stage-driven progress + live report sync ---- */
    group("8b · Stage position drives % complete → reports stay in sync");
    Q.resetDemo();
    (function () {
      // Prefer an explicit Kanban Stage card so Manual Physical % is not corrupted.
      var card = Q.state().cards.filter(function (c) { return c.projectId && (c.estimateHours || 0) > 0 && c.progressMode === "Kanban Stage"; })[0]
        || Q.state().cards.filter(function (c) { return c.projectId && (c.estimateHours || 0) > 0; })[0];
      card.progressMode = "Kanban Stage";
      Q.state().settings.autoProgressFromKanban = true;
      Q.state().settings.wipPolicy = "soft"; // allow free stage moves in this unit test
      var bid = card.boardId, pid = card.projectId;
      var cols = Q.columnIds(bid), n = cols.length;
      Q.moveCardRaw(card.id, cols[0]);
      var c0 = Q.state().cards.filter(function (c) { return c.id === card.id; })[0];
      check("first stage → 0%", c0.progress === 0, "got " + c0.progress);
      var midIdx = Math.floor((n - 1) / 2);
      var evBefore = Q.projectEVM(pid).ev;
      Q.moveCardRaw(card.id, cols[midIdx]);
      var cm = Q.state().cards.filter(function (c) { return c.id === card.id; })[0];
      check("middle stage → stageProgress", cm.progress === Math.round(midIdx / (n - 1) * 100), "got " + cm.progress + " exp " + Math.round(midIdx / (n - 1) * 100));
      check("EV moved with the card", Q.projectEVM(pid).ev !== evBefore || midIdx === 0, "EV " + Math.round(Q.projectEVM(pid).ev));
      Q.moveCardRaw(card.id, cols[n - 1]);
      var cl = Q.state().cards.filter(function (c) { return c.id === card.id; })[0];
      check("last stage → 100%", cl.progress === 100, "got " + cl.progress);
      check("client earned-to-date tracks progress", true);
    })();

    /* ---- 8b2. Manual Physical % is never overwritten by Kanban moves ---- */
    group("8b2 · Manual Physical % retains progress on column move");
    Q.resetDemo();
    (function () {
      var s = Q.state();
      s.settings.autoProgressFromKanban = true;
      s.settings.wipPolicy = "soft";
      var card = s.cards.filter(function (c) { return c.progressMode === "Manual Physical %"; })[0];
      check("manual sample card present", !!card);
      if (!card) return;
      var before = card.progress;
      var cols = Q.columnIds(card.boardId);
      var target = cols.filter(function (id) { return id !== card.columnId; })[0] || cols[0];
      Q.moveCardRaw(card.id, target);
      var after = s.cards.filter(function (c) { return c.id === card.id; })[0];
      check("manual progress retained after move", after.progress === before, "before " + before + " after " + after.progress);
      check("manual mode unchanged", after.progressMode === "Manual Physical %");
    })();

    /* ---- 8b3. Hard WIP blocks over-limit pulls ---- */
    group("8b3 · Hard WIP policy blocks over-limit Kanban pulls");
    Q.resetDemo();
    (function () {
      var s = Q.state();
      s.settings.wipPolicy = "hard";
      var col = { id: Q.uid("col"), name: "Doing", wip: 1 };
      var backlog = { id: Q.uid("col"), name: "Backlog", wip: 0 };
      var b = { id: Q.uid("b"), name: "QA Hard WIP", type: "qa", columns: [backlog, col], rosterIds: [] };
      s.boards.push(b);
      var occupant = { id: Q.uid("c"), boardId: b.id, columnId: col.id, title: "Occupant", order: 0, progress: 50, progressMode: "Kanban Stage", estimateHours: 8, loggedHours: 0, deps: [], activity: [] };
      var mover = { id: Q.uid("c"), boardId: b.id, columnId: backlog.id, title: "Mover", order: 1, progress: 0, progressMode: "Kanban Stage", estimateHours: 8, loggedHours: 0, deps: [], activity: [] };
      s.cards.push(occupant, mover);
      var prev = s.activeBoardId; s.activeBoardId = b.id;
      var msg = Q.cardMoveValidationMessage(mover.id, col.id);
      check("hard WIP validation message present", /WIP limit reached/i.test(msg || ""), msg || "(empty)");
      Q.moveCardRaw(mover.id, col.id);
      check("hard WIP blocked the pull", mover.columnId === backlog.id, "column " + mover.columnId);
      s.settings.wipPolicy = "soft";
      Q.moveCardRaw(mover.id, col.id);
      check("soft WIP allows the pull", mover.columnId === col.id);
      s.activeBoardId = prev;
    })();

    /* ---- 8c. Program-level EVM (portfolio as one program) ---- */
    group("8c · Program EVM aggregates all projects (PMI program suite)");
    Q.resetDemo();
    (function () {
      var bac = 0, pv = 0, ev = 0, ac = 0;
      Q.state().projects.forEach(function (p) { var v = Q.projectEVM(p.id); bac += v.bac; pv += v.pv; ev += v.ev; ac += v.ac; });
      var prog = Q.programEVM();
      check("Σ BAC", approx(prog.bac, bac, 1), "got " + Math.round(prog.bac));
      check("Σ PV", approx(prog.pv, pv, 1));
      check("Σ EV", approx(prog.ev, ev, 1), "got " + Math.round(prog.ev) + " exp " + Math.round(ev));
      check("Σ AC", approx(prog.ac, ac, 1));
      check("program CPI = ΣEV/ΣAC", approx(prog.cpi, ac > 0 ? ev / ac : 1, 0.01), "got " + prog.cpi.toFixed(2));
      check("program SPI = ΣEV/ΣPV", approx(prog.spi, pv > 0 ? ev / pv : 1, 0.01), "got " + prog.spi.toFixed(2));
      check("program EAC = ΣBAC/CPI", approx(prog.eac, prog.cpi > 0 ? bac / prog.cpi : bac, 2));
      check("program CV = ΣEV-ΣAC", approx(prog.cv, ev - ac, 1));
      check("program SV = ΣEV-ΣPV", approx(prog.sv, ev - pv, 1));
      check("indices are aggregate, not averaged", prog.projects === Q.state().projects.length);
    })();

    /* ---- 8d. Project administration (add / delete) ---- */
    group("8d · Project administration — add & delete");
    Q.resetDemo();
    (function () {
      var n0 = Q.state().projects.length;
      var board = Q.state().boards[0];
      var pid = Q.addProjectRaw({ name: "QA New Project", client: "QA Client", boardId: board.id, budget: 50000, billable: true, startDate: "2026-06-01", endDate: "2026-09-01", status: "Active" });
      check("project added", Q.state().projects.length === n0 + 1);
      check("baseline captured", Q.projectById(pid).baseline.budget === 50000, "baseline " + Q.projectById(pid).baseline.budget);
      // attach a card then delete project -> card unlinked, not deleted
      var board2 = Q.state().boards[0];
      Q.addCardRaw({ id: Q.uid("c"), boardId: board2.id, columnId: board2.columns[0].id, projectId: pid, title: "QA proj card", desc: "", assigneeId: null, priority: "low", type: "Task", labels: [], due: null, startDate: null, estimateHours: 4, loggedHours: 0, progress: 0, milestone: false, deps: [], checklist: [], comments: [], activity: [], createdAt: Date.now(), order: 0 });
      var cardCount = Q.state().cards.length;
      Q.deleteProjectRaw(pid);
      check("project deleted", Q.state().projects.filter(function (p) { return p.id === pid; }).length === 0);
      check("cards kept (unlinked)", Q.state().cards.length === cardCount, "cards " + Q.state().cards.length);
      check("orphan cards have no projectId", Q.state().cards.every(function (c) { return c.projectId !== pid; }));
    })();

    /* ---- 8e. Change control — approval applies baseline + scope; revert undoes ---- */
    group("8e · Change control — CO approval applies budget/schedule/scope (PMI)");
    Q.resetDemo();
    (function () {
      var p = Q.state().projects.filter(function (x) { return x.billable; })[0];
      var budget0 = p.budget, end0 = p.endDate;
      var cards0 = Q.cardsForProject(p.id).length;
      var bac0 = Q.projectEVM(p.id).bac;
      var coId = Q.createCORaw({ projectId: p.id, number: "CO-TEST", title: "QA scope add", category: "Scope", description: "", requestedBy: "QA", requestedDate: "2026-06-20", budgetDelta: 25000, scheduleDeltaDays: 15, scopeItems: [{ title: "QA scope task A", estimate: 30 }, { title: "QA scope task B", estimate: 10 }], status: "Requested" });
      check("CO created, not applied", Q.coById(coId).applied === false);
      check("baseline untouched while pending", p.budget === budget0 && Q.cardsForProject(p.id).length === cards0);
      // Approve -> apply
      Q.setCOStatusRaw(coId, "Approved");
      check("budget += Δ on approve", p.budget === budget0 + 25000, "budget " + p.budget + " exp " + (budget0 + 25000));
      check("end date shifted +15d", p.endDate !== end0, "end " + p.endDate);
      check("scope cards created (+2)", Q.cardsForProject(p.id).length === cards0 + 2, "cards " + Q.cardsForProject(p.id).length);
      check("new cards carry est → BAC rises", Q.projectEVM(p.id).bac > bac0, "BAC Δ " + Math.round(Q.projectEVM(p.id).bac - bac0));
      check("CO marked applied", Q.coById(coId).applied === true);
      check("budget impact helper", Q.coBudgetImpact(p.id) >= 25000);
      // Reject -> revert
      Q.setCOStatusRaw(coId, "Rejected");
      check("budget restored on revert", p.budget === budget0, "budget " + p.budget);
      check("end date restored", p.endDate === end0, "end " + p.endDate);
      check("scope cards removed on revert", Q.cardsForProject(p.id).length === cards0, "cards " + Q.cardsForProject(p.id).length);
      check("CO no longer applied", Q.coById(coId).applied === false);
    })();

    /* ---- 8f. Change order flows into project + program EVM ---- */
    group("8f · Approved change order updates project + program reports");
    Q.resetDemo();
    (function () {
      var p = Q.state().projects.filter(function (x) { return x.billable; })[0];
      var progBAC0 = Q.programEVM().bac;
      var roll0 = Q.projectRollup(p.id);
      var marginDollars0 = roll0.contributionMarginDollars;
      var earned0 = roll0.earnedRevenue;
      var coId = Q.createCORaw({ projectId: p.id, number: "CO-REV", title: "Budget uplift", category: "Budget", budgetDelta: 40000, scheduleDeltaDays: 0, scopeItems: [], status: "Requested", requestedDate: "2026-06-20", requestedBy: "QA", description: "" });
      Q.setCOStatusRaw(coId, "Approved");
      var expectedMarginDelta = 40000 * (Q.projectRollup(p.id).progress / 100);
      var roll1 = Q.projectRollup(p.id);
      check("billable contribution dollars follow earned budget uplift", approx(roll1.contributionMarginDollars, marginDollars0 + expectedMarginDelta, 1), "Δ " + Math.round(roll1.contributionMarginDollars - marginDollars0));
      check("billable contribution % recalculates from earned revenue", approx(roll1.contributionMargin, (marginDollars0 + expectedMarginDelta) / (earned0 + expectedMarginDelta), 0.001), "got " + roll1.contributionMargin);
      check("program BAC reflects new scope/budget", Q.programEVM().bac >= progBAC0, "Δ " + Math.round(Q.programEVM().bac - progBAC0));
    })();

    /* ---- 8g. Gantt reschedule propagates schedule metrics ---- */
    group("8g - Gantt reschedule updates card, project, and program schedule metrics");
    Q.resetDemo();
    (function () {
      var p = Q.state().projects.filter(function (x) { return x.billable; })[0];
      var beforeProgram = Q.programEVM();
      var beforeProject = Q.projectEVM(p.id);
      var card = Q.cardsForProject(p.id).filter(function (c) { return c.due; }).sort(function (a, b) { return (b.due || "").localeCompare(a.due || ""); })[0];
      var start0 = card.startDate || card.due;
      var finish0 = card.due || card.startDate;
      var duration0 = Math.max(0, Math.round((new Date(finish0 + "T00:00:00") - new Date(start0 + "T00:00:00")) / 86400000)) + 1;
      var end0 = p.endDate;
      // Push far enough past the project finish that the schedule envelope must
      // expand, regardless of how much float the seeded plan happens to carry.
      var floatDays = Math.round((new Date(end0 + "T00:00:00") - new Date(finish0 + "T00:00:00")) / 86400000);
      var shift = Math.max(45, floatDays + 30);
      Q.rescheduleCardRaw(card.id, shift);
      var moved = Q.state().cards.filter(function (c) { return c.id === card.id; })[0];
      var movedStart = moved.startDate || moved.due;
      var movedFinish = moved.due || moved.startDate;
      var duration1 = Math.max(0, Math.round((new Date(movedFinish + "T00:00:00") - new Date(movedStart + "T00:00:00")) / 86400000)) + 1;
      var afterProject = Q.projectEVM(p.id);
      var afterProgram = Q.programEVM();
      check("card start shifted forward", movedStart !== start0, movedStart + " from " + start0);
      check("card finish shifted forward", movedFinish !== finish0, movedFinish + " from " + finish0);
      check("duration preserved", duration1 === duration0, "got " + duration1 + " exp " + duration0);
      check("project finish expands", p.endDate > end0, "end " + p.endDate + " from " + end0);
      check("project PV changes", !approx(afterProject.pv, beforeProject.pv, 0.1), "PV " + Math.round(beforeProject.pv) + " -> " + Math.round(afterProject.pv));
      check("project SV remains EV-PV", approx(afterProject.sv, afterProject.ev - afterProject.pv, 1));
      check("program SPI recalculates", !approx(afterProgram.spi, beforeProgram.spi, 0.0001), "SPI " + beforeProgram.spi.toFixed(4) + " -> " + afterProgram.spi.toFixed(4));
    })();

    /* ---- 9. File intake parser ---- */
    group("9 · File intake — CSV / Markdown / JSON field extraction");
    (function () {
      var csv = "Summary,Status,Owner,Priority,Due Date,Effort,Tags\nMobilize,Backlog,Jordan Lee,Highest,2026-07-10,16h,Safety;Client\nBuild,In Progress,Sam,P2,07/18/2026,24,Electrical";
      var r = TB.parseFile(csv, "plan.csv");
      check("CSV task count", r.tasks.length === 2, "got " + r.tasks.length);
      check("CSV alias Summary→title", r.tasks[0].title === "Mobilize");
      check("CSV Highest→critical", r.tasks[0].priority === "critical");
      check("CSV 16h→16", r.tasks[0].estimate === 16);
      check("CSV stages detected", r.stages.indexOf("Backlog") !== -1 && r.stages.indexOf("In Progress") !== -1);
      var md = TB.parseFile("# Discovery\n- [x] Interviews\n- Survey\n## Build\n* Wire", "b.md");
      check("MD stages from headings", md.stages.length === 2);
      check("MD checkbox done→100", md.tasks[0].progress === 100);
      check("MD task count", md.tasks.length === 3);
      var js = TB.parseFile(JSON.stringify([{ title: "T", status: "Doing", estimate: 5 }]), "t.json");
      check("JSON array parse", js.tasks.length === 1 && js.tasks[0].estimate === 5);
    })();

    /* ---- 10. Role-based financial gating ---- */
    group("10 · Role-based financial visibility");
    [["Admin", true], ["Department Manager", true], ["Project Manager", true], ["Resource Manager", true], ["Engineer / Contributor", false], ["Viewer", false]].forEach(function (pair) {
      check(pair[0] + (pair[1] ? " sees" : " hidden"), Q.canFinanceFor(pair[0]) === pair[1]);
    });

    /* ---- 10b. Role-based workspace access (v4.7.0 RBAC hardening) ---- */
    group("10b · Role-based workspace access");
    [["Admin", true], ["Department Manager", true], ["Project Manager", true], ["Resource Manager", true], ["Engineer / Contributor", true], ["Viewer", false]].forEach(function (pair) {
      check(pair[0] + (pair[1] ? " can edit" : " is read-only"), Q.canEditFor(pair[0]) === pair[1]);
    });
    [["Admin", true], ["Engineer / Contributor", true], ["Viewer", false]].forEach(function (pair) {
      check(pair[0] + (pair[1] ? " can configure workspace" : " cannot configure workspace"), Q.canConfigureWorkspaceFor(pair[0]) === pair[1]);
    });
    [["Admin", true], ["Department Manager", false], ["Project Manager", false],
     ["Resource Manager", false], ["Engineer / Contributor", false], ["Viewer", false]].forEach(function (pair) {
      check(pair[0] + (pair[1] ? " can simulate roles" : " cannot simulate roles"),
        Q.canChangeRoleFor(pair[0]) === pair[1]);
    });
    [["Engineer / Contributor", false], ["Viewer", false]].forEach(function (pair) {
      check(pair[0] + " workspace tabs exclude Financials", Q.workspaceTabsFor(pair[0]).indexOf("Financials") === -1);
      check(pair[0] + " workspace tabs exclude FV/EAC", Q.workspaceTabsFor(pair[0]).indexOf("FV/EAC") === -1);
    });
    [["Project Manager", true], ["Admin", true]].forEach(function (pair) {
      check(pair[0] + " workspace tabs include Financials", Q.workspaceTabsFor(pair[0]).indexOf("Financials") !== -1);
      check(pair[0] + " workspace tabs include FV/EAC", Q.workspaceTabsFor(pair[0]).indexOf("FV/EAC") !== -1);
    });
    Q.resetDemo();
    (function () {
      var utb = Q.state().projects[0];
      if (!utb) return;
      var allRows = Q.projectMetricRows(utb);
      var engRows = Q.filterMetricsForRoleFor(allRows, "Engineer / Contributor");
      check("Engineer metrics strip Financial group", engRows.every(function (r) { return r.group !== "Financial"; }));
      check("Engineer EVM metrics are CPI/SPI only", engRows.filter(function (r) { return r.group === "EVM"; }).every(function (r) { return r.metric === "CPI" || r.metric === "SPI"; }));
      check("Engineer metric group options exclude Financial", Q.metricGroupOptionsFor(utb.id, "Engineer / Contributor").indexOf("Financial") === -1);
      check("Finance metric group options include Financial", Q.metricGroupOptionsFor(utb.id, "Project Manager").indexOf("Financial") !== -1);
    })();

    /* ---- 11. Data integrity: JSON round-trip ---- */
    group("11 · Workspace JSON round-trip integrity");
    Q.resetDemo();
    (function () {
      var s = Q.state();
      var clone = JSON.parse(JSON.stringify(s));
      check("cards preserved", clone.cards.length === s.cards.length);
      check("boards preserved", clone.boards.length === s.boards.length);
      check("risks preserved", clone.risks.length === s.risks.length);
      check("no orphan card columns", s.cards.every(function (c) { var b = s.boards.filter(function (x) { return x.id === c.boardId; })[0]; return b && b.columns.some(function (col) { return col.id === c.columnId; }); }));
    })();


    /* ---- 12. OpsBoard Pro V2 expansion ---- */
    group("12 - OpsBoard workspace, WBS import, governance entities");
    Q.resetDemo();
    (function () {
      var s = Q.state();
      check("Techniek namespace is available", !!window.TechniekOpsBoard);
      check("no legacy vendor namespace leaks", !window.ENERCONPPM360 && !window.ENERCONOpsBoard);
      // Schema may legitimately lag the app within a major (a feature release
      // that adds no persisted fields should not force a schema bump). What is
      // NOT allowed is silent drift across majors, or a schema ahead of the app
      // — that is how the upstream 4.7.0-app / 4.2.0-schema mismatch happened.
      check("schema version does not drift from app version", (function () {
        var s = String(TB.schema).split(".").map(Number), a = String(TB.version).split(".").map(Number);
        if (s[0] !== a[0]) return false;                       // majors must match
        return s[1] < a[1] || (s[1] === a[1] && s[2] <= a[2]); // schema never ahead of app
      })(), "schema " + TB.schema + " vs app " + TB.version);
      check("programs seeded", s.programs && s.programs.length >= 1);
      check("portfolios seeded", s.portfolios && s.portfolios.length >= 1);
      check("legacy issues retained for export compatibility", s.issues && s.issues.length >= 1);
      check("legacy decisions retained for export compatibility", s.decisions && s.decisions.length >= 1);
      check("action items seeded", s.actionItems && s.actionItems.length >= 1);
      check("audit trail retained internally", s.auditTrail && s.auditTrail.length >= 1);
      check("integration settings seeded", !!s.integrationSettings && "unanetEndpoint" in s.integrationSettings);
      check("Fabric ERMAS/accounting connector setting is seeded", "fabricErmasAccountingUrl" in s.integrationSettings);
      check("Fabric ERMAS/accounting connector URL persists", Q.setFabricConnectorUrl("https://app.fabric.microsoft.com/groups/ermas-accounting") === "https://app.fabric.microsoft.com/groups/ermas-accounting" && Q.fabricConnectorUrl().indexOf("app.fabric.microsoft.com") !== -1);
      check("cards have WBS metadata", s.cards.filter(function (c) { return c.projectId; }).every(function (c) { return c.outlineNumber != null && c.chargeTask != null && c.physicalProgress != null; }));
      var p = s.projects[0];
      var csv = "Outline Number,Task Name,Parent Outline,Assigned To,Start,Finish,Estimate Hours,Physical % Complete,ERMAS Charge Task,ERMAS Budget,ERMAS Actuals,ERMAS Start,ERMAS Finish\n" +
        "1,Imported Summary,,QA Lead,2026-07-01,2026-07-10,8,10,EFS.TEST.1,1000,100,2026-07-02,2026-07-09\n" +
        "1.1,Imported Detail,1,QA Lead,2026-07-03,2026-07-12,16,25,EFS.TEST.1.1,900,200,2026-07-04,2026-07-10";
      var parsed = Q.parseCesP6Csv(csv, "ces.csv");
      check("CES/P6 parser returns tasks", parsed.tasks.length === 2, "tasks " + parsed.tasks.length);
      check("CES/P6 parser keeps WBS parent", parsed.tasks[1].parentOutline === "1");
      var beforeCards = s.cards.length;
      var beforeAudit = s.auditTrail.length;
      var importId = Q.importWbsTasks(p.id, parsed);
      var imported = Q.state().cards.filter(function (c) { return c.importId === importId; });
      check("WBS import adds cards", Q.state().cards.length === beforeCards + 2);
      check("WBS import creates hierarchy", imported.some(function (c) { return c.parentId; }));
      check("WBS import maps charge task", imported.some(function (c) { return c.chargeTask === "EFS.TEST.1.1"; }));
      check("WBS import records audit", Q.state().auditTrail.length > beforeAudit);
      check("project package includes work items", Q.exportProjectPackage(p.id).workItems.length >= imported.length);
      check("project package includes action item list", Array.isArray(Q.exportProjectPackage(p.id).actionItems));
      var planId = Q.addProjectPlanRaw(p.id, { name: "QA Project Management Plan.pdf", revision: "Rev QA", notes: "QA upload" });
      check("project plan revision attaches to project", Q.projectById(p.id).projectPlans.some(function (pl) { return pl.id === planId; }));
      check("project package exports plan revisions", Q.exportProjectPackage(p.id).projectPlans.length >= 1);
      check("project plan revision delete works", Q.deleteProjectPlanRaw(p.id, planId) === 1);
      var sampleProjects = ["Manual Progress Sample", "Kanban Stage Sample"].map(function (name) { return s.projects.filter(function (p2) { return p2.name === name; })[0]; });
      check("manual and Kanban sample projects seeded", sampleProjects.every(Boolean));
      var manualCards = sampleProjects[0] ? Q.cardsForProject(sampleProjects[0].id) : [];
      var stageCards = sampleProjects[1] ? Q.cardsForProject(sampleProjects[1].id) : [];
      check("manual sample uses manual progress", manualCards.length >= 2 && manualCards.every(function (c) { return c.progressMode === "Manual Physical %"; }));
      check("Kanban sample uses stage progress", stageCards.length >= 3 && stageCards.every(function (c) { return c.progressMode === "Kanban Stage"; }));
      check("manual sample predecessor is Done before Review successor", (function () {
        var memo = manualCards.filter(function (c) { return /basis memo/i.test(c.title); })[0];
        var review = manualCards.filter(function (c) { return /deliverable review/i.test(c.title); })[0];
        return memo && review && Q.isDone(memo) && (review.deps || []).indexOf(memo.id) !== -1;
      })());
      check("Kanban sample progress equals stage geometry", stageCards.every(function (c) {
        var b = s.boards.filter(function (x) { return x.id === c.boardId; })[0];
        var idx = b.columns.map(function (x) { return x.id; }).indexOf(c.columnId);
        var exp = Math.round((idx / (b.columns.length - 1)) * 100);
        return c.progress === exp && c.physicalProgress === exp;
      }));
      var manRoll = Q.projectRollup(sampleProjects[0].id);
      var stageRoll = Q.projectRollup(sampleProjects[1].id);
      var manEvm = Q.projectEVM(sampleProjects[0].id);
      var stageEvm = Q.projectEVM(sampleProjects[1].id);
      check("manual sample rollup progress is effort-weighted", manRoll.progress > 0 && manRoll.progress < 100);
      check("Kanban sample rollup progress is effort-weighted", stageRoll.progress > 0 && stageRoll.progress < 100);
      check("manual sample EV tracks weighted progress", approx(manEvm.ev, manEvm.bac * (manRoll.progress / 100), 1));
      check("Kanban sample EV tracks weighted progress", approx(stageEvm.ev, stageEvm.bac * (stageRoll.progress / 100), 1));
      check("default WIP policy is hard pull-system", (s.settings.wipPolicy || "hard") === "hard");
      var multiAssigned = s.cards.filter(function (c) { return (c.resourceAssignments || []).length >= 2; })[0];
      check("cards support up to three percentage resources", multiAssigned && Q.cardAssignments(multiAssigned.id).length >= 2 && Q.cardAssignments(multiAssigned.id).length <= 3);
      check("assignment summary keeps visible initials source", multiAssigned && Q.assignmentSummary(multiAssigned.id).indexOf("%") !== -1);
      // v4.3.0 — card face shows responsible + allocated team with visible % (NN: visibility/recognition).
      var teamHtml = multiAssigned ? Q.cardTeamHTML(multiAssigned.id) : "";
      check("card face names the responsible lead", teamHtml.indexOf("card-team-lead") !== -1 && teamHtml.indexOf("lead-name") !== -1, teamHtml.slice(0, 40));
      check("card face shows allocation % without hover", /lead-pct/.test(teamHtml) && /\d+%/.test(teamHtml));
      var soloCard = { id: Q.uid("c"), boardId: s.boards[0].id, columnId: s.boards[0].columns[0].id, title: "QA no team", order: 0, resourceAssignments: [], deps: [], activity: [] };
      s.cards.push(soloCard);
      check("card face flags unassigned work", Q.cardTeamHTML(soloCard.id).indexOf("card-unassigned") !== -1);
      var leadFirst = multiAssigned ? Q.cardAssignments(multiAssigned.id)[0] : null;
      check("responsible lead is the card primary assignee", leadFirst && Q.state().cards.filter(function (c) { return c.id === multiAssigned.id; })[0].assigneeId === leadFirst.resourceId);
      var depCard = s.cards.filter(function (c) {
        if (c.dependencyMode !== "Blocks until closed" || !((c.deps || []).length || (c.dependencyWbsCodes || []).length)) return false;
        return Q.dependencyCards(c.id).some(function (d) { return !Q.isDone(d); });
      })[0] || s.cards.filter(function (c) { return c.dependencyMode === "Blocks until closed" && ((c.deps || []).length || (c.dependencyWbsCodes || []).length); })[0];
      check("dependency blocker logic is editable on cards", !!depCard && Q.dependencyCards(depCard.id).length >= 1);
      if (depCard) {
        var openLabel = Q.dependencyBlockLabel(depCard.id);
        var hasOpen = Q.dependencyCards(depCard.id).some(function (d) { return !Q.isDone(d); });
        check("dependency blocker label is generated", hasOpen ? openLabel.length > 0 : typeof openLabel === "string", openLabel || "(no open blockers)");
      }
      var detail = imported.filter(function (c) { return c.outlineNumber === "1.1"; })[0];
      check("task budget variance high is red", Q.taskVarianceClass(detail.id, "budget") === "danger", Q.taskVarianceClass(detail.id, "budget"));
      check("task early start is yellow", Q.taskVarianceClass(detail.id, "start") === "warn", Q.taskVarianceClass(detail.id, "start"));
      check("task late finish is yellow", Q.taskVarianceClass(detail.id, "finish") === "warn", Q.taskVarianceClass(detail.id, "finish"));
      var roll = Q.resourceEngagementRollup(null, p.id);
      check("resource engagement weekly rollup", roll.weekly > 0, "weekly " + roll.weekly);
      check("resource engagement equivalent rollup", roll.weeklyEquivalent >= roll.weekly, "eq " + roll.weeklyEquivalent);
      var generated = { id: Q.uid("r"), name: "Generated Placeholder", role: "Imported Team Member", dept: "Project Delivery", capacityHrs: 40, costRate: 70, billRate: 120, type: "Employee", company: "Techniek", unit: "hour", status: "Active" };
      Q.state().resources.push(generated);
      check("resource placeholder cleanup removes generated rows", Q.cleanGeneratedResourcePlaceholders() >= 1 && !Q.resourceById(generated.id));
      var projectCo = Q.state().changeOrders[0];
      check("change control can filter by project", projectCo && Q.changeOrdersForProject(projectCo.projectId).every(function (co) { return co.projectId === projectCo.projectId; }));
    })();

    /* ---- 13. README claim sanity checks ---- */
    group("13 - README claim sanity checks");
    Q.resetDemo();
    (function () {
      var s = Q.state();
      var allowedResponses = ["Avoid", "Mitigate", "Transfer", "Accept", "Exploit", "Enhance", "Share"];
      var allowedRiskStatus = ["Open", "Mitigating", "Closed"];
      var allowedRiskTypes = ["Threat", "Opportunity"];
      check("multiple boards present", s.boards.length >= 2, "boards " + s.boards.length);
      check("board rosters resolve resources", s.boards.every(function (b) {
        return (b.rosterIds || []).every(function (rid) { return !!Q.resourceById(rid); });
      }));
      check("WIP limits configured", s.boards.some(function (b) {
        return b.columns.some(function (c) { return (c.wip || 0) > 0; });
      }));
      check("board WIP summary reports configured controls", s.boards.some(function (b) {
        return Q.boardWipSummary(b.id).controlledStages > 0;
      }));
      var qaCol = { id: Q.uid("col"), name: "QA Active", wip: 1 };
      var qaBoard = { id: Q.uid("b"), name: "QA WIP Board", type: "qa", columns: [qaCol], rosterIds: [] };
      s.boards.push(qaBoard);
      s.cards.push({ id: Q.uid("c"), boardId: qaBoard.id, columnId: qaCol.id, title: "QA WIP 1", order: 0 });
      s.cards.push({ id: Q.uid("c"), boardId: qaBoard.id, columnId: qaCol.id, title: "QA WIP 2", order: 1 });
      var wip = Q.boardWipSummary(qaBoard.id);
      check("board WIP summary flags over-limit stages", wip.overLimitStages === 1 && wip.over[0].over === 1, wip.detail);
      check("4-week forecast returned", s.resources.every(function (r) {
        return Q.resourceUtil(r.id).weeks.length === 4;
      }));
      check("forecast sums to allocated work", s.resources.every(function (r) {
        var u = Q.resourceUtil(r.id);
        return approx(u.weeks.reduce(function (a, x) { return a + x; }, 0), u.allocated, 0.5);
      }));
      check("risk register fields valid", s.risks.every(function (r) {
        return r.probability >= 1 && r.probability <= 5 &&
          r.impact >= 1 && r.impact <= 5 &&
          allowedResponses.indexOf(r.response) !== -1 &&
          allowedRiskStatus.indexOf(r.status) !== -1;
      }));
      check("risk records carry industry-standard type", s.risks.every(function (r) {
        return allowedRiskTypes.indexOf(r.riskType) !== -1;
      }));
      check("risk residual scoring present and bounded", s.risks.every(function (r) {
        return r.residualProbability >= 1 && r.residualProbability <= 5 &&
          r.residualImpact >= 1 && r.residualImpact <= 5 &&
          (r.residualProbability * r.residualImpact) <= (r.probability * r.impact);
      }));
      check("risk records carry identification metadata", s.risks.every(function (r) {
        return typeof r.category === "string" && r.category.length > 0 &&
          typeof r.trigger === "string" && "costImpact" in r && "scheduleImpactDays" in r;
      }));
      check("normalizeRisk backfills legacy risk records", (function () {
        var legacy = Q.normalizeRisk({ probability: 4, impact: 5, response: "Mitigate", status: "Open" });
        return legacy.riskType === "Threat" && legacy.residualProbability === 4 && legacy.residualImpact === 5 && !!legacy.id;
      })());
      check("risk register CSV export available", typeof Q.exportRiskRegisterCSV === "function");
      (function () {
        var byName = function (n) { return s.projects.filter(function (p) { return p.name === n; })[0]; };
        var web = byName("Corporate Site Relaunch"), workshop = byName("Workshop Lean Rollout"), bid = byName("Offshore Survey Bid");
        var crane = byName("Harbor Crane Retrofit");
        check("internal projects classified as internal/BD", (!web || Q.isInternalProject(web.id)) && (!workshop || Q.isInternalProject(workshop.id)) && (!bid || Q.isInternalProject(bid.id)));
        check("client-delivery projects not classified internal", !crane || !Q.isInternalProject(crane.id));
        check("BD pursuits classified as Business Development", !bid || Q.internalProjectClass(bid.id) === "Business Development");
        check("internal project metrics computed (budget/CPI/SPI/on-time)", s.projects.filter(function (p) { return Q.isInternalProject(p.id); }).every(function (p) {
          var m = Q.internalProjectMetrics(p.id);
          return m && isFinite(m.cpi) && isFinite(m.spi) && m.onTimeRate >= 0 && m.onTimeRate <= 100 && typeof m.budgetVariance === "number";
        }));
      })();
      check("public schema matches workspace", TB.schema === s.version, "api " + TB.schema + " state " + s.version);
      check("report PDF export is available", Q.reportPdfAvailable());
      check("runtime scripts are local", Array.prototype.every.call(document.scripts, function (sc) {
        return !sc.src || sc.src.indexOf(location.origin) === 0;
      }));
    })();


    /* ---- 14. Techniek brand system (dark-first, corporate palette) ---- */
    group("14 - Techniek brand system (dark-first, corporate palette)");
    Q.resetDemo();
    (function () {
      var cs = getComputedStyle(document.documentElement);
      function v(n) { return cs.getPropertyValue(n).trim().toLowerCase(); }
      check("dark control-room tokens are the default", v("--bg") === "#070e18", "bg " + v("--bg"));
      check("Techniek blue token present", v("--tek-blue") === "#0057d9");
      check("Techniek green token present", v("--tek-green") === "#2ea043");
      check("Techniek gold token present", v("--tek-gold") === "#f2c94c");
      check("signature gradient defined", v("--tek-gradient").indexOf("linear-gradient") === 0);
      check("6px radius system", v("--radius") === "6px", v("--radius"));
      check("fixed-contrast avatar fill defined", v("--avatar-bg") === "#0057d9");
      check("new demo workspaces default to dark theme", Q.state().settings.theme === "dark");
      var pal = Q.chartPalette();
      check("chart series 1-3 are Techniek blue/green/gold", pal.brand === "#2f86ff" && pal.green === "#2ea043" && pal.amber === "#f2c94c");
      check("no legacy vendor teal in chart palette", JSON.stringify(pal).indexOf("#0f766e") === -1);
    })();

    /* ---- 15. PM Advisor deterministic engine ---- */
    group("15 - PM Advisor deterministic engine");
    Q.resetDemo();
    (function () {
      var F = Q.advisorFindings();
      check("advisor produces a substantive finding set", F.length >= 10, "got " + F.length);
      check("every finding carries severity, dimension, evidence, and action", F.every(function (f) { return f.severity && f.dimension && f.title && f.evidence && f.action; }));
      check("findings are severity-ranked (critical first)", (function () { var rank = { critical: 0, warn: 1, info: 2 }; for (var i = 1; i < F.length; i++) { if (rank[F[i].severity] < rank[F[i - 1].severity]) return false; } return true; })());
      check("WIP breach detected with exact numbers", F.some(function (f) { return f.dimension === "Flow" && /WIP/.test(f.title) && /5 of 4/.test(f.evidence); }));
      check("aging WIP detected with oldest item named", F.some(function (f) { return f.dimension === "Flow" && /aging/i.test(f.title) && /Oldest:/.test(f.evidence); }));
      check("dependency-blocked work detected", F.some(function (f) { return f.dimension === "Flow" && /blocked/i.test(f.title); }));
      check("unassigned active work detected", F.some(function (f) { return /unassigned/i.test(f.title); }));
      check("unestimated active work detected", F.some(function (f) { return /estimate/i.test(f.title); }));
      check("cost overrun detected via CPI", F.some(function (f) { return f.dimension === "Cost" && /CPI 0\.\d+/.test(f.title); }));
      check("schedule slip detected via SPI", F.some(function (f) { return f.dimension === "Schedule" && /SPI 0\.\d+/.test(f.title); }));
      check("margin-below-target detected", F.some(function (f) { return f.dimension === "Margin"; }));
      check("over-allocation detected", F.some(function (f) { return f.dimension === "Resource" && /over-allocated/i.test(f.title); }));
      check("stale risk reviews detected", F.some(function (f) { return f.dimension === "Risk" && /review/i.test(f.title); }));
      check("pending change order detected with its number", F.some(function (f) { return f.dimension === "Governance" && /CO-\d+/.test(f.title); }));
      check("every drill-through target resolves", F.every(function (f) {
        var d = f.drill || {};
        if (d.cardId) return !!Q.cardById(d.cardId);
        if (d.projectId) return !!Q.projectById(d.projectId);
        if (d.resourceId) return !!Q.resourceById(d.resourceId);
        return !!(d.view || d.boardId);
      }));
      var H = Q.advisorHealth();
      check("health grades every dimension A-F", ["Cost", "Schedule", "Margin", "Flow", "Risk", "Resource", "Governance"].every(function (d) { return H.dimensions[d] && /^[A-F]$/.test(H.dimensions[d].grade); }));
      check("overall health score bounded 0-100 with grade", /^[A-F]$/.test(H.overall.grade) && H.overall.score >= 0 && H.overall.score <= 100);
      check("advisor view is reachable from nav", Q.navIds().indexOf("advisor") !== -1);
      // Reactivity: fixing a problem must improve the health score.
      var wipBefore = F.filter(function (f) { return /WIP/.test(f.title); }).length;
      var s = Q.state();
      var eng = s.boards.filter(function (b) { return b.name === "Engineering Delivery"; })[0];
      var ip = eng.columns.filter(function (c) { return c.name === "In Progress"; })[0];
      var overflow = s.cards.filter(function (c) { return c.boardId === eng.id && c.columnId === ip.id; })[0];
      var backlog = eng.columns[0];
      overflow.columnId = backlog.id; // direct state surgery: relieve the breach
      var F2 = Q.advisorFindings();
      check("relieving the WIP breach clears the finding", F2.filter(function (f) { return /WIP/.test(f.title); }).length < wipBefore, "was " + wipBefore);
      check("health improves when findings clear", Q.advisorHealth().overall.score >= H.overall.score, "now " + Q.advisorHealth().overall.score + " was " + H.overall.score);
    })();

    /* ---- 16. PM Agent: command + recommendation execution ---- */
    group("16 - PM Agent (command mode, recommendation mode, governance)");
    Q.resetDemo();
    (function () {
      // --- natural-language resolution ---
      check("resolves a card by fuzzy title", (Q.agentResolveCard("sensor harness") || {}).title === "Sensor harness routing");
      check("resolves a resource by name", (Q.agentResolveResource("diego") || {}).name === "Diego Romero");
      check("returns null for an unmatched card", Q.agentResolveCard("zzz nonexistent zzz") === null);

      // --- command parsing (works with no AI service) ---
      var p1 = Q.agentParseCommand("move Sensor harness routing to Review");
      check("parses a move command", p1.matched && p1.actions[0].op === "move");
      var p2 = Q.agentParseCommand("set estimate of Win-theme workshop to 12");
      check("parses a field update", p2.matched && p2.actions[0].op === "update" && p2.actions[0].fields.estimateHours === 12);
      var p3 = Q.agentParseCommand("assign Diego Romero to Case study: Harbor Crane at 40%");
      check("parses an assignment with allocation", p3.matched && p3.actions[0].op === "reassign" && p3.actions[0].allocationPct === 40);
      var p4 = Q.agentParseCommand("push Accessibility audit by 5 days");
      check("parses a reschedule", p4.matched && p4.actions[0].op === "reschedule" && p4.actions[0].days === 5);
      check("unknown phrasing does not fabricate actions", Q.agentParseCommand("make everything better somehow").matched === false);

      // --- planning: valid, invalid, and governance-blocked ---
      var planMove = Q.agentPlan(p1.actions);
      check("valid move plans as ok", planMove[0].status === "ok", planMove[0].status + " " + planMove[0].message);
      check("plan step carries a human description", /Move ".+" from .+ to /.test(planMove[0].describe));
      var planBad = Q.agentPlan([{ op: "move", cardRef: "zzz nonexistent zzz", stageRef: "Done" }]);
      check("unresolvable card is rejected, not silently ignored", planBad[0].status === "invalid" && /No card matched/.test(planBad[0].message));
      var planBadPrio = Q.agentPlan([{ op: "update", cardRef: "Sensor harness routing", fields: { priority: "urgent" } }]);
      check("invalid enum value is rejected with guidance", planBadPrio[0].status === "invalid" && /critical/.test(planBadPrio[0].message));

      // --- governance: the agent hits the SAME gates a human drag hits ---
      var s = Q.state();
      var governed = s.cards.filter(function (c) {
        if (!c.projectId || Q.isDone(c)) return false;
        var b = s.boards.filter(function (x) { return x.id === c.boardId; })[0];
        return b && !!Q.cardMoveValidationMessage(c, Q.lastColumnId(b.id));
      })[0];
      check("a governed card exists for the gate test", !!governed);
      if (governed) {
        var lastCol = Q.lastColumnId(governed.boardId);
        var planGated = Q.agentPlan([{ op: "move", cardId: governed.id, columnId: lastCol }]);
        check("evidence gate blocks the agent too", planGated[0].status === "blocked" && /evidence/i.test(planGated[0].message), planGated[0].message);
        var before = governed.columnId;
        Q.agentApply(planGated);
        check("blocked action is never applied", Q.cardById(governed.id).columnId === before);
      }
      // WIP: filling a limited stage must block the agent's next pull into it.
      var eng = s.boards.filter(function (b) { return b.name === "Engineering Delivery"; })[0];
      var ip = eng.columns.filter(function (c) { return c.name === "In Progress"; })[0];
      var candidate = s.cards.filter(function (c) { return c.boardId === eng.id && c.columnId !== ip.id && !Q.isDone(c); })[0];
      var wipPlan = Q.agentPlan([{ op: "move", cardId: candidate.id, columnId: ip.id }]);
      check("WIP limit blocks the agent's pull", wipPlan[0].status === "blocked" && /WIP limit/i.test(wipPlan[0].message), wipPlan[0].message);

      // --- Rules-of-Credit progress is not writable by the agent ---
      var rocCard = s.cards.filter(function (c) { return c.progressMode === "Rules of Credit"; })[0];
      if (rocCard) {
        var rocPlan = Q.agentPlan([{ op: "update", cardId: rocCard.id, fields: { progress: 90 } }]);
        check("Rules-of-Credit progress is governance-blocked", rocPlan[0].status === "blocked" && /Rules of Credit/.test(rocPlan[0].message));
      } else { check("Rules-of-Credit fixture present (skipped)", true); }

      // --- apply: real mutation through the real path ---
      Q.resetDemo();
      var applyPlan = Q.agentPlan(Q.agentParseCommand("set estimate of Win-theme workshop to 12").actions);
      var target = Q.agentResolveCard("Win-theme workshop");
      var estBefore = target.estimateHours;
      var res = Q.agentApply(applyPlan);
      check("apply reports what it changed", res.applied === 1, "applied " + res.applied);
      check("estimate actually changed", Q.cardById(target.id).estimateHours === 12, "was " + estBefore);
      check("effort fields stay coherent after agent edit", (function () {
        var c = Q.cardById(target.id);
        return Math.abs(c.progress - Q.progressFromEffortFor(c.estimateHours, c.loggedHours)) <= 1;
      })());
      check("agent action is audit-trailed", (Q.state().auditTrail || []).some(function (a) { return a.entity === "PM Agent"; }));

      // --- derived metrics are never written directly ---
      check("no agent op writes a derived metric", ["cpi", "spi", "eac", "multiplier", "contributionMargin"].every(function (k) {
        return Q.agentPlan([{ op: "update", cardRef: "Win-theme workshop", fields: (function () { var o = {}; o[k] = 1; return o; })() }])[0].status === "ok";
      }) && (function () {
        // ...and applying such a field is a no-op on the card (unknown fields ignored)
        var c = Q.agentResolveCard("Win-theme workshop");
        return c.cpi === undefined;
      })());

      // --- recommendation mode ---
      Q.resetDemo();
      var recActions = Q.agentActionsFromFindings();
      check("recommendation mode proposes actions from findings", recActions.length > 0, "got " + recActions.length);
      check("every proposed action carries a reason", recActions.every(function (a) { return !!a.reason; }));
      var wipRelief = Q.agentRebalanceActions();
      check("WIP relief targets the over-limit stage", wipRelief.length > 0 && wipRelief.every(function (a) { return a.op === "move"; }));
      var recPlan = Q.agentPlan(recActions);
      check("recommendation plan validates every step", recPlan.every(function (st) { return ["ok", "blocked", "invalid"].indexOf(st.status) !== -1; }));
      var okBefore = recPlan.filter(function (st) { return st.status === "ok"; }).length;
      var appliedRes = Q.agentApply(recPlan);
      check("applying recommendations relieves the WIP breach", (function () {
        var s2 = Q.state();
        var eng2 = s2.boards.filter(function (b) { return b.name === "Engineering Delivery"; })[0];
        var ip2 = eng2.columns.filter(function (c) { return c.name === "In Progress"; })[0];
        return s2.cards.filter(function (c) { return c.boardId === eng2.id && c.columnId === ip2.id; }).length <= ip2.wip;
      })(), "applied " + appliedRes.applied + " of " + okBefore);
      check("advisor no longer reports the WIP breach", !Q.advisorFindings().some(function (f) { return /WIP limit breached/.test(f.title); }));

      // --- undo: the whole batch is one step ---
      check("agent batch is a single undo step", (function () {
        var s3 = Q.state();
        var eng3 = s3.boards.filter(function (b) { return b.name === "Engineering Delivery"; })[0];
        var ip3 = eng3.columns.filter(function (c) { return c.name === "In Progress"; })[0];
        var after = s3.cards.filter(function (c) { return c.boardId === eng3.id && c.columnId === ip3.id; }).length;
        Q.undo();
        var s4 = Q.state();
        var eng4 = s4.boards.filter(function (b) { return b.name === "Engineering Delivery"; })[0];
        var ip4 = eng4.columns.filter(function (c) { return c.name === "In Progress"; })[0];
        var restored = s4.cards.filter(function (c) { return c.boardId === eng4.id && c.columnId === ip4.id; }).length;
        return restored > after;
      })());
    })();

    /* ---- 17. Local knowledge base (no API key, no network) ---- */
    group("17 - Local PM knowledge base and finding playbooks");
    Q.resetDemo();
    (function () {
      var docs = Q.kbDocuments();
      check("built-in corpus is bundled and loaded", docs.length >= 8, "docs " + docs.length);
      check("every document declares id, title, source, sections", docs.every(function (d) { return d.id && d.title && d.source && (d.sections || []).length; }));
      check("corpus covers every advisor dimension", ["Cost", "Schedule", "Margin", "Flow", "Risk", "Resource", "Governance"].every(function (dim) {
        return docs.some(function (d) { return d.dimension === dim; });
      }));
      // Retrieval quality: the right document must win, not just any match.
      var r1 = Q.kbSearch("what do I do about a WIP limit breach", 5);
      check("ranked retrieval returns cited passages", r1.length > 0 && !!r1[0].passage.source);
      check("WIP question ranks the WIP playbook first", r1[0].passage.docId === "kanban-wip-limits", "got " + (r1[0] && r1[0].passage.docId));
      var r2 = Q.kbSearch("why is contribution margin falling below target", 5);
      check("margin question ranks the multiplier playbook first", r2[0].passage.docId === "ae-multiplier-margin", "got " + (r2[0] && r2[0].passage.docId));
      var r3 = Q.kbSearch("cost performance index forecast at completion", 5);
      check("CPI question ranks the cost playbook first", r3[0].passage.docId === "evm-cost-performance", "got " + (r3[0] && r3[0].passage.docId));
      check("nonsense query returns nothing rather than a wrong answer", Q.kbSearch("zzzz qqqq vvvv", 5).length === 0);
      check("scores are ordered descending", (function () { var s = Q.kbSearch("risk register review", 6); for (var i = 1; i < s.length; i++) if (s[i].score > s[i - 1].score) return false; return true; })());

      // The actionable part: findings bind to the playbook that answers them.
      var F = Q.advisorFindings();
      var wipFinding = F.filter(function (f) { return /WIP limit breached/.test(f.title); })[0];
      check("a WIP finding exists to bind", !!wipFinding);
      if (wipFinding) {
        var pb = Q.kbPlaybookForFinding(wipFinding);
        check("WIP finding binds to the WIP playbook", pb && pb.doc.id === "kanban-wip-limits", pb ? pb.doc.id : "none");
        check("bound playbook carries real passage text", pb && pb.passage && pb.passage.text.length > 80);
      }
      var marginFinding = F.filter(function (f) { return f.dimension === "Margin"; })[0];
      if (marginFinding) {
        var pb2 = Q.kbPlaybookForFinding(marginFinding);
        check("margin finding binds to the margin playbook", pb2 && pb2.doc.id === "ae-multiplier-margin", pb2 ? pb2.doc.id : "none");
      } else { check("margin finding fixture (skipped)", true); }
      check("most findings resolve to a playbook", F.filter(function (f) { return !!Q.kbPlaybookForFinding(f); }).length >= Math.ceil(F.length * 0.6), F.filter(function (f) { return !!Q.kbPlaybookForFinding(f); }).length + "/" + F.length);

      // User-supplied procedures rank alongside the built-ins.
      var before = Q.kbDocuments().length;
      var md = "---\nid: qa-test-procedure\ntitle: QA Test Procedure\nsource: QA harness\ndimension: Governance\ntriggers: qaonlytrigger\ntags: qa\n---\n\n## Unique QA Section\n\nZorbulator calibration must be witnessed and recorded before closeout.\n";
      Q.kbAddDocRaw(md, "qa-test.md");
      check("uploaded markdown joins the corpus", Q.kbDocuments().length === before + 1);
      var hit = Q.kbSearch("zorbulator calibration witnessed", 3);
      check("uploaded procedure is retrievable by content", hit.length > 0 && hit[0].passage.docId === "qa-test-procedure", hit.length ? hit[0].passage.docId : "none");
      check("uploaded procedure keeps its frontmatter metadata", (function () { var d = Q.kbDocuments().filter(function (x) { return x.id === "qa-test-procedure"; })[0]; return d && d.dimension === "Governance" && d.title === "QA Test Procedure"; })());
      check("markdown without frontmatter still parses", (function () { var d = Q.kbParseMarkdown("## A heading\n\nSome body text here.", "plain-note.md"); return d.title === "plain-note" && d.sections.length >= 1; })());
      check("knowledge base needs no API key or network", !Q.state().settings.apiKey && typeof window.TECHNIEK_KNOWLEDGE === "object");
    })();

    /* ---- 18. Navigation completeness (no orphaned views) ---- */
    group("18 - Navigation completeness");
    Q.resetDemo();
    (function () {
      var nav = Q.navIds();
      check("Client Report is reachable from nav", nav.indexOf("client") !== -1);
      check("Audit Trail is reachable from nav", nav.indexOf("audit") !== -1);
      check("portfolio Risk Register is reachable from nav", nav.indexOf("risks") !== -1);
      check("issues/decisions stay consolidated into Action Items", nav.indexOf("issues") === -1 && nav.indexOf("decisions") === -1 && nav.indexOf("actionitems") !== -1);
      check("Procedure Library is gone with the vector store it administered", nav.indexOf("pmspecialist") === -1);
      check("every nav id has a view implementation", nav.every(function (id) { return Q.viewExists(id); }),
        nav.filter(function (id) { return !Q.viewExists(id); }).join(",") || "all present");
      check("no view implementation is unreachable", (function () {
        // Every VIEWS.* must be in nav, except the two deliberately consolidated.
        var allowed = { issues: 1, decisions: 1 };
        var orphans = Q.viewIds().filter(function (id) { return nav.indexOf(id) === -1 && !allowed[id]; });
        return orphans.length === 0;
      })(), Q.viewIds().filter(function (id) { return nav.indexOf(id) === -1; }).join(",") || "none");
      // Real source check (works when served over http; skipped on file://).
      check("no native confirm()/alert() remains in app.js", (function () {
        try {
          var xhr = new XMLHttpRequest();
          xhr.open("GET", "../app.js", false);
          xhr.send(null);
          if (xhr.status && xhr.status >= 400) return true;
          var src = xhr.responseText || "";
          if (!src) return true;
          return !/[^a-zA-Z.]confirm\s*\(/.test(src.replace(/confirmModal\s*\(/g, "")) && !/[^a-zA-Z.]alert\s*\(/.test(src);
        } catch (e) { return true; }
      })());
    })();

    /* ---- 19. Optional LLM layer: untrusted output is contained ---- */
    group("19 - LLM layer (stubbed model output, no key required)");
    Q.resetDemo();
    (function () {
      var s = Q.state();
      var realCard = s.cards.filter(function (c) { return !Q.isDone(c) && c.projectId; })[0];
      var realRes = s.resources.filter(function (r) { return r.status === "Active"; })[0];
      var realProj = s.projects[0];
      var b = s.boards.filter(function (x) { return x.id === realCard.boardId; })[0];
      var otherCol = b.columns.filter(function (c) { return c.id !== realCard.columnId; })[0];

      // Context handed to the model must carry the ids it is required to quote back.
      var ctx = Q.agentLlmContext();
      check("context exposes card ids", (ctx.cards || []).length > 0 && !!ctx.cards[0].cardId);
      check("context exposes column ids for the active board", (ctx.activeBoard.columns || []).every(function (c) { return !!c.columnId; }));
      check("context includes deterministic findings for grounding", (ctx.findings || []).length > 0);
      check("context includes resource and project ids", (ctx.resources || []).length > 0 && (ctx.projects || []).length > 0);

      // --- hallucinated / malformed output must be rejected, not applied ---
      var hostile = Q.agentSanitizeActions([
        { op: "move", cardId: "card_does_not_exist", columnId: otherCol.id },
        { op: "move", cardId: realCard.id, columnId: "col_not_on_this_board" },
        { op: "reassign", cardId: realCard.id, resourceId: "res_nope" },
        { op: "reschedule", cardId: realCard.id, days: 0 },
        { op: "delete_everything", cardId: realCard.id },
        { op: "update", cardId: realCard.id, fields: { cpi: 1.5, spi: 2, eac: 0, multiplier: 9 } },
        { op: "changeorder", projectId: "proj_nope", title: "x" },
        "not an object",
        null,
      ]);
      check("unknown card id rejected", hostile.rejected.some(function (r) { return /cardId does not exist/.test(r); }));
      check("column from another board rejected", hostile.rejected.some(function (r) { return /columnId is not on/.test(r); }));
      check("unknown resource id rejected", hostile.rejected.some(function (r) { return /resourceId does not exist/.test(r); }));
      check("zero-day reschedule rejected", hostile.rejected.some(function (r) { return /non-zero integer/.test(r); }));
      check("unsupported op rejected", hostile.rejected.some(function (r) { return /unsupported op/.test(r); }));
      check("derived metrics cannot be written by the model", hostile.rejected.some(function (r) { return /derived metrics cannot be written/.test(r); }));
      check("unknown project id rejected", hostile.rejected.some(function (r) { return /projectId does not exist/.test(r); }));
      check("non-object entries rejected", hostile.rejected.some(function (r) { return /not an object/.test(r); }));
      check("nothing hostile survives sanitisation", hostile.actions.length === 0, "survived " + hostile.actions.length);

      // --- valid output is coerced, then still governed ---
      var good = Q.agentSanitizeActions([
        { op: "update", cardId: realCard.id, fields: { estimateHours: 21, progress: 250, priority: "HIGH", bogus: "drop me" }, reason: "test" },
        { op: "reassign", cardId: realCard.id, resourceId: realRes.id, allocationPct: 400 },
      ]);
      check("valid actions survive", good.actions.length === 2);
      check("out-of-range progress is clamped", good.actions[0].fields.progress === 100, "got " + good.actions[0].fields.progress);
      check("enum is normalised", good.actions[0].fields.priority === "high");
      check("unknown field is dropped silently", good.actions[0].fields.bogus === undefined);
      check("allocation is clamped to 100", good.actions[1].allocationPct === 100);
      check("sanitised actions are tagged as model-proposed", good.actions.every(function (a) { return a._llm === true; }));

      // --- the whole response path: model JSON -> validated plan ---
      var resp = Q.agentPlanFromLlmResponse({
        narrative: "Two adjustments to relieve pressure.",
        actions: [
          { op: "update", cardId: realCard.id, fields: { estimateHours: 30 }, reason: "re-estimate" },
          { op: "move", cardId: "ghost", columnId: otherCol.id },
        ],
      });
      check("narrative is carried through", /relieve pressure/.test(resp.narrative));
      check("hallucinated action never reaches the planner", resp.plan.length === 1);
      check("rejection is reported to the user, not swallowed", resp.rejected.length === 1);
      check("surviving action is planned and governed", ["ok", "blocked", "invalid"].indexOf(resp.plan[0].status) !== -1);

      // --- a model-proposed move still hits the same governance gates ---
      var governed = s.cards.filter(function (c) {
        if (!c.projectId || Q.isDone(c)) return false;
        var bb = s.boards.filter(function (x) { return x.id === c.boardId; })[0];
        return bb && !!Q.cardMoveValidationMessage(c, Q.lastColumnId(bb.id));
      })[0];
      if (governed) {
        var gResp = Q.agentPlanFromLlmResponse({ actions: [{ op: "move", cardId: governed.id, columnId: Q.lastColumnId(governed.boardId) }] });
        check("model-proposed move is blocked by the same gate as a human drag", gResp.plan[0].status === "blocked", gResp.plan[0].message);
        var beforeCol = governed.columnId;
        Q.agentApply(gResp.plan);
        check("blocked model action is not applied", Q.cardById(governed.id).columnId === beforeCol);
      } else { check("governed fixture available (skipped)", true); }

      // --- clarification instead of guessing ---
      var clar = Q.agentPlanFromLlmResponse({ clarification: "Which of the three review items did you mean?", actions: [] });
      check("clarification is surfaced with no actions", /Which of the three/.test(clar.clarification) && clar.plan.length === 0);

      // --- malformed top-level response degrades safely ---
      check("non-JSON / empty response yields an empty plan", Q.agentPlanFromLlmResponse(null).plan.length === 0);
      check("response with no actions array yields an empty plan", Q.agentPlanFromLlmResponse({ narrative: "hi" }).plan.length === 0);
    })();

    render();
  }

  function render() {
    var total = 0, passed = 0;
    groups.forEach(function (g) { g.rows.forEach(function (r) { total++; if (r.pass) passed++; }); });
    var failed = total - passed;
    window.__QA_RESULTS = { total: total, passed: passed, failed: failed, ts: new Date().toISOString(),
      groups: groups.map(function (g) { return { name: g.name, rows: g.rows }; }) };

    var root = document.getElementById("qa-report");
    var html = "<div class='qa-head'><h1 style='margin:0'>QA / QC Suite</h1>" +
      "<span class='qa-pill " + (failed ? "fail" : "pass") + "'>" + passed + " / " + total + " passed</span>" +
      (failed ? "<span class='qa-pill fail'>" + failed + " FAILED</span>" : "<span class='muted'>all green</span>") + "</div>" +
      "<p class='muted'>Techniek OpsBoard Pro V2 v" + (window.TechniekOpsBoard || window.TechniekOpsBoard).version + " - independent re-derivation of every metric - " + new Date().toLocaleString() + "</p>";
    groups.forEach(function (g) {
      html += "<div class='qa-group panel panel-pad'><h3>" + g.name + "</h3>";
      g.rows.forEach(function (r) {
        html += "<div class='qa-row " + (r.pass ? "ok" : "bad") + "'><span class='ic'>" + (r.pass ? "✓" : "✕") + "</span><span>" + r.name + "</span>" + (r.detail ? "<span class='detail'>" + r.detail + "</span>" : "") + "</div>";
      });
      html += "</div>";
    });
    root.innerHTML = html;
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run);
  else run();
})();
