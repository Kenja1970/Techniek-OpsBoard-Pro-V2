/* ===========================================================================
   Techniek OpsBoard Pro V2
   Local-first Techniek project delivery control system. Zero dependencies.
   ---------------------------------------------------------------------------
   All seeded content is fictional Techniek demo data.
   Data is stored in this browser via localStorage unless exported.
   ========================================================================= */
(function () {
  "use strict";

  /* ----------------------------------------------------------------------- *
   * Constants & configuration
   * ----------------------------------------------------------------------- */
  var STORAGE_KEY = "techniek-opsboard-v2";
  var LEGACY_STORAGE_KEY = "techniek-opsboard-pro";
  var ACCOUNTS_KEY = "techniek-opsboard-v2-accounts";
  var LEGACY_ACCOUNTS_KEY = "techniek-opsboard-accounts";
  var PRODUCT_NAME = "Techniek OpsBoard Pro V2";
  var PRODUCT_SHORT = "OpsBoard V2";
  var SCHEMA_VERSION = "5.0.0";
  var APP_VERSION = "5.0.0";
  // Kanban WIP policy: "hard" blocks pulls that would exceed a stage limit (Anderson / LeanKanban).
  // "soft" warns only (legacy demo behavior). Production default is hard.
  var WIP_POLICIES = ["hard", "soft"];
  var DEFAULT_TARGET_CM_PCT = 66.7; // Equivalent to a 3.0x A/E earned multiplier.
  var ORG_UNITS = ["Techniek-Engineering", "Techniek-Controls", "Techniek-Digital", "Techniek-Field", "Techniek-BD", "Techniek-Corporate"];
  var DEFAULT_ORG_UNIT = "Techniek-Engineering";

  // Optional OpenAI vector store for the PM Specialist procedure library.
  // Empty by default — configure per-deployment in Settings / Data.
  var OPENAI_VECTOR_STORE_ID = "";
  var PM_SPECIALIST_PROXY_DEFAULT = "http://127.0.0.1:8787";

  // PMI integrated change control.
  var CO_CATEGORIES = ["Scope", "Budget", "Schedule", "Quality", "Resource", "Other"];
  var CO_STATUS = ["Requested", "Under Review", "Approved", "Rejected", "Implemented"];
  var PROJECT_STATUS = ["Active", "Pursuit", "On Hold", "Closed", "Cancelled"];
  var ISSUE_STATUS = ["Open", "In Progress", "Resolved", "Closed", "On Hold"];
  var ISSUE_PRIORITIES = ["Critical", "High", "Moderate", "Low"];
  var DECISION_STATUS = ["Pending", "Approved", "Rejected", "Abandoned"];
  var ACTION_ITEM_TYPES = ["Action", "Issue", "Decision", "Evidence", "RFI"];
  var ACTION_ITEM_STATUS = ["Open", "In Progress", "Blocked", "Pending Evidence", "Closed"];
  var PROGRESS_MODES = ["Rules of Credit", "Manual Physical %", "Kanban Stage"];
  var ENGAGEMENT_BUCKETS = ["Weekly", "Monthly", "Yearly"];

  // PMBOK risk-response strategies and qualitative scales.
  var RISK_RESPONSES = ["Avoid", "Mitigate", "Transfer", "Accept"];              // threat strategies (PMBOK)
  var RISK_RESPONSES_OPPORTUNITY = ["Exploit", "Enhance", "Share", "Accept"];    // opportunity strategies (PMBOK)
  var RISK_TYPES = ["Threat", "Opportunity"];
  var RISK_STATUS = ["Open", "Mitigating", "Closed"];
  var RISK_CATEGORIES = ["Technical", "Schedule", "Cost", "Resource", "Compliance", "External", "Quality", "Safety", "Environmental"];
  var RISK_SCALE = [
    { v: 1, label: "Very Low" }, { v: 2, label: "Low" }, { v: 3, label: "Moderate" },
    { v: 4, label: "High" }, { v: 5, label: "Very High" },
  ];
  function riskResponsesFor(type) { return type === "Opportunity" ? RISK_RESPONSES_OPPORTUNITY : RISK_RESPONSES; }
  function allRiskResponses() { return RISK_RESPONSES.concat(RISK_RESPONSES_OPPORTUNITY.filter(function (r) { return RISK_RESPONSES.indexOf(r) === -1; })); }
  // Render at most this many cards per column before "Show more" (200+ card UX).
  var COLUMN_RENDER_CAP = 20;

  var ROLES = [
    "Admin",
    "Department Manager",
    "Project Manager",
    "Resource Manager",
    "Engineer / Contributor",
    "Viewer",
  ];
  // Roles allowed to see cost / revenue / margin.
  var FINANCIAL_ROLES = ["Admin", "Department Manager", "Project Manager", "Resource Manager"];
  var RESOURCE_MANAGE_ROLES = ["Admin", "Department Manager", "Project Manager", "Resource Manager"];
  // Roles allowed to administer governance registers (risks, change control,
  // decisions, project administration). Per the V15 security-role requirement,
  // team members (Engineer / Contributor) get read-only access to Risks,
  // Changes, and Decisions but may still raise and edit Issues.
  var REGISTER_GOVERN_ROLES = ["Admin", "Department Manager", "Project Manager", "Resource Manager"];
  var RESOURCE_TYPES = ["Employee", "Subcontractor", "Tool / Software", "Equipment", "Facility", "Material", "Other"];
  var BILLING_TYPES = ["T&M", "FP"];
  var READONLY_ROLES = ["Viewer"];

  var PRIORITIES = ["critical", "high", "medium", "low"];
  var CARD_TYPES = ["Task", "Feature", "Bug", "Proposal", "Milestone", "Risk", "Research"];

  var LABEL_COLORS = {
    Backend: "#2563eb",
    Frontend: "#7c3aed",
    Mechanical: "#0d9488",
    Electrical: "#ca8a04",
    Safety: "#dc2626",
    Documentation: "#64748b",
    Client: "#db2777",
    Compliance: "#b45309",
    Research: "#0891b2",
    Marketing: "#16a34a",
  };

  var NAV = [
    { id: "dashboard", label: "Dashboard", ico: "*" },
    { id: "workspace", label: "Project Workspace", ico: "P" },
    { id: "wbslist", label: "WBS List", ico: "W" },
    { id: "board", label: "Kanban Board", ico: "K" },
    { id: "resources", label: "Resources", ico: "R" },
    { id: "projects", label: "Projects", ico: "P" },
    { id: "changecontrol", label: "Change Control", ico: "C" },
    { id: "gantt", label: "Gantt & Critical Path", ico: "G" },
    { id: "actionitems", label: "Action Items", ico: "A" },
    { id: "rulescredit", label: "Rules of Credit", ico: "%" },
    { id: "pmspecialist", label: "PM Specialist", ico: "M" },
    { id: "reports", label: "Manager Report", ico: "R" },
    { id: "settings", label: "Settings / Data", ico: "S" },
    { id: "help", label: "Help", ico: "?" },
  ];

  /* ----------------------------------------------------------------------- *
   * Small utilities
   * ----------------------------------------------------------------------- */
  function uid(prefix) {
    return (prefix || "id") + "_" + Math.random().toString(36).slice(2, 9);
  }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  function money(n) {
    if (n == null || isNaN(n)) return "—";
    var v = Math.round(n);
    return (v < 0 ? "-$" : "$") + Math.abs(v).toLocaleString("en-US");
  }
  function moneyExact(n) {
    if (n == null || isNaN(n)) return "—";
    var v = Number(n);
    return (v < 0 ? "-$" : "$") + Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function hours(n) { return (Math.round(n * 10) / 10) + "h"; }
  function pct(n) { return Math.round(n) + "%"; }
  function pctRatio(n) { return n == null || !isFinite(n) ? "—" : pct(n * 100); }
  function pct1(n) { return n == null || !isFinite(n) ? "—" : (Math.round(n * 10) / 10).toFixed(1) + "%"; }
  function todayISO() { return new Date().toISOString().slice(0, 10); }
  function parseDate(s) { return s ? new Date(s + "T00:00:00") : null; }
  function fmtDate(s) {
    var d = parseDate(s);
    if (!d) return "—";
    return d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
  }
  function fmtDateLong(s) {
    var d = parseDate(s);
    if (!d) return "—";
    return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  }
  function addDaysISO(s, days) {
    var d = parseDate(s);
    if (!d) return null;
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }
  function daysBetweenISO(a, b) {
    var s = parseDate(a), e = parseDate(b);
    if (!s || !e) return 0;
    return Math.round((e - s) / 86400000);
  }
  function cardStart(c) { return c.startDate || c.due || null; }
  function cardFinish(c) { return c.due || c.startDate || null; }
  function cardDurationDays(c) {
    var s = cardStart(c), e = cardFinish(c);
    if (!s || !e) return null;
    return Math.max(0, daysBetweenISO(s, e)) + 1;
  }
  function daysUntil(s) {
    var d = parseDate(s);
    if (!d) return null;
    var t = new Date(todayISO() + "T00:00:00");
    return Math.round((d - t) / 86400000);
  }
  function initials(name) {
    if (!name) return "?";
    var p = name.trim().split(/\s+/);
    return ((p[0] || "")[0] || "" ) + ((p[1] || "")[0] || "");
  }
  function avatarColor(seed) {
    var colors = ["#2563eb", "#0d9488", "#7c3aed", "#db2777", "#ca8a04", "#dc2626", "#0891b2", "#16a34a", "#9333ea"];
    var h = 0;
    for (var i = 0; i < (seed || "").length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    return colors[h % colors.length];
  }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function el(tag, attrs, html) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === "class") n.className = attrs[k];
      else if (k === "dataset") for (var d in attrs[k]) n.dataset[d] = attrs[k][d];
      else n.setAttribute(k, attrs[k]);
    }
    if (html != null) n.innerHTML = html;
    return n;
  }
  function brandHTML(title, subtitle) {
    return "<div class='brand' style='padding:0'>" +
      "<img class='brand-logo' src='assets/techniek-logo.png' alt='Techniek Engineering'>" +
      "<div class='brand-text'><strong>" + esc(title || "Techniek") + "</strong><span>" + esc(subtitle || PRODUCT_NAME.replace("Techniek ", "")) + "</span></div>" +
      "</div>";
  }

  /* ----------------------------------------------------------------------- *
   * Demo workspace (fictional Techniek data)
   * ----------------------------------------------------------------------- */
  function demoWorkspace() {
    var R = function (name, role, dept, cap, cost, bill, type, company, unit, status, notes) {
      return { id: uid("r"), name: name, role: role, dept: dept, capacityHrs: cap, costRate: cost, billRate: bill, type: type || "Employee", company: company || "Techniek", unit: unit || "hour", status: status || "Active", notes: notes || "" };
    };
    var resources = [
      R("Maaike de Vries", "Project Manager", "Engineering", 32, 85, 145),
      R("Sven Bakker", "Senior Engineer", "Mechanical", 38, 78, 130),
      R("Imran Haddad", "Engineer", "Electrical", 40, 68, 120),
      R("Lotte Janssen", "Engineer", "Software", 36, 72, 125),
      R("Pieter Vermeer", "Resource Manager", "Operations", 30, 80, 0),
      R("Anja Koster", "Proposal Lead", "Business Dev", 34, 76, 0),
      R("Diego Romero", "Engineer", "Software", 40, 66, 118),
      R("Femke Visser", "Designer", "Digital", 36, 60, 110),
      R("Gulf Geotech Partners", "Survey Crew", "Subcontractor", 30, 135, 190, "Subcontractor", "Gulf Geotech Partners", "hour", "Active", "Use when internal survey staff are unavailable."),
      R("ANSYS Mechanical Enterprise", "FEA Solver", "Software", 80, 38, 0, "Tool / Software", "ANSYS", "solver-hour", "Active", "Per-use analysis tool cost."),
      R("Laser Scanner LS-500", "Field Scanner", "Equipment", 24, 55, 0, "Equipment", "Techniek", "equipment-hour", "Active", "Shared field equipment with limited weekly availability."),
    ];
    var rid = {};
    resources.forEach(function (r) { rid[r.name] = r.id; });

    function col(name, wip) { return { id: uid("col"), name: name, wip: wip || 0 }; }

    var boards = [
      {
        id: uid("b"), name: "Engineering Delivery", type: "engineering",
        columns: [col("Backlog"), col("Ready"), col("In Progress", 4), col("Review"), col("Done")],
        rosterIds: [rid["Maaike de Vries"], rid["Sven Bakker"], rid["Imran Haddad"], rid["Lotte Janssen"], rid["Diego Romero"]],
      },
      {
        id: uid("b"), name: "Proposals & BD", type: "bizdev",
        columns: [col("Identified"), col("Qualifying"), col("Proposal"), col("Gate Review"), col("Submitted"), col("Won/Lost")],
        rosterIds: [rid["Anja Koster"], rid["Maaike de Vries"]],
      },
      {
        id: uid("b"), name: "Website & Digital", type: "digital",
        columns: [col("Ideas"), col("Designing"), col("Building", 3), col("QA"), col("Live")],
        rosterIds: [rid["Femke Visser"], rid["Diego Romero"], rid["Lotte Janssen"]],
      },
      {
        id: uid("b"), name: "Operations", type: "operations",
        columns: [col("Inbox"), col("This Week"), col("Doing"), col("Blocked"), col("Complete")],
        rosterIds: [rid["Pieter Vermeer"], rid["Maaike de Vries"]],
      },
    ];
    var bid = {};
    boards.forEach(function (b) { bid[b.name] = b; });

    var programs = [
      { id: uid("pg"), name: "Gulf Coast Delivery Program", client: "Port of Houston Authority", sourceSystem: "Unanet", externalId: "CLIENT-PORT-HOUSTON" },
      { id: uid("pg"), name: "Grid Modernization Program", client: "Midwest Grid & Power", sourceSystem: "Unanet", externalId: "CLIENT-MIDWEST-GRID" },
      { id: uid("pg"), name: "Techniek Growth Program", client: "Techniek Engineering", sourceSystem: "Unanet", externalId: "CLIENT-TEK-GROWTH" },
    ];
    var portfolios = [
      { id: uid("pf"), name: "Techniek Delivery Portfolio", owningOrg: "Techniek", sourceSystem: "Unanet", externalId: "ORG-TEK-DELIVERY" },
      { id: uid("pf"), name: "Techniek Growth Portfolio", owningOrg: "Techniek", sourceSystem: "Unanet", externalId: "ORG-TEK-GROWTH" },
    ];
    var pgid = {}; programs.forEach(function (pg) { pgid[pg.name] = pg.id; });
    var pfid = {}; portfolios.forEach(function (pf) { pfid[pf.name] = pf.id; });

    var projects = [
      { id: uid("p"), name: "Harbor Crane Retrofit", client: "Port of Houston Authority", boardId: bid["Engineering Delivery"].id, programId: pgid["Gulf Coast Delivery Program"], portfolioId: pfid["Techniek Delivery Portfolio"], projectType: "Delivery", unanetProjectCode: "TEK-HCR-2601", unanetState: "Active", unanetUrl: "https://unanet.example.local/projects/TEK-HCR-2601", ermasCode: "ERMAS-HCR-2601", sourceSystem: "Unanet", budget: 10087, billable: true, billingType: "T&M", startDate: "2026-04-01", endDate: "2026-08-15", status: "Active" },
      { id: uid("p"), name: "Substation Control Upgrade", client: "Midwest Grid & Power", boardId: bid["Engineering Delivery"].id, programId: pgid["Grid Modernization Program"], portfolioId: pfid["Techniek Delivery Portfolio"], projectType: "Delivery", unanetProjectCode: "TEK-SCU-2602", unanetState: "Active", unanetUrl: "https://unanet.example.local/projects/TEK-SCU-2602", ermasCode: "ERMAS-SCU-2602", sourceSystem: "Unanet", budget: 18722, billable: true, billingType: "FP", startDate: "2026-05-12", endDate: "2026-07-30", status: "Active" },
      { id: uid("p"), name: "Offshore Survey Bid", client: "Gulf Coast Wind", boardId: bid["Proposals & BD"].id, programId: pgid["Techniek Growth Program"], portfolioId: pfid["Techniek Growth Portfolio"], projectType: "Delivery", unanetProjectCode: "TEK-OSB-2603", unanetState: "Opportunity", unanetUrl: "https://unanet.example.local/projects/TEK-OSB-2603", ermasCode: "ERMAS-OSB-2603", sourceSystem: "Unanet", budget: 82890, billable: true, billingType: "T&M", startDate: "2026-06-01", endDate: "2026-07-05", status: "Pursuit" },
      { id: uid("p"), name: "Corporate Site Relaunch", client: "Techniek (internal)", boardId: bid["Website & Digital"].id, programId: pgid["Techniek Growth Program"], portfolioId: pfid["Techniek Growth Portfolio"], projectType: "Internal", unanetProjectCode: "INT-WEB-2604", unanetState: "Active", unanetUrl: "", ermasCode: "ERMAS-WEB-2604", sourceSystem: "Local", budget: 32000, billable: false, billingType: "FP", startDate: "2026-05-01", endDate: "2026-07-20", status: "Active" },
      { id: uid("p"), name: "Workshop Lean Rollout", client: "Techniek (internal)", boardId: bid["Operations"].id, programId: pgid["Techniek Growth Program"], portfolioId: pfid["Techniek Growth Portfolio"], projectType: "Internal", unanetProjectCode: "INT-LEAN-2605", unanetState: "Active", unanetUrl: "", ermasCode: "ERMAS-LEAN-2605", sourceSystem: "Local", budget: 15000, billable: false, billingType: "FP", startDate: "2026-06-01", endDate: "2026-09-01", status: "Active" },
      { id: uid("p"), name: "Manual Progress Sample", client: "Techniek PMO", boardId: bid["Engineering Delivery"].id, programId: pgid["Techniek Growth Program"], portfolioId: pfid["Techniek Delivery Portfolio"], projectType: "Sample", unanetProjectCode: "SAMPLE-MANUAL-2606", unanetState: "Active", unanetUrl: "", ermasCode: "ERMAS-MANUAL-2606", sourceSystem: "Local sample", budget: 45000, billable: true, billingType: "T&M", startDate: "2026-07-01", endDate: "2026-08-14", status: "Active" },
      { id: uid("p"), name: "Kanban Stage Sample", client: "Techniek PMO", boardId: bid["Engineering Delivery"].id, programId: pgid["Techniek Growth Program"], portfolioId: pfid["Techniek Delivery Portfolio"], projectType: "Sample", unanetProjectCode: "SAMPLE-KANBAN-2607", unanetState: "Active", unanetUrl: "", ermasCode: "ERMAS-KANBAN-2607", sourceSystem: "Local sample", budget: 52000, billable: true, billingType: "T&M", startDate: "2026-07-06", endDate: "2026-08-28", status: "Active" },
    ];
    var pid = {};
    projects.forEach(function (p) { pid[p.name] = p; });

    var cards = [];
    var order = 0;
    function card(board, colName, o) {
      var b = bid[board];
      var c = b.columns.filter(function (x) { return x.name === colName; })[0] || b.columns[0];
      var base = {
        id: uid("c"), boardId: b.id, columnId: c.id, projectId: o.project ? pid[o.project].id : null,
        title: o.title, desc: o.desc || "", assigneeId: o.assignee ? rid[o.assignee] : null,
        priority: o.priority || "medium", type: o.type || "Task", labels: o.labels || [],
        due: o.due || null, startDate: o.start || null, estimateHours: o.est || 0, loggedHours: o.logged || 0,
        progress: o.progress != null ? o.progress : (colName === "Done" || colName === "Live" || colName === "Complete" ? 100 : 0),
        milestone: !!o.milestone, deps: [], checklist: o.checklist || [], comments: [],
        outlineNumber: o.outline || "", parentId: o.parentId || null, chargeTask: o.chargeTask || "", physicalProgress: o.physicalProgress != null ? o.physicalProgress : null,
        ermasBudget: o.ermasBudget != null ? o.ermasBudget : null, ermasActuals: o.ermasActuals != null ? o.ermasActuals : null, ermasStart: o.ermasStart || null, ermasFinish: o.ermasFinish || null, importId: o.importId || null,
        activity: [{ text: "Work item created", ts: Date.now() - (o.age || 1) * 86400000 }],
        createdAt: Date.now() - (o.age || 1) * 86400000, order: order++,
      };
      cards.push(base);
      return base;
    }

    // Engineering Delivery
    card("Engineering Delivery", "In Progress", { title: "Hydraulic actuator FEA validation", project: "Harbor Crane Retrofit", assignee: "Sven Bakker", priority: "high", type: "Feature", labels: ["Mechanical", "Safety"], due: "2026-06-26", est: 40, logged: 22, progress: 55, age: 30, checklist: [{ id: uid("ck"), text: "Mesh refinement", done: true }, { id: uid("ck"), text: "Load cases", done: true }, { id: uid("ck"), text: "Report sign-off", done: false }] });
    card("Engineering Delivery", "In Progress", { title: "PLC control loop tuning", project: "Substation Control Upgrade", assignee: "Imran Haddad", priority: "high", type: "Task", labels: ["Electrical"], due: "2026-06-22", est: 24, logged: 14, progress: 60, age: 18 });
    card("Engineering Delivery", "Review", { title: "Crane safety interlock spec", project: "Harbor Crane Retrofit", assignee: "Maaike de Vries", priority: "critical", type: "Risk", labels: ["Safety", "Compliance"], due: "2026-06-19", est: 16, logged: 16, progress: 90, age: 24 });
    card("Engineering Delivery", "Ready", { title: "Sensor harness routing", project: "Substation Control Upgrade", assignee: "Imran Haddad", priority: "medium", type: "Task", labels: ["Electrical"], due: "2026-07-04", est: 18, logged: 0, age: 8 });
    card("Engineering Delivery", "Backlog", { title: "Corrosion coating selection", project: "Harbor Crane Retrofit", assignee: "Sven Bakker", priority: "low", type: "Research", labels: ["Mechanical"], due: "2026-07-15", est: 12, logged: 0, age: 5 });
    card("Engineering Delivery", "In Progress", { title: "Control cabinet wiring diagrams", project: "Substation Control Upgrade", assignee: "Lotte Janssen", priority: "medium", type: "Feature", labels: ["Electrical", "Documentation"], due: "2026-06-28", est: 28, logged: 10, progress: 35, age: 14 });
    card("Engineering Delivery", "Done", { title: "Kickoff & requirements baseline", project: "Harbor Crane Retrofit", assignee: "Maaike de Vries", priority: "medium", type: "Milestone", labels: ["Client"], due: "2026-04-10", est: 12, logged: 12, milestone: true, age: 70 });
    card("Engineering Delivery", "Done", { title: "Grid interface FAT", project: "Substation Control Upgrade", assignee: "Diego Romero", priority: "high", type: "Task", labels: ["Electrical"], due: "2026-06-05", est: 20, logged: 21, age: 40 });
    card("Engineering Delivery", "Backlog", { title: "Commissioning milestone", project: "Harbor Crane Retrofit", assignee: "Maaike de Vries", priority: "high", type: "Milestone", labels: ["Client"], due: "2026-08-12", est: 8, logged: 0, milestone: true, age: 2 });

    // Manual Physical % sample: progress is governed by physical % only — column
    // placement must NOT rewrite progress when autoProgressFromKanban is on.
    // Dependency chain is production-consistent: predecessor is Done before successor
    // enters Review (Blocks until closed).
    var manualA = card("Engineering Delivery", "Done", { title: "Manual progress basis memo", project: "Manual Progress Sample", assignee: "Maaike de Vries", priority: "medium", type: "Task", labels: ["Documentation"], start: "2026-07-01", due: "2026-07-18", est: 24, logged: 24, progress: 100, age: 8 });
    manualA.progressMode = "Manual Physical %";
    manualA.physicalProgress = 100;
    manualA.resourceAssignments = [{ resourceId: rid["Maaike de Vries"], allocationPct: 60, role: "PM" }, { resourceId: rid["Sven Bakker"], allocationPct: 40, role: "Technical lead" }];
    var manualB = card("Engineering Delivery", "Review", { title: "Manual progress deliverable review", project: "Manual Progress Sample", assignee: "Sven Bakker", priority: "high", type: "Task", labels: ["Compliance"], start: "2026-07-19", due: "2026-08-02", est: 30, logged: 21, progress: 70, age: 2 });
    manualB.progressMode = "Manual Physical %";
    manualB.physicalProgress = 70;
    manualB.deps = [manualA.id];
    manualB.dependencyMode = "Blocks until closed";
    manualB.dependencyNote = "Review starts after the basis memo is closed (Done).";
    manualB.resourceAssignments = [{ resourceId: rid["Sven Bakker"], allocationPct: 70, role: "Reviewer" }, { resourceId: rid["Imran Haddad"], allocationPct: 30, role: "Discipline support" }];
    var manualC = card("Engineering Delivery", "Ready", { title: "Manual percent closeout evidence", project: "Manual Progress Sample", assignee: "Imran Haddad", priority: "medium", type: "Task", labels: ["Documentation"], start: "2026-08-03", due: "2026-08-14", est: 14, logged: 0, progress: 0, age: 1 });
    manualC.progressMode = "Manual Physical %";
    manualC.physicalProgress = 0;
    manualC.deps = [manualB.id];
    manualC.dependencyMode = "Blocks until closed";
    manualC.dependencyNote = "Closeout evidence waits until deliverable review is closed.";
    manualC.resourceAssignments = [{ resourceId: rid["Imran Haddad"], allocationPct: 100, role: "Owner" }];

    // Kanban Stage sample: progress MUST equal stageProgress(board, column) so
    // Summary / Financials / Gantt / Reports all derive the same % dynamically.
    var stageA = card("Engineering Delivery", "Backlog", { title: "Stage progress intake", project: "Kanban Stage Sample", assignee: "Lotte Janssen", priority: "medium", type: "Task", labels: ["Documentation"], start: "2026-07-06", due: "2026-07-15", est: 10, logged: 0, progress: 0, age: 1 });
    stageA.progressMode = "Kanban Stage";
    stageA.resourceAssignments = [{ resourceId: rid["Lotte Janssen"], allocationPct: 100, role: "Owner" }];
    var stageB = card("Engineering Delivery", "Ready", { title: "Stage progress design", project: "Kanban Stage Sample", assignee: "Lotte Janssen", priority: "medium", type: "Feature", labels: ["Electrical"], start: "2026-07-16", due: "2026-07-31", est: 22, logged: 5, progress: 25, age: 1 });
    stageB.progressMode = "Kanban Stage";
    stageB.resourceAssignments = [{ resourceId: rid["Lotte Janssen"], allocationPct: 100, role: "Owner" }];
    var stageC = card("Engineering Delivery", "In Progress", { title: "Stage progress execution", project: "Kanban Stage Sample", assignee: "Diego Romero", priority: "high", type: "Task", labels: ["Frontend"], start: "2026-08-03", due: "2026-08-21", est: 32, logged: 14, progress: 50, age: 1 });
    stageC.progressMode = "Kanban Stage";
    stageC.resourceAssignments = [{ resourceId: rid["Diego Romero"], allocationPct: 50, role: "Owner" }, { resourceId: rid["Lotte Janssen"], allocationPct: 35, role: "Support" }, { resourceId: rid["ANSYS Mechanical Enterprise"], allocationPct: 15, role: "Tool" }];
    var stageD = card("Engineering Delivery", "Done", { title: "Stage progress kickoff", project: "Kanban Stage Sample", assignee: "Maaike de Vries", priority: "low", type: "Milestone", labels: ["Client"], start: "2026-07-06", due: "2026-07-06", est: 4, logged: 4, milestone: true, age: 6 });
    stageD.progressMode = "Kanban Stage";
    stageD.resourceAssignments = [{ resourceId: rid["Maaike de Vries"], allocationPct: 100, role: "PM" }];
    // Align seeded % to board geometry (Backlog=0, Ready=25, In Progress=50, Review=75, Done=100).
    [stageA, stageB, stageC, stageD].forEach(function (sc) {
      var b = bid["Engineering Delivery"];
      sc.progress = stageProgress(b, sc.columnId);
      sc.physicalProgress = sc.progress;
    });

    // Proposals & BD
    card("Proposals & BD", "Proposal", { title: "Offshore survey technical narrative", project: "Offshore Survey Bid", assignee: "Anja Koster", priority: "high", type: "Proposal", labels: ["Client"], due: "2026-06-27", est: 30, logged: 12, progress: 40, age: 12 });
    card("Proposals & BD", "Gate Review", { title: "Pricing & margin gate", project: "Offshore Survey Bid", assignee: "Maaike de Vries", priority: "critical", type: "Risk", labels: ["Compliance"], due: "2026-06-24", est: 6, logged: 2, age: 6 });
    card("Proposals & BD", "Qualifying", { title: "Win-theme workshop", project: "Offshore Survey Bid", assignee: "Anja Koster", priority: "medium", type: "Task", due: "2026-06-30", est: 8, logged: 0, age: 3 });
    card("Proposals & BD", "Submitted", { title: "Past performance dossier", project: "Offshore Survey Bid", assignee: "Anja Koster", priority: "low", type: "Task", labels: ["Documentation"], due: "2026-06-15", est: 10, logged: 10, age: 20 });

    // Website & Digital
    card("Website & Digital", "Building", { title: "Project portfolio gallery", project: "Corporate Site Relaunch", assignee: "Femke Visser", priority: "medium", type: "Feature", labels: ["Frontend"], due: "2026-06-29", est: 22, logged: 9, progress: 40, age: 16 });
    card("Website & Digital", "Designing", { title: "Service pages content model", project: "Corporate Site Relaunch", assignee: "Femke Visser", priority: "medium", type: "Task", labels: ["Documentation"], due: "2026-07-03", est: 14, logged: 4, progress: 25, age: 9 });
    card("Website & Digital", "QA", { title: "Accessibility audit (WCAG AA)", project: "Corporate Site Relaunch", assignee: "Diego Romero", priority: "high", type: "Task", labels: ["Frontend", "Compliance"], due: "2026-06-23", est: 10, logged: 6, progress: 65, age: 7 });
    card("Website & Digital", "Live", { title: "Careers landing page", project: "Corporate Site Relaunch", assignee: "Lotte Janssen", priority: "low", type: "Feature", labels: ["Frontend", "Marketing"], due: "2026-06-01", est: 12, logged: 12, age: 30 });
    card("Website & Digital", "Ideas", { title: "Case study: Harbor Crane", project: "Corporate Site Relaunch", assignee: "Femke Visser", priority: "low", type: "Research", labels: ["Marketing"], due: "2026-07-12", est: 8, logged: 0, age: 2 });

    // Operations
    card("Operations", "Doing", { title: "5S audit — main workshop", project: "Workshop Lean Rollout", assignee: "Pieter Vermeer", priority: "medium", type: "Task", due: "2026-06-25", est: 10, logged: 4, progress: 40, age: 10 });
    card("Operations", "Blocked", { title: "Calibration lab scheduling", project: "Workshop Lean Rollout", assignee: "Pieter Vermeer", priority: "high", type: "Risk", due: "2026-06-20", est: 6, logged: 1, age: 8 });
    card("Operations", "This Week", { title: "Quarterly QHSE training", project: "Workshop Lean Rollout", assignee: "Pieter Vermeer", priority: "medium", type: "Task", labels: ["Compliance"], due: "2026-06-27", est: 8, logged: 0, age: 4 });
    card("Operations", "Inbox", { title: "Tooling inventory reconcile", project: "Workshop Lean Rollout", assignee: "Pieter Vermeer", priority: "low", type: "Task", due: "2026-07-08", est: 5, logged: 0, age: 1 });

    // Add WBS/task-control metadata and a couple of dependencies between engineering cards.
    projects.forEach(function (p) {
      var seq = 1;
      cards.filter(function (c) { return c.projectId === p.id; }).forEach(function (c) {
        c.outlineNumber = c.outlineNumber || "1." + seq++;
        c.chargeTask = c.chargeTask || (p.unanetProjectCode || "TEK") + "." + c.outlineNumber.replace(/\.$/, "");
        c.physicalProgress = c.physicalProgress == null ? c.progress : c.physicalProgress;
        c.ermasBudget = c.ermasBudget == null ? Math.round((c.estimateHours || 0) * 100) : c.ermasBudget;
        c.ermasActuals = c.ermasActuals == null ? Math.round((c.loggedHours || 0) * 100) : c.ermasActuals;
        c.ermasStart = c.ermasStart || c.startDate;
        c.ermasFinish = c.ermasFinish || c.due;
      });
    });
    var engCards = cards.filter(function (c) { return c.boardId === bid["Engineering Delivery"].id; });
    if (engCards.length >= 4) { engCards[2].deps = [engCards[0].id]; engCards[3].deps = [engCards[1].id]; }

    var risks = [
      { id: uid("rk"), projectId: pid["Harbor Crane Retrofit"].id, title: "Long-lead actuator delivery slips past commissioning", category: "Schedule", probability: 3, impact: 5, response: "Mitigate", ownerId: rid["Maaike de Vries"], status: "Mitigating", trigger: "Vendor confirmation past Jul 1", notes: "Expedite PO; qualify second supplier." },
      { id: uid("rk"), projectId: pid["Harbor Crane Retrofit"].id, title: "Safety interlock fails client acceptance", category: "Technical", probability: 2, impact: 5, response: "Avoid", ownerId: rid["Sven Bakker"], status: "Open", trigger: "FAT defect on interlock", notes: "Independent design review before FAT." },
      { id: uid("rk"), projectId: pid["Substation Control Upgrade"].id, title: "Grid interface standard revision during build", category: "Compliance", probability: 2, impact: 4, response: "Transfer", ownerId: rid["Imran Haddad"], status: "Open", trigger: "Utility issues new spec", notes: "Contract change-order clause." },
      { id: uid("rk"), projectId: pid["Offshore Survey Bid"].id, title: "Pricing below cost to win", category: "Cost", probability: 3, impact: 4, response: "Mitigate", ownerId: rid["Anja Koster"], status: "Open", trigger: "Competitor undercut", notes: "Hold margin gate; scope options." },
      { id: uid("rk"), projectId: pid["Workshop Lean Rollout"].id, title: "Calibration lab unavailable blocks audit", category: "Resource", probability: 4, impact: 3, response: "Accept", ownerId: rid["Pieter Vermeer"], status: "Mitigating", trigger: "Lab booked >2 weeks", notes: "Shift audit window; pre-book slots." },
    ];

    // Capture each project's original baseline (for change-control variance).
    projects.forEach(function (p) { p.baseline = { budget: p.budget, endDate: p.endDate }; });

    var changeOrders = [
      { id: uid("co"), projectId: pid["Harbor Crane Retrofit"].id, number: "CO-001", title: "Add cathodic protection scope", category: "Scope",
        description: "Client requested cathodic protection on the lower assembly after site survey.", requestedBy: "Rotterdam ops",
        requestedDate: "2026-05-20", budgetDelta: 18000, scheduleDeltaDays: 10,
        scopeItems: [{ title: "Cathodic protection design", estimate: 24 }, { title: "Install & test anodes", estimate: 16 }],
        status: "Approved", decidedDate: "2026-05-28", decidedBy: "Maaike de Vries", notes: "Approved at CCB; funded.", applied: true, createdCardIds: [] },
      { id: uid("co"), projectId: pid["Substation Control Upgrade"].id, number: "CO-002", title: "Schedule extension for utility outage window", category: "Schedule",
        description: "Utility moved the cutover window two weeks later.", requestedBy: "Stedin coordination",
        requestedDate: "2026-06-10", budgetDelta: 0, scheduleDeltaDays: 14, scopeItems: [],
        status: "Under Review", decidedDate: "", decidedBy: "", notes: "Awaiting CCB.", applied: false, createdCardIds: [] },
      { id: uid("co"), projectId: pid["Harbor Crane Retrofit"].id, number: "CO-003", title: "Additional load-test instrumentation", category: "Budget",
        description: "Extra strain gauges requested for acceptance testing.", requestedBy: "QA",
        requestedDate: "2026-06-18", budgetDelta: 6500, scheduleDeltaDays: 0, scopeItems: [{ title: "Instrument & calibrate strain gauges", estimate: 12 }],
        status: "Requested", decidedDate: "", decidedBy: "", notes: "", applied: false, createdCardIds: [] },
    ];

    var issues = [
      { id: uid("is"), projectId: pid["Harbor Crane Retrofit"].id, title: "Vendor submittal package missing revised coating sheet", category: "Quality", priority: "High", status: "Open", ownerId: rid["Maaike de Vries"], dueDate: "2026-06-28", description: "Blocks final design package until corrected." },
      { id: uid("is"), projectId: pid["Substation Control Upgrade"].id, title: "Utility outage confirmation not received", category: "Schedule", priority: "Critical", status: "In Progress", ownerId: rid["Imran Haddad"], dueDate: "2026-06-25", description: "Escalated through client PM." },
    ];
    var decisions = [
      { id: uid("de"), projectId: pid["Harbor Crane Retrofit"].id, title: "Use stainless strain gauge housings", details: "Approved to reduce corrosion exposure during load testing.", impact: "Adds minor material cost; reduces acceptance risk.", status: "Approved", proposedBy: "Maaike de Vries", proposedDate: "2026-05-30", approvedBy: "PMO", approvedDate: "2026-06-02" },
      { id: uid("de"), projectId: pid["Offshore Survey Bid"].id, title: "Price alternate with subcontract survey crew", details: "Keep internal team as base, subcontractor as schedule recovery alternate.", impact: "Improves proposal responsiveness.", status: "Pending", proposedBy: "Anja Koster", proposedDate: "2026-06-20", approvedBy: "", approvedDate: "" },
    ];
    var actionItems = issues.map(function (i) {
      return { id: uid("ai"), projectId: i.projectId, type: "Issue", title: i.title, status: i.status, priority: i.priority, assigneeId: i.ownerId, dueDate: i.dueDate, description: i.description, objectiveEvidence: "", evidenceRequired: "Corrective action or client confirmation", closeoutDate: "", source: "Issue register migration" };
    }).concat(decisions.map(function (d) {
      return { id: uid("ai"), projectId: d.projectId, type: "Decision", title: d.title, status: d.status === "Approved" ? "Closed" : "Open", priority: "Moderate", assigneeId: "", dueDate: d.approvedDate || d.proposedDate, description: d.details || d.impact || "", objectiveEvidence: d.approvedBy ? "Approved by " + d.approvedBy + " on " + d.approvedDate : "", evidenceRequired: "Decision record or approval note", closeoutDate: d.approvedDate || "", source: "Decision register migration" };
    }));
    var resourceEngagements = [
      { id: uid("eng"), projectId: pid["Harbor Crane Retrofit"].id, resourceId: rid["Maaike de Vries"], bucket: "Weekly", periodStart: "2026-06-21", hours: 12, source: "Local plan" },
      { id: uid("eng"), projectId: pid["Harbor Crane Retrofit"].id, resourceId: rid["Sven Bakker"], bucket: "Weekly", periodStart: "2026-06-21", hours: 30, source: "Local plan" },
      { id: uid("eng"), projectId: pid["Substation Control Upgrade"].id, resourceId: rid["Imran Haddad"], bucket: "Monthly", periodStart: "2026-06-01", hours: 96, source: "Local plan" },
      { id: uid("eng"), projectId: pid["Offshore Survey Bid"].id, resourceId: rid["Gulf Geotech Partners"], bucket: "Yearly", periodStart: "2026-01-01", hours: 120, source: "Subcontractor allowance" },
    ];
    var resourceAvailability = resources.map(function (r) { return { id: uid("av"), resourceId: r.id, effectiveDate: "2026-01-01", weeklyCapacity: r.capacityHrs, calendar: "4x10 Federal Calendar" }; });
    var imports = [];
    var auditTrail = [
      { id: uid("au"), ts: Date.now(), actor: "System", entity: "Workspace", entityId: "demo", action: "Demo workspace created", detail: PRODUCT_NAME + " local-first sample data" },
    ];
    var integrationSettings = { unanetEndpoint: "", ermasEndpoint: "", powerBiWorkspace: "", fabricErmasAccountingUrl: "", sharePointRoot: "", teamsTemplate: "", apiEndpoint: "", apiKey: "" };

    // Reflect the already-approved CO-001 in the live baseline + scope so the demo
    // is internally consistent (budget/end already include it; scope cards exist).
    var hc = pid["Harbor Crane Retrofit"];
    hc.budget += 18000;
    hc.endDate = "2026-08-25";
    var hcBoard = bid["Engineering Delivery"];
    var co1 = changeOrders[0];
    [["Cathodic protection design", 24], ["Install & test anodes", 16]].forEach(function (it) {
      var nc = { id: uid("c"), boardId: hcBoard.id, columnId: hcBoard.columns[0].id, projectId: hc.id, title: it[0], desc: "Added via " + co1.number, assigneeId: rid["Sven Bakker"], priority: "medium", type: "Task", labels: ["Client"], due: null, startDate: null, estimateHours: it[1], loggedHours: 0, progress: 0, milestone: false, deps: [], checklist: [], comments: [], activity: [{ text: "Added by change order " + co1.number, ts: Date.now() }], createdAt: Date.now(), order: order++ };
      cards.push(nc); co1.createdCardIds.push(nc.id);
    });

    projects.forEach(function (p) {
      var seq = 1;
      cards.filter(function (c) { return c.projectId === p.id; }).forEach(function (c) {
        c.outlineNumber = c.outlineNumber || "1." + seq;
        c.chargeTask = c.chargeTask || (p.unanetProjectCode || "TEK") + "." + String(c.outlineNumber || seq).replace(/.$/, "");
        c.physicalProgress = c.physicalProgress == null ? c.progress : c.physicalProgress;
        c.ermasBudget = c.ermasBudget == null ? Math.round((c.estimateHours || 0) * 100) : c.ermasBudget;
        c.ermasActuals = c.ermasActuals == null ? Math.round((c.loggedHours || 0) * 100) : c.ermasActuals;
        c.ermasStart = c.ermasStart || c.startDate;
        c.ermasFinish = c.ermasFinish || c.due;
        seq++;
      });
    });

    return {
      version: SCHEMA_VERSION,
      savedAt: Date.now(),
      activeBoardId: boards[0].id,
      resources: resources,
      boards: boards,
      portfolios: portfolios,
      programs: programs,
      projects: projects,
      cards: cards,
      risks: risks.map(normalizeRisk),
      issues: issues,
      decisions: decisions,
      actionItems: actionItems,
      changeOrders: changeOrders,
      resourceEngagements: resourceEngagements,
      resourceAvailability: resourceAvailability,
      imports: imports,
      auditTrail: auditTrail,
      integrationSettings: integrationSettings,
      rulesOfCredit: buildDefaultRulesOfCredit(),
      sharePointProcedures: buildDefaultSharePointProcedures(),
      pmDeliverables: [],
      ragQueries: [],
      vectorStoreFiles: [],
      wbsElements: [],
      history: buildInitialHistory(boards, cards),
      settings: { role: "Department Manager", theme: "light", compact: false, targetContributionMarginPct: DEFAULT_TARGET_CM_PCT, autoProgressFromKanban: true, wipPolicy: "hard", apiEndpoint: "", apiKey: "", pmSpecialistEndpoint: PM_SPECIALIST_PROXY_DEFAULT, openAiVectorStoreId: OPENAI_VECTOR_STORE_ID },
    };
  }

  function buildInitialHistory(boards, cards) {
    // Synthetic 6-week portfolio progress trend for charts/reports.
    var weeks = [];
    var totalDone = cards.filter(function (c) { return c.progress >= 100; }).length;
    var base = Math.max(2, totalDone - 5);
    for (var i = 5; i >= 0; i--) {
      var d = new Date();
      d.setDate(d.getDate() - i * 7);
      weeks.push({
        week: d.toISOString().slice(0, 10),
        completed: Math.min(cards.length, base + (5 - i) * 1 + (i === 0 ? totalDone - base - 5 : 0)),
        total: cards.length,
      });
    }
    return weeks;
  }

  /* ----------------------------------------------------------------------- *
   * State management + persistence + undo/redo
   * ----------------------------------------------------------------------- */
  var state = null;          // current workspace
  var undoStack = [];
  var redoStack = [];
  var ui = { view: "dashboard", filterAssignee: "", filterPriority: "", filterText: "", navOpen: false,
             collapsed: {}, reveal: {}, colFilter: {} };
  var accounts = null;       // { users: [...], currentUserId }

  // Per-user workspace storage key. Legacy single-user data lives at STORAGE_KEY.
  function wsKey(userId) { return userId ? STORAGE_KEY + "::" + userId : STORAGE_KEY; }
  function load(userId) {
    try {
      var raw = localStorage.getItem(wsKey(userId)) || localStorage.getItem((userId ? LEGACY_STORAGE_KEY + "::" + userId : LEGACY_STORAGE_KEY));
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && parsed.boards && parsed.cards) return migrate(parsed);
      }
    } catch (e) { /* fall through to demo */ }
    return demoWorkspace();
  }
  // Industry-standard (PMI / ISO 31000) risk record: threat/opportunity, inherent
  // and residual (post-response) probability × impact, owner, response strategy,
  // trigger, dates, and quantified cost/schedule impact.
  function normalizeRisk(rk) {
    if (!rk || typeof rk !== "object") return rk;
    rk.riskType = RISK_TYPES.indexOf(rk.riskType) !== -1 ? rk.riskType : "Threat";
    rk.probability = clamp(parseInt(rk.probability, 10) || 1, 1, 5);
    rk.impact = clamp(parseInt(rk.impact, 10) || 1, 1, 5);
    rk.residualProbability = clamp(parseInt(rk.residualProbability != null ? rk.residualProbability : rk.probability, 10) || 1, 1, 5);
    rk.residualImpact = clamp(parseInt(rk.residualImpact != null ? rk.residualImpact : rk.impact, 10) || 1, 1, 5);
    if (riskResponsesFor(rk.riskType).indexOf(rk.response) === -1) rk.response = rk.riskType === "Opportunity" ? "Enhance" : "Mitigate";
    if (RISK_STATUS.indexOf(rk.status) === -1) rk.status = "Open";
    rk.category = rk.category || "Technical";
    rk.dateIdentified = rk.dateIdentified || rk.identifiedDate || "";
    rk.lastReviewed = rk.lastReviewed || "";
    rk.dueDate = rk.dueDate || "";
    rk.costImpact = Math.max(0, parseFloat(rk.costImpact) || 0);
    rk.scheduleImpactDays = Math.max(0, parseFloat(rk.scheduleImpactDays) || 0);
    rk.trigger = rk.trigger || "";
    rk.notes = rk.notes || "";
    rk.ownerId = rk.ownerId || null;
    if (!rk.id) rk.id = uid("rk");
    return rk;
  }
  function riskScore(rk) { return (rk.probability || 0) * (rk.impact || 0); }
  function riskResidualScore(rk) { return (rk.residualProbability || 0) * (rk.residualImpact || 0); }
  function riskSevClass(score) { return score >= 15 ? "danger" : score >= 8 ? "warn" : "ok"; }

  function migrate(ws) {
    if (!ws.version) ws.version = SCHEMA_VERSION;
    if (!ws.settings) ws.settings = { role: "Department Manager", theme: "light" };
    if (ws.settings.compact == null) ws.settings.compact = false;
    if (ws.settings.targetContributionMarginPct == null) ws.settings.targetContributionMarginPct = DEFAULT_TARGET_CM_PCT;
    if (!ws.settings.apiEndpoint) ws.settings.apiEndpoint = "";
    if (!ws.settings.pmSpecialistEndpoint) ws.settings.pmSpecialistEndpoint = PM_SPECIALIST_PROXY_DEFAULT;
    if (!ws.settings.openAiVectorStoreId) ws.settings.openAiVectorStoreId = OPENAI_VECTOR_STORE_ID;
    if (ws.settings.apiKey && /^sk-/.test(String(ws.settings.apiKey))) ws.settings.apiKey = "";
    if (!ws.settings.apiKey) ws.settings.apiKey = "";
    if (!ws.history) ws.history = buildInitialHistory(ws.boards, ws.cards);
    if (!ws.portfolios) ws.portfolios = [{ id: uid("pf"), name: "Techniek Delivery Portfolio", owningOrg: "Techniek", sourceSystem: "Local", externalId: "" }];
    if (!ws.programs) ws.programs = [{ id: uid("pg"), name: "Techniek Delivery Program", client: "Techniek Engineering", sourceSystem: "Local", externalId: "" }];
    if (!ws.risks) ws.risks = [];
    if (!ws.issues) ws.issues = [];
    if (!ws.decisions) ws.decisions = [];
    if (!ws.actionItems) ws.actionItems = migrateActionItems(ws);
    if (ws.settings.autoProgressFromKanban == null) ws.settings.autoProgressFromKanban = true;
    if (WIP_POLICIES.indexOf(ws.settings.wipPolicy) === -1) ws.settings.wipPolicy = "hard";
    if (!ws.changeOrders) ws.changeOrders = [];
    if (!ws.resourceEngagements) ws.resourceEngagements = [];
    if (!ws.resourceAvailability) ws.resourceAvailability = [];
    if (!ws.imports) ws.imports = [];
    if (!ws.auditTrail) ws.auditTrail = [];
    if (!ws.rulesOfCredit) ws.rulesOfCredit = buildDefaultRulesOfCredit();
    if (!ws.sharePointProcedures) ws.sharePointProcedures = buildDefaultSharePointProcedures();
    if (!ws.pmDeliverables) ws.pmDeliverables = [];
    if (!ws.ragQueries) ws.ragQueries = [];
    if (!ws.vectorStoreFiles) ws.vectorStoreFiles = [];
    if (!ws.wbsElements) ws.wbsElements = [];
    if (!ws.integrationSettings) ws.integrationSettings = { unanetEndpoint: "", ermasEndpoint: "", powerBiWorkspace: "", fabricErmasAccountingUrl: "", sharePointRoot: "", teamsTemplate: "", apiEndpoint: ws.settings.apiEndpoint || "", apiKey: "" };
    if (ws.integrationSettings && ws.integrationSettings.fabricErmasAccountingUrl == null) ws.integrationSettings.fabricErmasAccountingUrl = "";
    if (ws.integrationSettings && /^sk-/.test(String(ws.integrationSettings.apiKey || ""))) ws.integrationSettings.apiKey = "";
    (ws.resources || []).forEach(normalizeResource);
    cleanGeneratedResourcePlaceholders(ws);
    (ws.cards || []).forEach(normalizeWorkItem);
    (ws.wbsElements || []).forEach(normalizeWbsElement);
    (ws.resourceEngagements || []).forEach(normalizeEngagement);
    (ws.risks || []).forEach(normalizeRisk);
    (ws.projects || []).forEach(function (p) { normalizeProject(p, ws); });
    ensureV38SampleProjects(ws);
    repairSampleProjectConsistency(ws);
    ws.version = SCHEMA_VERSION;
    return ws;
  }
  function migrateActionItems(ws) {
    var out = [];
    (ws.issues || []).forEach(function (i) {
      out.push({ id: i.id || uid("ai"), projectId: i.projectId, type: "Issue", title: i.title, status: i.status || "Open", priority: i.priority || "Moderate", assigneeId: i.ownerId || i.assigneeId || "", dueDate: i.dueDate || "", description: i.description || "", objectiveEvidence: i.objectiveEvidence || "", evidenceRequired: i.evidenceRequired || "Disposition note or corrective-action evidence", closeoutDate: i.closeoutDate || "", source: i.source || "Issue register migration" });
    });
    (ws.decisions || []).forEach(function (d) {
      out.push({ id: d.id || uid("ai"), projectId: d.projectId, type: "Decision", title: d.title, status: d.status === "Approved" ? "Closed" : "Open", priority: "Moderate", assigneeId: d.ownerId || "", dueDate: d.approvedDate || d.proposedDate || "", description: d.details || d.impact || "", objectiveEvidence: d.approvedBy ? "Approved by " + d.approvedBy + " on " + (d.approvedDate || "") : "", evidenceRequired: "Decision record or approval note", closeoutDate: d.approvedDate || "", source: d.source || "Decision register migration" });
    });
    return out;
  }
  function ensureV38SampleProjects(ws) {
    ws.projects = ws.projects || [];
    ws.cards = ws.cards || [];
    ws.boards = ws.boards || [];
    ws.resources = ws.resources || [];
    if (ws.projects.some(function (p) { return p.name === "Manual Progress Sample"; }) && ws.projects.some(function (p) { return p.name === "Kanban Stage Sample"; })) return;
    var board = ws.boards.filter(function (b) { return b.name === "Engineering Delivery"; })[0] || ws.boards[0];
    if (!board) return;
    board.columns = board.columns || [];
    if (!board.columns.length) board.columns = ["Backlog", "Ready", "In Progress", "Review", "Done"].map(function (name) { return { id: uid("col"), name: name, wip: name === "In Progress" ? 4 : 0 }; });
    function colId(name, fallbackIdx) {
      var hit = board.columns.filter(function (c) { return c.name === name; })[0] || board.columns[fallbackIdx || 0] || board.columns[0];
      return hit && hit.id;
    }
    function rid(name, fallbackIdx) {
      return (ws.resources.filter(function (r) { return r.name === name; })[0] || ws.resources[fallbackIdx || 0] || {}).id || null;
    }
    function project(name, code, budget, start, end) {
      var p = ws.projects.filter(function (x) { return x.name === name || x.unanetProjectCode === code; })[0];
      if (p) return normalizeProject(p, ws);
      p = normalizeProject({ id: uid("p"), name: name, client: "Techniek PMO", boardId: board.id, budget: budget, billable: true, billingType: "T&M", startDate: start, endDate: end, status: "Active", projectType: "Sample", unanetProjectCode: code, ermasCode: "ERMAS-" + code, sourceSystem: "Local sample", baseline: { budget: budget, endDate: end } }, ws);
      ws.projects.push(p);
      return p;
    }
    function addCard(p, title, colName, assigneeId, progressMode, est, logged, progress, start, due, assignments) {
      if (ws.cards.some(function (c) { return c.projectId === p.id && c.title === title; })) return null;
      var c = normalizeWorkItem({ id: uid("c"), boardId: board.id, columnId: colId(colName, 0), projectId: p.id, title: title, desc: "Reference work item demonstrating " + progressMode + " progress governance.", assigneeId: assigneeId, priority: "medium", type: "Task", labels: ["Documentation"], due: due, startDate: start, estimateHours: est, loggedHours: logged, progress: progress, physicalProgress: progress, progressMode: progressMode, milestone: false, deps: [], dependencyMode: "None", dependencyWbsCodes: [], dependencyNote: "", resourceAssignments: assignments || [], checklist: [], comments: [], activity: [{ text: "Work item created", ts: Date.now() }], createdAt: Date.now(), order: ws.cards.length });
      ws.cards.push(c);
      return c;
    }
    var pm = rid("Maaike de Vries", 0), lead = rid("Sven Bakker", 1), eng = rid("Imran Haddad", 2), sw = rid("Lotte Janssen", 3), dev = rid("Diego Romero", 4), tool = rid("ANSYS Mechanical Enterprise", 9);
    var manual = project("Manual Progress Sample", "SAMPLE-MANUAL-2606", 45000, "2026-07-01", "2026-08-14");
    var ma = addCard(manual, "Manual progress basis memo", "Done", pm, "Manual Physical %", 24, 24, 100, "2026-07-01", "2026-07-18", [{ resourceId: pm, allocationPct: 60, role: "PM" }, { resourceId: lead, allocationPct: 40, role: "Technical lead" }].filter(function (a) { return a.resourceId; }));
    var mb = addCard(manual, "Manual progress deliverable review", "Review", lead, "Manual Physical %", 30, 21, 70, "2026-07-19", "2026-08-02", [{ resourceId: lead, allocationPct: 70, role: "Reviewer" }, { resourceId: eng, allocationPct: 30, role: "Discipline support" }].filter(function (a) { return a.resourceId; }));
    var mc = addCard(manual, "Manual percent closeout evidence", "Ready", eng, "Manual Physical %", 14, 0, 0, "2026-08-03", "2026-08-14", [{ resourceId: eng, allocationPct: 100, role: "Owner" }].filter(function (a) { return a.resourceId; }));
    if (ma && mb) { mb.deps = [ma.id]; mb.dependencyMode = "Blocks until closed"; mb.dependencyNote = "Review starts after the basis memo is closed (Done)."; }
    if (mb && mc) { mc.deps = [mb.id]; mc.dependencyMode = "Blocks until closed"; mc.dependencyNote = "Closeout evidence waits until deliverable review is closed."; }
    var kanban = project("Kanban Stage Sample", "SAMPLE-KANBAN-2607", 52000, "2026-07-06", "2026-08-28");
    var ka = addCard(kanban, "Stage progress intake", "Backlog", sw, "Kanban Stage", 10, 0, 0, "2026-07-06", "2026-07-15", [{ resourceId: sw, allocationPct: 100, role: "Owner" }].filter(function (a) { return a.resourceId; }));
    var kb = addCard(kanban, "Stage progress design", "Ready", sw, "Kanban Stage", 22, 5, 25, "2026-07-16", "2026-07-31", [{ resourceId: sw, allocationPct: 100, role: "Owner" }].filter(function (a) { return a.resourceId; }));
    var kc = addCard(kanban, "Stage progress execution", "In Progress", dev, "Kanban Stage", 32, 14, 50, "2026-08-03", "2026-08-21", [{ resourceId: dev, allocationPct: 50, role: "Owner" }, { resourceId: sw, allocationPct: 35, role: "Support" }, { resourceId: tool, allocationPct: 15, role: "Tool" }].filter(function (a) { return a.resourceId; }));
    var kd = addCard(kanban, "Stage progress kickoff", "Done", pm, "Kanban Stage", 4, 4, 100, "2026-07-06", "2026-07-06", [{ resourceId: pm, allocationPct: 100, role: "PM" }].filter(function (a) { return a.resourceId; }));
    [ka, kb, kc, kd].forEach(function (sc) {
      if (!sc) return;
      sc.progress = stageProgress(board, sc.columnId);
      sc.physicalProgress = sc.progress;
    });
  }

  // Repair already-seeded sample projects so Manual / Kanban demos stay
  // production-consistent across upgrades (dependency order + stage geometry).
  function repairSampleProjectConsistency(ws) {
    ws.projects = ws.projects || [];
    ws.cards = ws.cards || [];
    ws.boards = ws.boards || [];
    var board = ws.boards.filter(function (b) { return b.name === "Engineering Delivery"; })[0] || ws.boards[0];
    if (!board) return;
    var manual = ws.projects.filter(function (p) { return p.name === "Manual Progress Sample" || p.unanetProjectCode === "SAMPLE-MANUAL-2606"; })[0];
    if (manual) {
      var mCards = ws.cards.filter(function (c) { return c.projectId === manual.id; });
      var memo = mCards.filter(function (c) { return /basis memo/i.test(c.title); })[0];
      var review = mCards.filter(function (c) { return /deliverable review/i.test(c.title); })[0];
      var close = mCards.filter(function (c) { return /closeout evidence/i.test(c.title); })[0];
      var doneCol = board.columns[board.columns.length - 1];
      var reviewCol = board.columns.filter(function (c) { return /review/i.test(c.name); })[0] || board.columns[Math.max(0, board.columns.length - 2)];
      var readyCol = board.columns.filter(function (c) { return /ready/i.test(c.name); })[0] || board.columns[1] || board.columns[0];
      if (memo && doneCol) {
        memo.columnId = doneCol.id;
        memo.progressMode = "Manual Physical %";
        memo.progress = 100;
        memo.physicalProgress = 100;
        if ((memo.loggedHours || 0) < (memo.estimateHours || 0)) memo.loggedHours = memo.estimateHours || memo.loggedHours;
      }
      if (review && reviewCol) {
        review.columnId = reviewCol.id;
        review.progressMode = "Manual Physical %";
        if (memo) { review.deps = [memo.id]; review.dependencyMode = "Blocks until closed"; }
        if (review.progress == null) review.progress = 70;
        review.physicalProgress = review.progress;
      }
      if (close && readyCol) {
        close.columnId = readyCol.id;
        close.progressMode = "Manual Physical %";
        if (review) { close.deps = [review.id]; close.dependencyMode = "Blocks until closed"; }
        close.progress = close.progress || 0;
        close.physicalProgress = close.progress;
      }
    }
    var kanban = ws.projects.filter(function (p) { return p.name === "Kanban Stage Sample" || p.unanetProjectCode === "SAMPLE-KANBAN-2607"; })[0];
    if (kanban) {
      ws.cards.filter(function (c) { return c.projectId === kanban.id; }).forEach(function (c) {
        c.progressMode = "Kanban Stage";
        c.progress = stageProgress(board, c.columnId);
        c.physicalProgress = c.progress;
      });
    }
  }

  function normalizeActionItem(a) {
    a.type = ACTION_ITEM_TYPES.indexOf(a.type) === -1 ? "Action" : a.type;
    a.status = ACTION_ITEM_STATUS.indexOf(a.status) === -1 ? "Open" : a.status;
    a.priority = ISSUE_PRIORITIES.indexOf(a.priority) === -1 ? "Moderate" : a.priority;
    a.assigneeId = a.assigneeId || a.ownerId || "";
    a.dueDate = a.dueDate || "";
    a.objectiveEvidence = a.objectiveEvidence || "";
    a.evidenceRequired = a.evidenceRequired || "Objective evidence required before closure";
    a.closeoutDate = a.closeoutDate || "";
    return a;
  }
  function save() {
    state.savedAt = Date.now();
    updateHistoryCheckpoint();
    try { localStorage.setItem(wsKey(accounts && accounts.currentUserId), JSON.stringify(state)); }
    catch (e) { toast("Could not save to localStorage", "err"); }
    updateSavedStamp();
  }
  // Keep the current week's completion checkpoint live so card create/move/edit
  // immediately flows into the dashboard trend and reports (PMI progress tracking).
  function updateHistoryCheckpoint() {
    if (!state.history) return;
    var done = state.cards.filter(function (c) { return isDone(c); }).length;
    var total = state.cards.length;
    var d = new Date();
    var monday = new Date(d); monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    var wk = monday.toISOString().slice(0, 10);
    var last = state.history[state.history.length - 1];
    if (last && last.week === wk) { last.completed = done; last.total = total; }
    else { state.history.push({ week: wk, completed: done, total: total }); if (state.history.length > 52) state.history.shift(); }
  }
  function snapshot() {
    undoStack.push(JSON.stringify(state));
    if (undoStack.length > 60) undoStack.shift();
    redoStack.length = 0;
    refreshUndoRedo();
  }
  function commit() { save(); render(); }
  function mutate(fn) { snapshot(); fn(); commit(); }
  function undo() {
    if (!undoStack.length) return;
    redoStack.push(JSON.stringify(state));
    state = JSON.parse(undoStack.pop());
    save(); render(); refreshUndoRedo(); toast("Undone");
  }
  function redo() {
    if (!redoStack.length) return;
    undoStack.push(JSON.stringify(state));
    state = JSON.parse(redoStack.pop());
    save(); render(); refreshUndoRedo(); toast("Redone");
  }
  function refreshUndoRedo() {
    var u = $("#undoBtn"), r = $("#redoBtn");
    if (u) u.disabled = !undoStack.length;
    if (r) r.disabled = !redoStack.length;
  }

  /* ----------------------------------------------------------------------- *
   * Accounts & authentication (local profiles; enterprise SSO is a stub)
   * ----------------------------------------------------------------------- *
   * This is a LOCAL convenience gate, not enterprise-grade security. Each user
   * gets an isolated workspace in localStorage. Optional passphrases are stored
   * only as a salted SHA-256 hash (never in plaintext). Real SSO requires a
   * backend identity provider — see docs/automation/improvement-backlog.md.
   * ----------------------------------------------------------------------- */
  function loadAccounts() {
    try { var a = JSON.parse(localStorage.getItem(ACCOUNTS_KEY)); if (a && a.users) return a; } catch (e) {}
    try { var la = JSON.parse(localStorage.getItem(LEGACY_ACCOUNTS_KEY)); if (la && la.users) return la; } catch (e2) {}
    return { users: [], currentUserId: null };
  }
  function saveAccounts() { try { localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts)); } catch (e) {} }
  function currentUser() { return accounts.users.filter(function (u) { return u.id === accounts.currentUserId; })[0] || null; }
  function userById(id) { return accounts.users.filter(function (u) { return u.id === id; })[0] || null; }

  function randSalt() {
    if (window.crypto && crypto.getRandomValues) {
      var a = new Uint8Array(16); crypto.getRandomValues(a);
      return Array.prototype.map.call(a, function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
    }
    return String(Math.random()).slice(2) + String(Math.random()).slice(2);
  }
  // Returns a Promise<string hash>. Uses SubtleCrypto where available (secure
  // contexts incl. https Pages); falls back to a non-crypto hash on file://.
  function hashPass(pass, salt) {
    var msg = salt + "::" + pass;
    if (window.crypto && crypto.subtle && window.isSecureContext) {
      var bytes = new TextEncoder().encode(msg);
      return crypto.subtle.digest("SHA-256", bytes).then(function (buf) {
        return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
      });
    }
    var h = 5381;
    for (var i = 0; i < msg.length; i++) h = ((h << 5) + h + msg.charCodeAt(i)) >>> 0;
    return Promise.resolve("fnv" + h.toString(16));
  }

  function createUser(displayName, pass, role) {
    var id = uid("u");
    var user = { id: id, displayName: displayName, role: role || "Department Manager", hasPass: !!pass, salt: randSalt(), hash: null, createdAt: Date.now() };
    var finish = function () { accounts.users.push(user); accounts.currentUserId = id; saveAccounts(); markUnlocked(id); };
    if (pass) return hashPass(pass, user.salt).then(function (h) { user.hash = h; finish(); return user; });
    finish(); return Promise.resolve(user);
  }
  function verifyPass(user, pass) {
    if (!user.hasPass) return Promise.resolve(true);
    return hashPass(pass, user.salt).then(function (h) { return h === user.hash; });
  }
  // Session unlock (per browser session) so a passphrase isn't asked every render.
  function markUnlocked(id) { try { sessionStorage.setItem("opsboard-unlocked", id); } catch (e) {} }
  function isUnlocked(id) { try { return sessionStorage.getItem("opsboard-unlocked") === id; } catch (e) { return true; } }
  function needsUnlock(user) { return user && user.hasPass && !isUnlocked(user.id); }

  function enterApp(userId) {
    accounts.currentUserId = userId; saveAccounts(); markUnlocked(userId);
    state = load(userId);
    var u = userById(userId);
    if (u && u.role) state.settings.role = u.role; // signed-in user's role drives visibility
    undoStack.length = 0; redoStack.length = 0;
    hideAuthGate();
    ui.view = "dashboard";
    render();
    if (!localStorage.getItem(wsKey(userId))) save();
    toast("Signed in as " + (userById(userId) || {}).displayName, "ok");
  }
  function logout() {
    try { sessionStorage.removeItem("opsboard-unlocked"); } catch (e) {}
    accounts.currentUserId = null; saveAccounts();
    renderAuthGate();
  }

  function hideAuthGate() { var g = $("#authGate"); if (g) g.remove(); document.getElementById("app").style.visibility = "visible"; }
  function renderAuthGate(prefillUserId) {
    document.getElementById("app").style.visibility = "hidden";
    var existing = $("#authGate"); if (existing) existing.remove();
    var gate = el("div", { id: "authGate", class: "auth-gate" });
    var card = el("div", { class: "auth-card" });

    var users = accounts.users;
    var selectedId = prefillUserId || (users[0] && users[0].id);
    function draw() {
      var sel = userById(selectedId);
      card.innerHTML =
        "<div class='auth-brand'>" + brandHTML("Techniek", "OpsBoard Pro V2") + "</div>" +
        "<div class='faint' style='font-size:12px;margin-top:-10px;margin-bottom:14px'>Sign in to your workspace</div>";
      var content = el("div");
      if (users.length) {
        content.appendChild(el("label", { class: "field-label inline" }, "Profile"));
        var usel = el("select", { class: "select", id: "authUser", style: "width:100%" },
          users.map(function (u) { return "<option value='" + u.id + "'" + (u.id === selectedId ? " selected" : "") + ">" + esc(u.displayName) + " · " + esc(u.role) + (u.hasPass ? " 🔒" : "") + "</option>"; }).join(""));
        usel.addEventListener("change", function () { selectedId = this.value; draw(); });
        content.appendChild(usel);
        if (sel && sel.hasPass) {
          content.appendChild(el("label", { class: "field-label inline mt" }, "Passphrase"));
          var pin = el("input", { class: "input", type: "password", id: "authPass", placeholder: "Enter passphrase" });
          pin.addEventListener("keydown", function (e) { if (e.key === "Enter") doSignIn(); });
          content.appendChild(pin);
        }
        var signBtn = el("button", { class: "btn primary mt", style: "width:100%" }, "Sign in");
        signBtn.addEventListener("click", doSignIn);
        content.appendChild(signBtn);
        content.appendChild(el("div", { class: "divider" }));
      }
      var newBtn = el("button", { class: "btn mt", style: "width:100%" }, "+ Create a profile");
      newBtn.addEventListener("click", showCreate);
      content.appendChild(newBtn);
      var ssoBtn = el("button", { class: "btn mt", style: "width:100%" }, "🏢 Sign in with Enterprise SSO");
      ssoBtn.addEventListener("click", ssoStub);
      content.appendChild(ssoBtn);
      content.appendChild(el("div", { class: "auth-note" }, "Local-first profiles keep each user's boards separate in this browser. This is a convenience gate, not enterprise security — do not store sensitive data."));
      card.appendChild(content);
    }
    function doSignIn() {
      var id = ($("#authUser") || {}).value || selectedId;
      var u = userById(id);
      if (!u) return;
      if (u.hasPass) {
        var pass = ($("#authPass") || {}).value || "";
        verifyPass(u, pass).then(function (ok) { if (ok) enterApp(id); else toast("Incorrect passphrase", "err"); });
      } else enterApp(id);
    }
    function showCreate() {
      card.innerHTML = "<div class='auth-brand'>" + brandHTML("Techniek", "OpsBoard Profile") + "</div><h2 style='margin:0 0 12px;font-size:16px'>Create a profile</h2>";
      var c = el("div");
      c.innerHTML =
        "<label class='field-label inline'>Display name</label><input class='input' id='ncName' placeholder='e.g., Jordan Lee'>" +
        "<label class='field-label inline mt'>Role</label><select class='select' id='ncRole' style='width:100%'>" + ROLES.map(function (r) { return "<option" + (r === "Department Manager" ? " selected" : "") + ">" + esc(r) + "</option>"; }).join("") + "</select>" +
        "<label class='field-label inline mt'>Passphrase (optional)</label><input class='input' id='ncPass' type='password' placeholder='Leave blank for quick local access'>";
      var create = el("button", { class: "btn primary mt", style: "width:100%" }, "Create & sign in");
      create.addEventListener("click", function () {
        var name = $("#ncName").value.trim();
        if (!name) { toast("Name is required", "err"); return; }
        createUser(name, $("#ncPass").value, $("#ncRole").value).then(function (u) { enterApp(u.id); });
      });
      c.appendChild(create);
      if (accounts.users.length) {
        var back = el("button", { class: "btn mt", style: "width:100%" }, "← Back");
        back.addEventListener("click", draw);
        c.appendChild(back);
      }
      card.appendChild(c);
      setTimeout(function () { var n = $("#ncName"); if (n) n.focus(); }, 30);
    }
    function ssoStub() {
      modal("Enterprise SSO", el("div", null,
        "<p class='muted'>Single sign-on with an enterprise identity provider (OIDC / SAML — Azure AD / Entra ID, Okta, Google Workspace) requires a backend service to complete the OAuth flow and validate tokens. This local-first prototype cannot do that securely on its own.</p>" +
        "<p class='muted'>The integration is tracked in the improvement backlog for implementation after a backend and security review are approved. For now, use a local profile.</p>"),
        [{ label: "Back to sign in", cls: "btn primary", fn: closeModal }], "sm");
    }
    draw();
    gate.appendChild(card);
    document.body.appendChild(gate);
  }

  function changePassphrase(user) {
    var body = el("div");
    body.innerHTML =
      (user.hasPass ? "<label class='field-label inline'>Current passphrase</label><input class='input' id='cpCur' type='password'>" : "") +
      "<label class='field-label inline mt'>New passphrase (blank removes it)</label><input class='input' id='cpNew' type='password'>";
    modal("Passphrase", body, [
      { label: "Cancel", cls: "btn", fn: closeModal },
      { label: "Save", cls: "btn primary", fn: function () {
        var apply = function () {
          var np = $("#cpNew").value;
          if (!np) { user.hasPass = false; user.hash = null; saveAccounts(); closeModal(); toast("Passphrase removed", "ok"); renderShell(); return; }
          user.salt = randSalt();
          hashPass(np, user.salt).then(function (h) { user.hash = h; user.hasPass = true; saveAccounts(); markUnlocked(user.id); closeModal(); toast("Passphrase updated", "ok"); renderShell(); });
        };
        if (user.hasPass) verifyPass(user, $("#cpCur").value).then(function (ok) { if (ok) apply(); else toast("Current passphrase incorrect", "err"); });
        else apply();
      } },
    ], "sm");
  }
  function deleteUser(user) {
    confirmModal("Delete profile " + user.displayName + "?", "This permanently removes the profile and its workspace data from this browser.", function () {
      try { localStorage.removeItem(wsKey(user.id)); } catch (e) {}
      accounts.users = accounts.users.filter(function (u) { return u.id !== user.id; });
      saveAccounts();
      toast("Profile deleted");
      render();
    });
  }

  /* ----------------------------------------------------------------------- *
   * Lookups & permissions
   * ----------------------------------------------------------------------- */
  function activeBoard() {
    return state.boards.filter(function (b) { return b.id === state.activeBoardId; })[0] || state.boards[0];
  }
  function resourceById(id) { return state.resources.filter(function (r) { return r.id === id; })[0] || null; }
  function projectById(id) { return state.projects.filter(function (p) { return p.id === id; })[0] || null; }
  function cardById(id) { return state.cards.filter(function (c) { return c.id === id; })[0] || null; }
  function boardCards(boardId) { return state.cards.filter(function (c) { return c.boardId === boardId; }); }
  function boardWipSummary(boardId) {
    var b = state.boards.filter(function (x) { return x.id === boardId; })[0] || activeBoard();
    var out = { boardId: b ? b.id : "", controlledStages: 0, overLimitStages: 0, totalControlled: 0, totalLimit: 0, over: [], status: "neutral", label: "WIP control: no stage limits set", detail: "Add WIP limits from column options." };
    if (!b) return out;
    (b.columns || []).forEach(function (col) {
      var limit = parseInt(col.wip, 10) || 0;
      if (!limit) return;
      var count = boardCards(b.id).filter(function (c) { return c.columnId === col.id; }).length;
      out.controlledStages++;
      out.totalControlled += count;
      out.totalLimit += limit;
      if (count > limit) out.over.push({ columnId: col.id, name: col.name, count: count, limit: limit, over: count - limit });
    });
    out.overLimitStages = out.over.length;
    if (out.overLimitStages) {
      out.status = "danger";
      out.label = "WIP control: " + out.overLimitStages + " stage" + (out.overLimitStages === 1 ? "" : "s") + " over limit";
      out.detail = out.over.map(function (x) { return x.name + " over by " + x.over + " (" + x.count + "/" + x.limit + ")"; }).join("; ");
    } else if (out.controlledStages) {
      out.status = "ok";
      out.label = "WIP control: all controlled stages within limit";
      out.detail = out.totalControlled + " cards across " + out.controlledStages + " limited stage" + (out.controlledStages === 1 ? "" : "s") + ", capacity " + out.totalLimit + ".";
    }
    return out;
  }

  function role() { return state.settings.role; }
  function canFinance() { return FINANCIAL_ROLES.indexOf(role()) !== -1; }
  function canManageResources() { return RESOURCE_MANAGE_ROLES.indexOf(role()) !== -1; }
  function canEdit() { return READONLY_ROLES.indexOf(role()) === -1; }
  function canGovernRegisters() { return canEdit() && REGISTER_GOVERN_ROLES.indexOf(role()) !== -1; }
  // Workspace/system configuration (WIP policy, role simulation, imports, scale tools).
  function canConfigureWorkspace() { return canEdit(); }
  function workspaceTabs() {
    var tabs = ["Summary", "WBS List", "Kanban", "Gantt", "Resources"];
    if (canFinance()) tabs.push("Financials");
    tabs.push("Risk Register", "Action Items", "Changes");
    if (canFinance()) tabs.push("FV/EAC");
    tabs.push("Attachments", "Reports");
    return tabs;
  }
  function filterMetricsForRole(rows) {
    if (canFinance()) return rows;
    return rows.filter(function (r) {
      if (r.group === "Financial") return false;
      if (r.group === "Executive") return r.metric === "Progress";
      if (r.group === "EVM") return r.metric === "CPI" || r.metric === "SPI";
      return true; // P6 Source metadata (file, date) is non-financial
    });
  }
  function metricGroupOptions(p) {
    var base = canFinance() ? ["Executive", "Financial", "EVM", "P6 Source", "All"] : ["EVM", "P6 Source", "All"];
    // Projects fed from an external schedule/cost system get a combined controls view.
    return p && hasSourceSystemControls(p) ? ["Schedule Controls"].concat(base) : base;
  }
  // True when a project carries source-system (P6 / ERMAS) overrides rather than
  // purely locally derived rollups.
  function hasSourceSystemControls(p) {
    return !!(p && (p.evmOverride || p.financialOverride || (p.sourceSystem && p.sourceSystem !== "Local")));
  }
  function showNewCardButtonForView(view, workspaceTab) {
    if (!canEdit()) return false;
    if (view === "board") return true;
    return view === "workspace" && (workspaceTab === "Kanban" || workspaceTab === "WBS List");
  }

  function normalizeResource(r) {
    r.type = r.type || "Employee";
    r.company = r.company || (r.type === "Employee" ? "Techniek" : "");
    r.unit = r.unit || "hour";
    r.status = r.status || "Active";
    r.notes = r.notes || "";
    r.capacityHrs = normHours(r.capacityHrs);
    r.costRate = normHours(r.costRate);
    r.billRate = normHours(r.billRate);
    return r;
  }
  function normalizeProject(p, ws) {
    if (!p.baseline) p.baseline = { budget: p.budget, endDate: p.endDate };
    if (!p.status) p.status = "Active";
    if (!p.billingType) p.billingType = p.billable ? "T&M" : "FP";
    if (!p.projectType) p.projectType = "Delivery";
    if (!p.sourceSystem) p.sourceSystem = p.unanetProjectCode ? "Unanet" : "Local";
    if (!p.unanetState) p.unanetState = p.status === "Closed" ? "Closed" : "Active";
    if (!p.unanetProjectCode) p.unanetProjectCode = "LOCAL-" + String(p.id || "PROJECT").replace(/[^a-z0-9]/gi, "").toUpperCase();
    if (!p.ermasCode) p.ermasCode = "ERMAS-" + p.unanetProjectCode;
    if (!p.orgUnit && p.orgUnit) p.orgUnit = p.orgUnit;   // legacy field migration
    if (!p.orgUnit || ORG_UNITS.indexOf(p.orgUnit) === -1) p.orgUnit = DEFAULT_ORG_UNIT;
    delete p.orgUnit;
    if (!p.programId && ws && ws.programs && ws.programs[0]) p.programId = ws.programs[0].id;
    if (!p.portfolioId && ws && ws.portfolios && ws.portfolios[0]) p.portfolioId = ws.portfolios[0].id;
    if (!p.projectPlans) p.projectPlans = [];
    p.projectPlans.forEach(function (pl) { pl.id = pl.id || uid("plan"); pl.revision = pl.revision || "Rev 0"; pl.uploadedAt = pl.uploadedAt || new Date().toISOString(); pl.status = pl.status || "Current"; });
    return p;
  }
  function normalizeWorkItem(c) {
    c.outlineNumber = c.outlineNumber || "";
    c.parentId = c.parentId || null;
    c.chargeTask = c.chargeTask || "";
    c.physicalProgress = c.physicalProgress == null ? (c.progress || 0) : normProgress(c.physicalProgress);
    c.ermasBudget = c.ermasBudget == null || c.ermasBudget === "" ? null : normHours(c.ermasBudget);
    c.ermasActuals = c.ermasActuals == null || c.ermasActuals === "" ? null : normHours(c.ermasActuals);
    c.ermasStart = c.ermasStart || null;
    c.ermasFinish = c.ermasFinish || null;
    c.importId = c.importId || null;
    c.baselineStart = c.baselineStart || null;
    c.baselineFinish = c.baselineFinish || null;
    c.preparers = c.preparers || [];
    c.reviewers = c.reviewers || [];
    c.approvers = c.approvers || [];
    c.ruleOfCreditId = c.ruleOfCreditId || "";
    c.ruleOfCreditStep = c.ruleOfCreditStep || null;
    c.progressMode = PROGRESS_MODES.indexOf(c.progressMode) === -1 ? "Kanban Stage" : c.progressMode;
    c.subcards = c.subcards || [];
    c.sourceActivities = c.sourceActivities || [];
    c.wbsCode = c.wbsCode || c.scheduleActivityId || (isLegacyWbsCode(c.outlineNumber) ? "" : c.outlineNumber) || c.chargeTask || "";
    c.scheduleActivityId = c.scheduleActivityId || (isScheduleActivityCode(c.wbsCode) ? c.wbsCode : "");
    c.parentWbsCode = c.parentWbsCode || "";
    c.scheduleTitle = c.scheduleTitle || "";
    c.deliverable = c.deliverable || "";
    c.sourceBasis = c.sourceBasis || "";
    c.entryCriteria = c.entryCriteria || "";
    c.definitionOfDone = c.definitionOfDone || "";
    c.evidenceRequired = c.evidenceRequired || "";
    c.acceptanceEvidence = c.acceptanceEvidence || "";
    c.completionEvidence = c.completionEvidence || "";
    c.billingMilestone = c.billingMilestone || "";
    c.riskOrBlocker = c.riskOrBlocker || "";
    c.dependencyMode = c.dependencyMode || "None";
    c.dependencyWbsCodes = Array.isArray(c.dependencyWbsCodes) ? c.dependencyWbsCodes : [];
    c.dependencyNote = c.dependencyNote || "";
    normalizeResourceAssignmentsForCard(c);
    c.activity = c.activity || [];
    return c;
  }
  function normalizeWbsElement(w) {
    w.id = w.id || uid("wbs");
    w.projectId = w.projectId || "";
    w.wbsCode = String(w.wbsCode || w.scheduleActivityId || "").trim().toUpperCase();
    w.parentWbsCode = String(w.parentWbsCode || "").trim().toUpperCase();
    w.title = w.title || w.scheduleTitle || "";
    w.description = w.description || "";
    w.isSummary = !!w.isSummary;
    w.sourceBasis = w.sourceBasis || "";
    w.plannedStart = w.plannedStart || "";
    w.plannedFinish = w.plannedFinish || "";
    w.percentComplete = normProgress(w.percentComplete || 0);
    w.remainingDuration = w.remainingDuration == null || w.remainingDuration === "" ? "" : normHours(w.remainingDuration);
    w.sortOrder = w.sortOrder == null ? 0 : Number(w.sortOrder) || 0;
    return w;
  }
  function isLegacyWbsCode(code) { return /^\d+(\.\d+)+$/.test(String(code || "").trim()); }
  function isScheduleActivityCode(code) { return /^(A|C|D|E|F|G|M|PPR|WD)\d+$/i.test(String(code || "").trim()); }
  function projectWbsElements(projectId) { return (state.wbsElements || []).filter(function (w) { return w.projectId === projectId; }).map(normalizeWbsElement).sort(function (a, b) { return (a.sortOrder || 0) - (b.sortOrder || 0) || a.wbsCode.localeCompare(b.wbsCode); }); }
  function wbsByCode(projectId, code) {
    code = String(code || "").toUpperCase();
    return projectWbsElements(projectId).filter(function (w) { return w.wbsCode === code; })[0] || null;
  }
  function cardWbsCode(c) { return c ? (c.wbsCode || c.scheduleActivityId || (isLegacyWbsCode(c.outlineNumber) ? "" : c.outlineNumber) || c.chargeTask || "") : ""; }
  // Group a WBS/activity code under its top-level WBS parent. Derived from the
  // project's own WBS hierarchy rather than any hardcoded coding convention, so
  // it works for imported P6 schedules and locally authored WBS alike.
  function wbsGroupForCode(code) {
    code = String(code || "").toUpperCase().trim();
    if (!code) return "";
    var all = (state.wbsElements || []);
    var el0 = all.filter(function (w) { return String(w.wbsCode || "").toUpperCase() === code; })[0];
    if (!el0) return "";
    var guard = 0, cur = el0;
    while (cur && cur.parentWbsCode && guard++ < 20) {
      var parent = all.filter(function (w) {
        return w.projectId === cur.projectId && String(w.wbsCode || "").toUpperCase() === String(cur.parentWbsCode || "").toUpperCase();
      })[0];
      if (!parent) break;
      cur = parent;
    }
    return cur ? String(cur.wbsCode || "").toUpperCase() : "";
  }
  function normalizeEngagement(e) {
    e.bucket = ENGAGEMENT_BUCKETS.indexOf(e.bucket) === -1 ? "Weekly" : e.bucket;
    e.hours = normHours(e.hours);
    e.periodStart = e.periodStart || todayISO();
    e.source = e.source || "Local plan";
    return e;
  }
  function recordAudit(entity, entityId, action, detail) {
    state.auditTrail = state.auditTrail || [];
    state.auditTrail.unshift({ id: uid("au"), ts: Date.now(), actor: (currentUser() || {}).displayName || "Local user", entity: entity, entityId: entityId || "", action: action, detail: detail || "" });
    if (state.auditTrail.length > 1000) state.auditTrail.length = 1000;
  }
  function cardBudget(c) { return Math.max(c.estimateHours || 0, c.loggedHours || 0) * resourceBillRate(c); }
  function cardConsumed(c) { return c.ermasActuals != null ? c.ermasActuals : (c.loggedHours || 0) * resourceBillRate(c); }
  function cardRemaining(c) { return Math.max(0, cardBudget(c) - cardConsumed(c)); }
  function taskVarianceFlags(c) {
    var budget = cardBudget(c), ermasBudget = c.ermasBudget;
    var start = cardStart(c), finish = cardFinish(c);
    return {
      budgetLow: ermasBudget != null && budget <= ermasBudget * 0.96,
      budgetHigh: ermasBudget != null && budget >= ermasBudget * 1.04,
      startEarly: !!(c.ermasStart && start && start < c.ermasStart),
      finishLate: !!(c.ermasFinish && finish && finish > c.ermasFinish),
    };
  }
  function taskVarianceClass(c, field) {
    var f = taskVarianceFlags(c);
    if (field === "budget" && f.budgetHigh) return "danger";
    if (field === "budget" && f.budgetLow) return "warn";
    if (field === "start" && f.startEarly) return "warn";
    if (field === "finish" && f.finishLate) return "warn";
    return "ok";
  }
  function resourceByName(name) {
    name = String(name || "").trim().toLowerCase();
    if (!name) return null;
    return (state.resources || []).filter(function (x) { return String(x.name || "").toLowerCase() === name; })[0] || null;
  }
  function resourceHasRate(r) { return !!(r && r.name && (normHours(r.costRate) > 0 || normHours(r.billRate) > 0)); }
  function normalizeResourceAssignmentsForCard(c) {
    if (!c) return [];
    var rows = Array.isArray(c.resourceAssignments) ? c.resourceAssignments : [];
    var seen = {};
    rows = rows.map(function (a) {
      var rid = a && (a.resourceId || a.id);
      return { resourceId: rid || "", allocationPct: clamp(parseFloat(a && a.allocationPct) || 0, 0, 100), role: (a && a.role) || "" };
    }).filter(function (a) {
      if (!a.resourceId || !resourceById(a.resourceId) || seen[a.resourceId]) return false;
      seen[a.resourceId] = true;
      return true;
    }).slice(0, 3);
    if (!rows.length && c.assigneeId && resourceById(c.assigneeId)) rows.push({ resourceId: c.assigneeId, allocationPct: 100, role: "Primary" });
    if (rows.length && rows.reduce(function (a, x) { return a + x.allocationPct; }, 0) <= 0) rows[0].allocationPct = 100;
    c.resourceAssignments = rows;
    c.assigneeId = rows.length ? rows[0].resourceId : (c.assigneeId || null);
    return rows;
  }
  function cardAssignments(c) { return normalizeResourceAssignmentsForCard(c).slice(0, 3); }
  function cardResourceShare(c, resourceId) {
    var hit = cardAssignments(c).filter(function (a) { return a.resourceId === resourceId; })[0];
    return hit ? hit.allocationPct / 100 : 0;
  }
  function cardBlendedRate(c, field, fallback) {
    var rows = cardAssignments(c);
    if (!rows.length) return fallback || 0;
    var total = 0, weighted = 0;
    rows.forEach(function (a) {
      var r = resourceById(a.resourceId);
      var share = Math.max(0, a.allocationPct || 0);
      total += share;
      weighted += share * (r && r[field] != null ? normHours(r[field]) : (fallback || 0));
    });
    return total ? weighted / total : (fallback || 0);
  }
  function assignmentSummary(c) {
    return cardAssignments(c).map(function (a) {
      var r = resourceById(a.resourceId);
      return (r ? r.name : "Unknown") + " " + Math.round(a.allocationPct || 0) + "%";
    }).join(", ") || "Unassigned";
  }
  function firstName(name) { return String(name || "").trim().split(/\s+/)[0] || name || ""; }
  // Card-face team block: the responsible (lead) resource shown by name + role,
  // then the allocated team as labeled percentage chips (NN: visibility of who
  // owns the work, recognition over recall — no hover required to read shares).
  function cardTeamHTML(c) {
    var team = cardAssignments(c);
    if (!team.length) return "<div class='card-unassigned' title='No resource assigned'>&#9711; Unassigned</div>";
    var lead = team[0];
    var leadR = resourceById(lead.resourceId);
    if (!leadR) return "<div class='card-unassigned' title='No resource assigned'>&#9711; Unassigned</div>";
    var leadSub = lead.role || leadR.role || leadR.type || "";
    var html = "<div class='card-team'>";
    html += "<div class='card-team-lead' title='Responsible: " + esc(leadR.name) + (leadSub ? " (" + esc(leadSub) + ")" : "") + " - " + Math.round(lead.allocationPct || 0) + "%'>" +
      "<span class='avatar' style='background:" + avatarColor(leadR.name) + "'>" + esc(initials(leadR.name)) + "</span>" +
      "<span class='lead-info'><span class='lead-name'>" + esc(leadR.name) + "</span>" + (leadSub ? "<span class='lead-sub'>" + esc(leadSub) + "</span>" : "") + "</span>" +
      "<span class='lead-pct'>" + Math.round(lead.allocationPct || 0) + "%</span></div>";
    var rest = team.slice(1).filter(function (a) { return resourceById(a.resourceId); });
    if (rest.length) {
      html += "<div class='team-chips'>";
      rest.forEach(function (a) {
        var ar = resourceById(a.resourceId);
        html += "<span class='team-chip' title='" + esc(ar.name) + (a.role ? " (" + esc(a.role) + ")" : "") + " - " + Math.round(a.allocationPct || 0) + "%'>" +
          "<span class='avatar' style='background:" + avatarColor(ar.name) + "'>" + esc(initials(ar.name)) + "</span>" +
          "<span class='tc-name'>" + esc(firstName(ar.name)) + "</span><span class='tc-pct'>" + Math.round(a.allocationPct || 0) + "%</span></span>";
      });
      html += "</div>";
    }
    html += "</div>";
    return html;
  }
  function cleanGeneratedResourcePlaceholders(ws) {
    ws = ws || state;
    var remove = {};
    (ws.resources || []).forEach(function (r) {
      var generated = r.role === "Imported Team Member" || r.notes === "Created by WBS import" || r.dept === "Imported";
      if (generated && (!r.name || r.costRate === 70 && r.billRate === 120 || r.role === "Imported Team Member")) remove[r.id] = true;
    });
    if (!Object.keys(remove).length) return 0;
    (ws.cards || []).forEach(function (c) {
      if (remove[c.assigneeId]) c.assigneeId = null;
      c.resourceAssignments = (c.resourceAssignments || []).filter(function (a) { return !remove[a.resourceId]; });
    });
    (ws.boards || []).forEach(function (b) { b.rosterIds = (b.rosterIds || []).filter(function (rid) { return !remove[rid]; }); });
    ws.resources = (ws.resources || []).filter(function (r) { return !remove[r.id]; });
    return Object.keys(remove).length;
  }
  function resourceEngagementRollup(resourceId, projectId) {
    var rows = (state.resourceEngagements || []).filter(function (e) { return (!resourceId || e.resourceId === resourceId) && (!projectId || e.projectId === projectId); });
    var out = { weekly: 0, monthly: 0, yearly: 0, rows: rows };
    rows.forEach(function (e) {
      normalizeEngagement(e);
      if (e.bucket === "Weekly") out.weekly += e.hours;
      else if (e.bucket === "Monthly") out.monthly += e.hours;
      else if (e.bucket === "Yearly") out.yearly += e.hours;
    });
    out.weeklyEquivalent = out.weekly + out.monthly / 4.348 + out.yearly / 52;
    return out;
  }



  /* ----------------------------------------------------------------------- *
   * PM Specialist, vector-store, SharePoint procedure, and rules-of-credit helpers
   * ----------------------------------------------------------------------- */
  // Default A/E rules-of-credit schemas. Each schema's increments sum to 100%;
  // reportedOutPct is the cumulative physical-percent credited at that step.
  function buildDefaultRulesOfCredit() {
    function roc(id, name, steps) {
      var cum = 0;
      var built = steps.map(function (s, i) {
        cum += s[1];
        return { step: i + 1, incrementPct: s[1], reportedOutPct: cum, description: s[0] };
      });
      return { id: id, name: name, source: "Techniek PMO standard", steps: built, totalPct: cum, finalReportedOutPct: cum };
    }
    return [
      roc("deliverable-prep-review-issue", "Deliverable — prepare / review / issue", [
        ["Outline and basis of design agreed", 10],
        ["Draft prepared", 40],
        ["Internal discipline review complete", 20],
        ["Client review comments incorporated", 20],
        ["Final issued and accepted", 10],
      ]),
      roc("calculation-package", "Calculation package", [
        ["Inputs and assumptions documented", 20],
        ["Calculation performed", 40],
        ["Independent check complete", 25],
        ["Approved and released", 15],
      ]),
      roc("drawing-package", "Drawing package", [
        ["Concept / markup complete", 15],
        ["Model or drafting complete", 45],
        ["Checked and back-checked", 25],
        ["Issued for construction", 15],
      ]),
      roc("study-assessment-report", "Study or assessment report", [
        ["Data collection complete", 25],
        ["Analysis complete", 35],
        ["Draft report issued", 25],
        ["Final report accepted", 15],
      ]),
      roc("field-commissioning", "Field / commissioning activity", [
        ["Mobilization and readiness review", 15],
        ["Execution complete", 55],
        ["Punch list closed", 20],
        ["Turnover package accepted", 10],
      ]),
      roc("milestone-single-step", "Milestone (single step)", [
        ["Milestone achieved and evidenced", 100],
      ]),
    ];
  }
  function buildDefaultSharePointProcedures() {
    return [
      { id: uid("sp"), title: "PM Specialist procedure registry", sharePointUrl: "", procedureVersion: "Pending", vectorFileId: "", vectorVersion: "Pending", sourceHash: "", lastChecked: "", owner: "PMO", status: "Needs source", notes: "Register SharePoint source URL and approved revision before production use." },
      { id: uid("sp"), title: "Rules of Credit — Techniek PMO standard", sharePointUrl: "", procedureVersion: "Rev 0", vectorFileId: "", vectorVersion: "", sourceHash: "", lastChecked: todayISO(), owner: "PMO", status: "Needs version", notes: "Built-in default schemas. Register the controlled procedure before production use." },
    ];
  }
  function pmProxyBase() { return String(state.settings.pmSpecialistEndpoint || PM_SPECIALIST_PROXY_DEFAULT).replace(/\/+$/, ""); }
  function pmVectorStoreId() { return state.settings.openAiVectorStoreId || OPENAI_VECTOR_STORE_ID; }
  function secretWarning() { return "OpenAI API keys are not stored in browser localStorage. Use server/.env.local with the local proxy."; }
  function procedureVersionStatus(p) {
    if (!p.sharePointUrl || !p.vectorFileId) return "Needs source";
    if (!p.procedureVersion || !p.vectorVersion) return "Needs version";
    if (String(p.procedureVersion).trim() !== String(p.vectorVersion).trim()) return "Outdated";
    return "Current";
  }
  function refreshProcedureStatuses() {
    (state.sharePointProcedures || []).forEach(function (p) { p.status = procedureVersionStatus(p); p.lastChecked = todayISO(); });
  }
  function rulesOfCreditValidation() {
    return (state.rulesOfCredit || []).map(function (r) {
      var total = (r.steps || []).reduce(function (a, s) { return a + normHours(s.incrementPct); }, 0);
      var finalOut = r.finalReportedOutPct != null ? normHours(r.finalReportedOutPct) : ((r.steps || []).length ? normHours(r.steps[r.steps.length - 1].reportedOutPct) : 0);
      return { id: r.id, name: r.name, totalPct: Math.round(total * 100) / 100, finalReportedOutPct: finalOut, valid: Math.abs(total - 100) <= 0.5 || Math.abs(finalOut - 100) <= 0.5 };
    });
  }
  function ruleById(ruleId) { return (state.rulesOfCredit || []).filter(function (r) { return r.id === ruleId; })[0] || null; }
  function ruleUsageCounts(projectId) {
    var counts = {};
    (state.rulesOfCredit || []).forEach(function (r) { counts[r.id] = 0; });
    state.cards.filter(function (c) { return !projectId || c.projectId === projectId; }).forEach(function (c) {
      if (c.ruleOfCreditId) counts[c.ruleOfCreditId] = (counts[c.ruleOfCreditId] || 0) + 1;
    });
    return counts;
  }
  function deleteRuleOfCredit(ruleId) {
    var r = ruleById(ruleId);
    if (!r) return 0;
    state.rulesOfCredit = (state.rulesOfCredit || []).filter(function (x) { return x.id !== ruleId; });
    state.cards.forEach(function (c) { if (c.ruleOfCreditId === ruleId) c.ruleOfCreditId = ""; });
    recordAudit("Rule of Credit", ruleId, "Rule deleted", r.name);
    return 1;
  }
  function vectorStoreFileName(f) {
    return f.filename || (f.file && f.file.filename) || (f.attributes && (f.attributes.title || f.attributes.filename || f.attributes.procedureVersion)) || f.file_id || f.id || "";
  }
  function latestFundingValue(p) {
    var profile = (p && p.fundingProfile) || [];
    if (profile.length) return profile[profile.length - 1].fundedValue;
    return p ? p.budget : 0;
  }
  function contractValue(p) { return latestFundingValue(p); }
  function applyRuleOfCredit(cardId, ruleId, stepNumber) {
    var c = cardById(cardId);
    var r = (state.rulesOfCredit || []).filter(function (x) { return x.id === ruleId; })[0];
    if (!c || !r) return null;
    var step = (r.steps || []).filter(function (s) { return Number(s.step) === Number(stepNumber); })[0] || (r.steps || [])[0];
    if (!step) return null;
    var pctDone = normProgress(step.reportedOutPct);
    c.ruleOfCreditId = r.id;
    c.ruleOfCreditStep = step.step;
    c.physicalProgress = pctDone;
    var effort = effortFieldState(c.estimateHours || 0, c.loggedHours || 0, pctDone, "progress");
    c.loggedHours = effort.loggedHours;
    c.progress = effort.progress;
    c.activity = c.activity || [];
    c.activity.push({ text: "Rule of credit applied: " + r.name + " step " + step.step + " (" + pctDone + "%)", ts: Date.now() });
    recordAudit("Rule of Credit", c.id, "Rule applied", c.title + " = " + pctDone + "%");
    save();
    return c;
  }
  function localPmSearch(query) {
    var q = String(query || "").toLowerCase();
    var hits = [];
    function add(kind, title, text) { if (!q || (String(kind + " " + title + " " + text).toLowerCase().indexOf(q) !== -1)) hits.push({ kind: kind, title: title, text: text }); }
    (state.rulesOfCredit || []).forEach(function (r) { add("Rule of Credit", r.name, (r.steps || []).map(function (s) { return s.reportedOutPct + "%: " + s.description; }).join(" | ")); });
    (state.sharePointProcedures || []).forEach(function (p) { add("Procedure", p.title, p.status + " " + p.procedureVersion + " " + p.notes); });
    (state.wbsElements || []).forEach(function (w) { add("WBS element", w.wbsCode + " " + w.title, (w.parentWbsCode || "") + " " + (w.sourceBasis || "")); });
    state.cards.slice(0, 300).forEach(function (c) { add("Work item", c.title, (c.desc || "") + " " + cardWbsCode(c) + " " + (c.scheduleTitle || "") + " " + (c.sourceBasis || "")); });
    return hits.slice(0, 24);
  }
  async function pmProxyJson(path, options) {
    var res = await fetch(pmProxyBase() + path, options || {});
    var text = await res.text();
    var data = text ? JSON.parse(text) : {};
    if (!res.ok) throw new Error(data.error || res.statusText || "PM Specialist proxy error");
    return data;
  }

  /* ----------------------------------------------------------------------- *
   * Calculations
   * ----------------------------------------------------------------------- */
  function normHours(n) { return Math.max(0, parseFloat(n) || 0); }
  function normProgress(n) { return clamp(Math.round(parseFloat(n) || 0), 0, 100); }
  function roundHours(n) { return Math.round((n || 0) * 100) / 100; }
  function progressFromEffort(estimateHours, loggedHours) {
    var est = normHours(estimateHours), logged = normHours(loggedHours);
    if (est <= 0) return logged > 0 ? 100 : 0;
    return normProgress((logged / est) * 100);
  }
  function effortFieldState(estimateHours, loggedHours, progress, changedField) {
    var est = normHours(estimateHours), logged = normHours(loggedHours), prog = normProgress(progress);
    if (changedField === "progress") logged = roundHours(est * (prog / 100));
    else prog = progressFromEffort(est, logged);
    return { estimateHours: est, loggedHours: logged, progress: prog };
  }
  function cardCost(c) {
    return (c.loggedHours || 0) * cardBlendedRate(c, "costRate", 70);
  }
  function cardCommitted(c) {
    return Math.max(c.estimateHours || 0, c.loggedHours || 0) * cardBlendedRate(c, "costRate", 70);
  }
  function syncProjectScheduleFromCards(projectId) {
    var p = projectById(projectId);
    if (!p) return;
    var dates = [];
    if (p.startDate) dates.push(p.startDate);
    if (p.endDate) dates.push(p.endDate);
    state.cards.forEach(function (c) {
      if (c.projectId !== projectId) return;
      var s = cardStart(c), f = cardFinish(c);
      if (s) dates.push(s);
      if (f) dates.push(f);
    });
    if (!dates.length) return;
    dates.sort();
    p.startDate = dates[0];
    p.endDate = dates[dates.length - 1];
  }
  function rescheduleCard(cardId, deltaDays) {
    var card = cardById(cardId);
    if (!card || !deltaDays) return card;
    var startISO = cardStart(card), finishISO = cardFinish(card);
    if (!startISO && !finishISO) return card;
    if (!startISO) startISO = finishISO;
    if (!finishISO) finishISO = startISO;
    var newStart = addDaysISO(startISO, deltaDays);
    var newFinish = addDaysISO(finishISO, deltaDays);
    card.startDate = newStart;
    card.due = newFinish;
    syncProjectScheduleFromCards(card.projectId);
    card.activity = card.activity || [];
    card.activity.push({ text: "Rescheduled on Gantt to " + fmtDate(newStart) + " - " + fmtDate(newFinish), ts: Date.now() });
    return card;
  }
  function isDone(c) {
    var b = state.boards.filter(function (x) { return x.id === c.boardId; })[0];
    if (!b) return c.progress >= 100;
    var last = b.columns[b.columns.length - 1];
    return c.columnId === last.id || c.progress >= 100;
  }
  function projectRollup(p) {
    var cs = state.cards.filter(function (c) { return c.projectId === p.id; });
    var spent = 0, committed = 0, est = 0, logged = 0, done = 0, overdue = 0;
    cs.forEach(function (c) {
      spent += cardCost(c); committed += cardCommitted(c);
      est += c.estimateHours || 0; logged += c.loggedHours || 0;
      if (isDone(c)) done++;
      var du = daysUntil(c.due);
      if (du != null && du < 0 && !isDone(c)) overdue++;
    });
    var progress = 0;
    if (cs.length) {
      var weight = cs.reduce(function (a, c) { return a + Math.max(c.estimateHours || 0, 1); }, 0);
      progress = Math.round(cs.reduce(function (a, c) {
        return a + (c.progress || 0) * Math.max(c.estimateHours || 0, 1);
      }, 0) / weight);
    }
    var revenue = p.billable ? p.budget : 0;
    var earnedRevenue = p.billable ? revenue * (progress / 100) : 0;
    var billableSpent = p.billable ? spent : 0;
    var contributionMarginDollars = p.billable ? earnedRevenue - billableSpent : 0;
    if (p.financialOverride && p.billable) {
      var fo = p.financialOverride;
      progress = fo.progressPct != null ? Number(fo.progressPct) : progress;
      revenue = fo.fundedValue || p.budget || revenue;
      earnedRevenue = fo.earnedRevenue != null ? Number(fo.earnedRevenue) : revenue * (progress / 100);
      billableSpent = fo.billableSpent != null ? Number(fo.billableSpent) : (fo.multiplier ? earnedRevenue / Number(fo.multiplier) : billableSpent);
      spent = fo.actualCost != null ? Number(fo.actualCost) : spent;
      committed = fo.targetCostBudget != null ? Number(fo.targetCostBudget) : committed;
      p.budget = revenue;
    }
    var contributionMargin = p.billable && earnedRevenue > 0 ? (earnedRevenue - billableSpent) / earnedRevenue : null;
    var contributionMarginDollarsFinal = p.billable ? earnedRevenue - billableSpent : 0;
    return {
      cards: cs.length, done: done, overdue: overdue, progress: progress,
      est: est, logged: logged, spent: spent, committed: committed,
      budget: p.budget, revenue: revenue, earnedRevenue: earnedRevenue,
      billableSpent: billableSpent, margin: contributionMarginDollarsFinal,
      contributionMargin: contributionMargin, contributionMarginDollars: contributionMarginDollarsFinal,
      burn: p.budget ? spent / p.budget : 0,
      variance: p.budget - committed,
    };
  }
  // PMI / PMBOK Earned Value Management, computed on a consistent cost basis.
  // BAC uses committed planned cost; PV is time-phased straight-line across
  // the current project schedule dates. SV is EV - PV and is reported in the
  // same cost units as EV/PV (dollars in this app), per traditional EVM.
  function projectEVM(p) {
    if (p && p.evmOverride) {
      var o = p.evmOverride;
      var cpiOverride = o.ac > 0 ? o.ev / o.ac : (o.cpi || 1);
      var spiOverride = o.pv > 0 ? o.ev / o.pv : (o.spi || 1);
      return {
        bac: o.bac || 0, ev: o.ev || 0, ac: o.ac || 0, pv: o.pv || 0,
        cpi: cpiOverride, spi: spiOverride, cv: (o.ev || 0) - (o.ac || 0), sv: (o.ev || 0) - (o.pv || 0),
        eac: cpiOverride > 0 ? (o.bac || 0) / cpiOverride : (o.bac || 0),
        sourceFile: o.sourceFile || "", p6EstimateAtCompletion: o.p6EstimateAtCompletion || null
      };
    }
    var r = projectRollup(p);
    var bac = r.committed || p.budget || 0;       // cost baseline
    var ev = bac * (r.progress / 100);            // earned value
    var ac = r.spent;                             // actual cost
    var pv = ev;                                  // planned value (fallback)
    var s = parseDate(p.startDate), e = parseDate(p.endDate);
    if (s && e && e > s) {
      var now = new Date(todayISO() + "T00:00:00");
      pv = bac * clamp((now - s) / (e - s), 0, 1);
    }
    var cpi = ac > 0 ? ev / ac : 1;               // cost performance index
    var spi = pv > 0 ? ev / pv : 1;               // schedule performance index
    return {
      bac: bac, ev: ev, ac: ac, pv: pv, cpi: cpi, spi: spi,
      cv: ev - ac, sv: ev - pv, eac: cpi > 0 ? bac / cpi : bac,
    };
  }
  function num2(n) { return (Math.round(n * 100) / 100).toFixed(2); }
  function projectMultiplier(r) { return r && r.earnedRevenue > 0 && r.billableSpent > 0 ? r.earnedRevenue / r.billableSpent : null; }
  function portfolioMultiplier(t) { return t && t.earnedRevenue > 0 && t.billableSpent > 0 ? t.earnedRevenue / t.billableSpent : null; }
  function fmtMultiplier(n) { return n == null || !isFinite(n) ? "—" : num2(n) + "x"; }
  function contributionMarginFromMultiplier(multiplier) {
    return multiplier > 0 && isFinite(multiplier) ? 1 - (1 / multiplier) : null;
  }
  function multiplierFromContributionMargin(contributionMargin) {
    return contributionMargin != null && contributionMargin < 1 ? 1 / (1 - contributionMargin) : null;
  }
  function targetContributionMarginRatio() {
    var pctTarget = parseFloat(state.settings.targetContributionMarginPct);
    if (!isFinite(pctTarget)) pctTarget = DEFAULT_TARGET_CM_PCT;
    return clamp(pctTarget, 0, 99.9) / 100;
  }
  function contributionMarginStatusClass(contributionMargin) {
    if (contributionMargin == null || !isFinite(contributionMargin)) return "neutral";
    var target = targetContributionMarginRatio();
    if (contributionMargin + 0.001 >= target) return "ok";
    return contributionMargin >= target - 0.10 ? "warn" : "danger";
  }
  // Program-level EVM: the portfolio rolled up as one program of common projects.
  // Indices use aggregate values (ΣEV/ΣAC, ΣEV/ΣPV) — the correct PMI roll-up,
  // not an average of per-project indices.
  function programEVM() {
    var t = { bac: 0, pv: 0, ev: 0, ac: 0 };
    state.projects.forEach(function (p) { var v = projectEVM(p); t.bac += v.bac; t.pv += v.pv; t.ev += v.ev; t.ac += v.ac; });
    var cpi = t.ac > 0 ? t.ev / t.ac : 1, spi = t.pv > 0 ? t.ev / t.pv : 1;
    return { bac: t.bac, pv: t.pv, ev: t.ev, ac: t.ac, cv: t.ev - t.ac, sv: t.ev - t.pv, cpi: cpi, spi: spi,
      eac: cpi > 0 ? t.bac / cpi : t.bac, projects: state.projects.length };
  }
  function resourceBillRate(c) {
    return cardBlendedRate(c, "billRate", 0);
  }
  function cardBillEAC(c) {
    return Math.max(c.estimateHours || 0, c.loggedHours || 0) * resourceBillRate(c);
  }
  function projectBillingType(p) { return p && p.billingType ? p.billingType : (p && p.billable ? "T&M" : "FP"); }
  // Internal / overhead / business-development work is not client-billable delivery
  // and is measured on budget adherence, schedule, and throughput (PMI/PMO practice)
  // rather than revenue or contribution margin. Client-facing delivery keeps the
  // existing financial metrics (contribution margin, multiplier, earned revenue).
  function isInternalProject(p) {
    if (!p) return false;
    if (p.projectType === "Internal") return true;
    if (p.billable === false) return true;
    var st = String(p.status || "").toLowerCase();
    if (st === "pursuit" || st === "opportunity") return true; // BD / proposal investment (pre-award)
    var b = (state.boards || []).filter(function (x) { return x.id === p.boardId; })[0];
    if (b && /proposal|business dev|\bbd\b/i.test(b.name || "")) return true;
    return false;
  }
  function internalProjectClass(p) {
    var st = String(p.status || "").toLowerCase();
    var b = (state.boards || []).filter(function (x) { return x.id === p.boardId; })[0];
    if (st === "pursuit" || st === "opportunity" || (b && /proposal|business dev|\bbd\b/i.test(b.name || ""))) return "Business Development";
    return "Internal / Overhead";
  }
  // Non-revenue KPI set for internal/BD projects. Budget variance is planned budget
  // minus committed cost (positive = under budget). On-time rate is a schedule
  // reliability proxy: share of work items not currently overdue.
  function internalProjectMetrics(p) {
    var r = projectRollup(p), v = projectEVM(p);
    var budget = p.budget || r.committed || 0;
    var cs = state.cards.filter(function (c) { return c.projectId === p.id; });
    var overdue = cs.filter(function (c) { var d = daysUntil(c.due); return d != null && d < 0 && !isDone(c); }).length;
    var onTimeRate = cs.length ? Math.round((cs.length - overdue) / cs.length * 100) : 100;
    return {
      class: internalProjectClass(p),
      budget: budget, committed: r.committed, invested: r.spent,
      budgetVariance: budget - r.committed, budgetVariancePct: budget ? ((budget - r.committed) / budget) * 100 : 0,
      cpi: v.cpi, spi: v.spi, progress: r.progress,
      cards: r.cards, done: r.done, overdue: overdue, onTimeRate: onTimeRate,
    };
  }
  function projectFinancialHistory(p) {
    if (!p) return [];
    var cs = state.cards.filter(function (c) { return c.projectId === p.id; });
    var approved = changeOrdersFor(p.id).filter(coApproved).sort(function (a, b) { return (a.decidedDate || a.requestedDate || "").localeCompare(b.decidedDate || b.requestedDate || ""); });
    var currentCostEAC = cs.reduce(function (a, c) { return a + cardCommitted(c); }, 0);
    var approvedBudget = approved.reduce(function (a, co) { return a + (co.budgetDelta || 0); }, 0);
    var approvedScopeCost = approved.reduce(function (a, co) {
      return a + (co.createdCardIds || []).reduce(function (s, id) { var c = cardById(id); return s + (c ? cardCommitted(c) : 0); }, 0);
    }, 0);
    var profile = (p.fundingProfile || []).slice().sort(function (a, b) { return String(a.date || "").localeCompare(String(b.date || "")); });
    var fundedValue = profile.length ? 0 : (p.baseline && p.baseline.budget != null ? p.baseline.budget : p.budget - approvedBudget);
    var targetCostBudget = Math.max(0, currentCostEAC - approvedScopeCost);
    var runningCostEAC = 0, runningBillEAC = 0;
    var events = [{ type: "baseline", date: p.startDate || todayISO(), label: "Baseline" }];
    profile.forEach(function (f) { events.push({ type: "funding", date: f.date || p.startDate || todayISO(), label: (f.event || "Funding") + " - " + (f.sourceFile || ""), funding: f }); });
    approved.forEach(function (co) { events.push({ type: "co", date: co.decidedDate || co.requestedDate || todayISO(), label: co.number + " approved", co: co }); });
    cs.forEach(function (c) {
      // Position each assignment/EAC datapoint on the schedule via the card's
      // baseline finish (fall back to baseline start / due / created date) so
      // Cost/Bill EAC accrue across the real project timeline, not all "today".
      var d = c.baselineFinish || c.due || c.baselineStart || c.startDate || new Date(c.createdAt || Date.now()).toISOString().slice(0, 10);
      events.push({ type: "card", date: String(d).slice(0, 10), label: "Assignment / EAC update: " + c.title, card: c });
    });
    events.sort(function (a, b) { return a.date.localeCompare(b.date) || (a.type === "baseline" ? -1 : b.type === "baseline" ? 1 : 0); });
    var rows = events.map(function (ev) {
      if (ev.type === "funding") {
        fundedValue = ev.funding.fundedValue || fundedValue;
      } else if (ev.type === "co") {
        fundedValue += ev.co.budgetDelta || 0;
        targetCostBudget += (ev.co.createdCardIds || []).reduce(function (s, id) { var c = cardById(id); return s + (c ? cardCommitted(c) : 0); }, 0);
      } else if (ev.type === "card") {
        runningCostEAC += cardCommitted(ev.card);
        runningBillEAC += cardBillEAC(ev.card);
      }
      return {
        date: ev.date,
        event: ev.label,
        fundedValue: fundedValue,
        targetCostBudget: targetCostBudget,
        billEAC: projectBillingType(p) === "T&M" ? (p.billEACOverride || runningBillEAC) : null,
        costEAC: p.costEACOverride || runningCostEAC,
        billingType: projectBillingType(p),
      };
    });
    return rows;
  }
  // Project schedule window for time-scaled charts: earliest baseline start to
  // latest baseline finish across the Kanban cards, widened to the contract dates.
  function projectScheduleTimeline(p) {
    if (!p) return null;
    var cs = state.cards.filter(function (c) { return c.projectId === p.id; });
    var starts = [], ends = [];
    cs.forEach(function (c) {
      var s = c.baselineStart || c.startDate || c.baselineFinish || c.due;
      var e = c.baselineFinish || c.due || c.baselineStart || c.startDate;
      if (s) starts.push(String(s).slice(0, 10));
      if (e) ends.push(String(e).slice(0, 10));
    });
    var start = starts.length ? starts.slice().sort()[0] : (p.startDate || null);
    var end = ends.length ? ends.slice().sort()[ends.length - 1] : (p.endDate || null);
    if (p.startDate && (!start || p.startDate < start)) start = p.startDate;
    if (p.endDate && (!end || p.endDate > end)) end = p.endDate;
    if (!start || !end || Date.parse(end) <= Date.parse(start)) return null;
    return { start: start, end: end };
  }
  /* ---------- Change control (PMI integrated change control) ---------- */
  function changeOrdersFor(projectId) { return (state.changeOrders || []).filter(function (co) { return co.projectId === projectId; }); }
  function coApproved(co) { return co.status === "Approved" || co.status === "Implemented"; }
  function shiftDate(iso, days) { if (!iso || !days) return iso; var d = parseDate(iso); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); }
  function coBudgetImpact(projectId) { return changeOrdersFor(projectId).filter(function (co) { return co.applied; }).reduce(function (a, co) { return a + (co.budgetDelta || 0); }, 0); }
  function coScheduleImpact(projectId) { return changeOrdersFor(projectId).filter(function (co) { return co.applied; }).reduce(function (a, co) { return a + (co.scheduleDeltaDays || 0); }, 0); }
  // Apply an approved change order to the project baseline: adjust contract value,
  // shift the schedule, and create the additional-scope cards on the board.
  function applyChangeOrder(co) {
    if (co.applied) return;
    var p = projectById(co.projectId);
    if (!p) return;
    if (!p.baseline) p.baseline = { budget: p.budget, endDate: p.endDate };
    p.budget += (co.budgetDelta || 0);
    if (co.scheduleDeltaDays) p.endDate = shiftDate(p.endDate, co.scheduleDeltaDays);
    co.createdCardIds = co.createdCardIds || [];
    var board = state.boards.filter(function (b) { return b.id === p.boardId; })[0];
    if (board) {
      (co.scopeItems || []).forEach(function (it) {
        if (!it.title) return;
        var nc = { id: uid("c"), boardId: board.id, columnId: board.columns[0].id, projectId: p.id,
          title: it.title, desc: "Added via " + co.number, assigneeId: it.assigneeId || null,
          priority: "medium", type: "Task", labels: ["Client"], due: null, startDate: null,
          estimateHours: it.estimate || 0, loggedHours: 0, progress: stageProgress(board, board.columns[0].id),
          milestone: false, deps: [], checklist: [], comments: [],
          activity: [{ text: "Added by change order " + co.number, ts: Date.now() }], createdAt: Date.now(),
          order: boardCards(board.id).filter(function (c) { return c.columnId === board.columns[0].id; }).length };
        state.cards.push(nc); co.createdCardIds.push(nc.id);
      });
    }
    co.applied = true;
  }
  // Reverse a previously applied change order (e.g., approval rescinded).
  function revertChangeOrder(co) {
    if (!co.applied) return;
    var p = projectById(co.projectId);
    if (p) { p.budget -= (co.budgetDelta || 0); if (co.scheduleDeltaDays) p.endDate = shiftDate(p.endDate, -co.scheduleDeltaDays); }
    (co.createdCardIds || []).forEach(function (id) { state.cards = state.cards.filter(function (c) { return c.id !== id; }); });
    co.createdCardIds = [];
    co.applied = false;
  }
  // Reconcile a CO's applied state to its status (call inside mutate()).
  function reconcileChangeOrder(co) {
    if (coApproved(co) && !co.applied) applyChangeOrder(co);
    else if (!coApproved(co) && co.applied) revertChangeOrder(co);
  }

  // Remaining working weeks for a card's open effort: from the later of today or
  // the card start through its finish. Time-phasing spreads a card's remaining
  // hours across its live window so utilization is a real weekly load (hours per
  // week ÷ weekly capacity), not the whole-project backlog measured against one
  // week — the standard resource-loading basis for PMI/engineering PMOs.
  function cardRemainingWeeks(c) {
    var startISO = cardStart(c), finishISO = cardFinish(c);
    var today = parseDate(todayISO());
    var begin = startISO ? parseDate(startISO) : null;
    var end = finishISO ? parseDate(finishISO) : null;
    var from = begin && begin > today ? begin : today;
    if (!end || end < from) {
      var dur = cardDurationDays(c);
      return clamp(Math.ceil((dur || 20) / 7), 1, 52);
    }
    var days = (end - from) / 86400000;
    return clamp(Math.ceil(days / 7), 1, 104);
  }
  function resourceUtil(r) {
    if (!r) return { active: 0, allocated: 0, capacity: 0, util: 0, weeklyDemand: 0, weeks: [0, 0, 0, 0] };
    var active = state.cards.filter(function (c) { return cardResourceShare(c, r.id) > 0 && !isDone(c); });
    var allocated = active.reduce(function (a, c) { return a + Math.max(0, (c.estimateHours || 0) - (c.loggedHours || 0)) * cardResourceShare(c, r.id); }, 0);
    var cap = r.capacityHrs || 1;
    // Time-phased weekly demand: each card's remaining share spread over its live weeks.
    var weeklyDemand = active.reduce(function (a, c) {
      var rem = Math.max(0, (c.estimateHours || 0) - (c.loggedHours || 0)) * cardResourceShare(c, r.id);
      return a + rem / cardRemainingWeeks(c);
    }, 0);
    var util = cap ? (weeklyDemand / cap) * 100 : 0;
    // 4-week forecast: remaining hours bucketed by due week (total backlog view).
    var weeks = [0, 0, 0, 0];
    active.forEach(function (c) {
      var du = daysUntil(c.due);
      var rem = Math.max(0, (c.estimateHours || 0) - (c.loggedHours || 0)) * cardResourceShare(c, r.id);
      var wk = du == null ? 3 : clamp(Math.floor(du / 7), 0, 3);
      weeks[wk] += rem;
    });
    return { active: active.length, allocated: allocated, capacity: cap, util: util, weeklyDemand: weeklyDemand, weeks: weeks };
  }
  function portfolioTotals() {
    var ps = state.projects.map(projectRollup);
    // Financials aggregate the projects; card counts span EVERY card on every
    // board so the dashboard never disagrees with the boards.
    var t = {
      budget: 0, spent: 0, committed: 0, revenue: 0, earnedRevenue: 0,
      billableSpent: 0, margin: 0, contributionMargin: null, contributionMarginDollars: 0,
      projectCards: 0, projectDone: 0,
    };
    ps.forEach(function (r) {
      t.budget += r.budget; t.spent += r.spent; t.committed += r.committed;
      t.revenue += r.revenue; t.earnedRevenue += r.earnedRevenue; t.billableSpent += r.billableSpent;
      t.margin += r.margin; t.contributionMarginDollars += r.contributionMarginDollars;
      t.projectCards += r.cards; t.projectDone += r.done;
    });
    t.contributionMargin = t.earnedRevenue > 0 ? t.contributionMarginDollars / t.earnedRevenue : null;
    t.cards = state.cards.length;
    t.done = state.cards.filter(function (c) { return isDone(c); }).length;
    t.overdue = state.cards.filter(function (c) { var d = daysUntil(c.due); return d != null && d < 0 && !isDone(c); }).length;
    t.dueSoon = state.cards.filter(function (c) { var d = daysUntil(c.due); return d != null && d >= 0 && d <= 7 && !isDone(c); }).length;
    return t;
  }
  function insights() {
    var out = [];
    state.projects.forEach(function (p) {
      var r = projectRollup(p);
      if (r.burn > 0.85 && p.billable) out.push({ level: "danger", projectId: p.id, title: p.name + " burn at " + pct(r.burn * 100), body: money(r.spent) + " spent of " + money(r.budget) + " budget." });
      if (r.overdue > 0) out.push({ level: "warn", projectId: p.id, title: r.overdue + " overdue task" + (r.overdue > 1 ? "s" : "") + " on " + p.name, body: "Reassign or reschedule to protect the milestone." });
      if (r.contributionMarginDollars < 0 && p.billable) out.push({ level: "danger", projectId: p.id, title: p.name + " contribution margin negative", body: "Earned revenue trails billable direct labor by " + money(-r.contributionMarginDollars) + "." });
      var v = projectEVM(p);
      if (v.ac > 500 && v.cpi < 0.9) out.push({ level: "danger", projectId: p.id, title: p.name + " cost overrun (CPI " + num2(v.cpi) + ")", body: "Earned value trails actual cost; forecast EAC " + money(v.eac) + " vs BAC " + money(v.bac) + "." });
      if (v.ac > 500 && v.spi < 0.9) out.push({ level: "warn", projectId: p.id, title: p.name + " behind schedule (SPI " + num2(v.spi) + ")", body: "Earned value is behind the time-phased plan — review critical path." });
    });
    state.resources.forEach(function (r) {
      var u = resourceUtil(r);
      if (u.util > 110) out.push({ level: "warn", title: r.name + " over-allocated (" + pct(u.util) + ")", body: hours(u.allocated) + " of remaining work vs " + hours(u.capacity) + " capacity." });
    });
    var crit = state.cards.filter(function (c) { return c.priority === "critical" && !isDone(c); });
    if (crit.length) out.push({ level: "warn", title: crit.length + " critical item" + (crit.length > 1 ? "s" : "") + " open", body: "Highest priority work needs manager attention." });
    if (!out.length) out.push({ level: "ok", title: "Portfolio healthy", body: "No budget, schedule, or capacity alerts." });
    return out.slice(0, 10);
  }
  function workflowSummaryRows() {
    return state.boards.map(function (b) {
      var cards = boardCards(b.id);
      var active = cards.filter(function (c) { return !isDone(c); });
      var done = cards.length - active.length;
      var overdue = active.filter(function (c) { var d = daysUntil(c.due); return d != null && d < 0; }).length;
      var dueSoon = active.filter(function (c) { var d = daysUntil(c.due); return d != null && d >= 0 && d <= 7; }).length;
      var progress = cards.length ? Math.round(cards.reduce(function (a, c) { return a + (c.progress || 0); }, 0) / cards.length) : 0;
      var projects = state.projects.filter(function (p) { return p.boardId === b.id; }).length;
      return { boardId: b.id, name: b.name, type: b.type || "workflow", cards: cards.length, active: active.length, done: done, overdue: overdue, dueSoon: dueSoon, progress: progress, projects: projects };
    });
  }
  function workflowSummaryTable() {
    var tbl = el("table", { class: "table table-dense" });
    tbl.innerHTML = "<thead><tr><th>Workflow</th><th class='num'>Projects</th><th class='num'>Cards</th><th class='num'>Active</th><th class='num'>Done</th><th class='num'>Due soon</th><th class='num'>Overdue</th><th>Progress</th></tr></thead>";
    var tb = el("tbody");
    workflowSummaryRows().forEach(function (r) {
      var cls = r.overdue ? "danger" : r.dueSoon ? "warn" : "ok";
      tb.appendChild(el("tr", null, "<td><strong>" + esc(r.name) + "</strong><div class='muted'>" + esc(r.type) + "</div></td><td class='num'>" + r.projects + "</td><td class='num'>" + r.cards + "</td><td class='num'>" + r.active + "</td><td class='num'>" + r.done + "</td><td class='num'>" + r.dueSoon + "</td><td class='num'><span class='badge " + cls + "'>" + r.overdue + "</span></td><td><div class='flex'><div class='bar'><span class='" + cls + "' style='width:" + clamp(r.progress, 0, 100) + "%'></span></div><span class='muted'>" + pct(r.progress) + "</span></div></td>"));
    });
    tbl.appendChild(tb);
    return tbl;
  }

  /* ----------------------------------------------------------------------- *
   * Rendering — shell
   * ----------------------------------------------------------------------- */
  function renderShell() {
    var nav = $("#nav");
    nav.innerHTML = "";
    NAV.forEach(function (n) {
      var b = el("button", { dataset: { view: n.id }, class: ui.view === n.id ? "active" : "" },
        '<span class="nav-ico">' + n.ico + "</span><span>" + esc(n.label) + "</span>");
      b.addEventListener("click", function () { go(n.id); });
      nav.appendChild(b);
    });

    var bs = $("#boardSelect");
    bs.innerHTML = state.boards.map(function (b) {
      return '<option value="' + b.id + '"' + (b.id === state.activeBoardId ? " selected" : "") + ">" + esc(b.name) + "</option>";
    }).join("");

    var rs = $("#roleSelect");
    rs.innerHTML = ROLES.map(function (r) {
      return '<option value="' + esc(r) + '"' + (r === role() ? " selected" : "") + ">" + esc(r) + "</option>";
    }).join("");
    rs.disabled = !canConfigureWorkspace();

    document.documentElement.setAttribute("data-theme", state.settings.theme);
    $("#themeBtn").textContent = state.settings.theme === "dark" ? "☀" : "🌙";
    var newCardBtn = $("#newCardBtn");
    var showNewCard = showNewCardButtonForView(ui.view, ui.workspaceTab);
    newCardBtn.hidden = !showNewCard;
    newCardBtn.disabled = !showNewCard;
    refreshUndoRedo();
    renderUserChip();
  }

  function renderUserChip() {
    var u = currentUser();
    var foot = $(".sidebar-foot");
    if (!foot) return;
    var existing = $("#userChip");
    if (existing) existing.remove();
    if (!u) return;
    var chip = el("div", { id: "userChip", class: "user-chip" });
    chip.innerHTML =
      "<span class='avatar' style='background:" + avatarColor(u.displayName) + "'>" + esc(initials(u.displayName)) + "</span>" +
      "<div class='user-chip-text'><strong>" + esc(u.displayName) + "</strong><span class='faint'>" + esc(u.role) + "</span></div>";
    var out = el("button", { class: "btn sm ghost", title: "Sign out" }, "Sign out");
    out.addEventListener("click", function () { logout(); });
    chip.appendChild(out);
    foot.insertBefore(chip, foot.firstChild);
  }

  function updateSavedStamp() {
    var hint = $(".sidebar-foot .hint");
    if (hint) hint.textContent = "Saved " + new Date(state.savedAt).toLocaleTimeString() + " · local-first";
  }

  function go(view) {
    ui.view = view;
    ui.navOpen = false;
    $("#app").classList.remove("nav-open");
    render();
    $("#view").focus();
  }

  /* ----------------------------------------------------------------------- *
   * Rendering — dispatch
   * ----------------------------------------------------------------------- */
  function render() {
    renderShell();
    var v = $("#view");
    v.innerHTML = "";
    var fn = VIEWS[ui.view] || VIEWS.dashboard;
    fn(v);
  }

  var VIEWS = {};

  /* ---------- Dashboard ---------- */
  VIEWS.dashboard = function (root) {
    var t = portfolioTotals();
    var fin = canFinance();
    root.appendChild(pageHead("Portfolio Dashboard", "Live status across all boards, projects, and resources."));

    var stats = el("div", { class: "grid cols-4" });
    stats.appendChild(statCard("Active cards", t.cards, (t.done + " completed")));
    stats.appendChild(statCard("Due in 7 days", t.dueSoon, "across all boards", t.dueSoon > 0 ? "warn" : "ok"));
    stats.appendChild(statCard("Overdue", t.overdue, "needs attention", t.overdue > 0 ? "danger" : "ok"));
    if (fin) {
      var mClass = t.contributionMargin != null && t.contributionMargin < 0 ? "danger" : "ok";
      stats.appendChild(statCard("Contribution margin", pctRatio(t.contributionMargin), money(t.earnedRevenue) + " earned · " + money(t.billableSpent) + " billable labor", mClass));
    } else {
      stats.appendChild(statCard("Boards", state.boards.length, state.projects.length + " projects"));
    }
    root.appendChild(stats);

    var twoCol = el("div", { class: "grid cols-2 mt" });

    // Status distribution chart (by column position bucket)
    var statusPanel = el("div", { class: "panel panel-pad" });
    statusPanel.appendChild(el("h2", null, "Portfolio workflow health"));
    statusPanel.appendChild(workflowSummaryTable());
    twoCol.appendChild(statusPanel);

    // Progress trend
    var trendPanel = el("div", { class: "panel panel-pad" });
    trendPanel.appendChild(el("h2", null, "Completion trend (6 weeks)"));
    trendPanel.appendChild(lineChart(state.history));
    twoCol.appendChild(trendPanel);
    root.appendChild(twoCol);

    // Insights + upcoming
    var twoCol2 = el("div", { class: "grid cols-2 mt" });
    var insightPanel = el("div", { class: "panel panel-pad" });
    insightPanel.appendChild(el("h2", null, "Insights & alerts"));
    insights().forEach(function (i) {
      var ico = i.level === "danger" ? "⛔" : i.level === "warn" ? "⚠️" : "✅";
      var node = el("div", { class: "insight " + i.level },
        '<span class="ico">' + ico + '</span><div class="insight-body"><strong>' + esc(i.title) + "</strong><span>" + esc(i.body) + "</span></div>");
      if (i.projectId && fin) {
        var b = el("button", { class: "btn sm ghost" }, "FV/EAC");
        b.addEventListener("click", function () { openProjectFinancialHistory(i.projectId); });
        node.appendChild(b);
      }
      insightPanel.appendChild(node);
    });
    twoCol2.appendChild(insightPanel);

    var duePanel = el("div", { class: "panel panel-pad" });
    duePanel.appendChild(el("h2", null, "Upcoming & overdue"));
    var upcoming = state.cards.filter(function (c) { return c.due && !isDone(c); })
      .sort(function (a, b) { return (a.due || "").localeCompare(b.due || ""); }).slice(0, 8);
    if (!upcoming.length) duePanel.appendChild(el("div", { class: "empty" }, "Nothing scheduled."));
    else {
      var tbl = el("table", { class: "table" });
      tbl.innerHTML = "<thead><tr><th>Card</th><th>Owner</th><th>Due</th>" + (fin ? "<th></th>" : "") + "</tr></thead>";
      var tb = el("tbody");
      upcoming.forEach(function (c) {
        var du = daysUntil(c.due);
        var cls = du < 0 ? "danger" : du <= 3 ? "warn" : "neutral";
        var lbl = du < 0 ? Math.abs(du) + "d late" : du === 0 ? "today" : "in " + du + "d";
        var r = resourceById(c.assigneeId);
        var tr = el("tr");
        tr.innerHTML = "<td><button class='linklike' data-open-card='" + c.id + "'>" + esc(c.title) + "</button></td>" +
          "<td>" + (r ? esc(r.name) : "—") + "</td><td><span class='badge " + cls + "'>" + esc(lbl) + "</span></td>" +
          (fin ? "<td class='right'></td>" : "");
        if (fin && c.projectId) {
          var hb = el("button", { class: "btn sm ghost" }, "FV/EAC");
          hb.addEventListener("click", function () { openProjectFinancialHistory(c.projectId); });
          tr.querySelector("td.right").appendChild(hb);
        }
        tb.appendChild(tr);
      });
      tbl.appendChild(tb);
      duePanel.appendChild(tbl);
    }
    twoCol2.appendChild(duePanel);
    root.appendChild(twoCol2);
  };

  /* ---------- Kanban board ---------- */
  VIEWS.board = function (root) {
    var b = activeBoard();
    var head = pageHead(b.name, "Drag cards between stages. Columns are editable.");
    root.appendChild(head);

    // Toolbar: filters
    var toolbar = el("div", { class: "board-toolbar no-print" });
    var roster = b.rosterIds.map(resourceById).filter(Boolean);
    var filters = el("div", { class: "filters" });
    var assigneeSel = el("select", { class: "select select-sm" },
      "<option value=''>All assignees</option>" + roster.map(function (r) {
        return "<option value='" + r.id + "'" + (ui.filterAssignee === r.id ? " selected" : "") + ">" + esc(r.name) + "</option>";
      }).join(""));
    assigneeSel.addEventListener("change", function () { ui.filterAssignee = this.value; render(); });
    var prioSel = el("select", { class: "select select-sm" },
      "<option value=''>All priorities</option>" + PRIORITIES.map(function (p) {
        return "<option value='" + p + "'" + (ui.filterPriority === p ? " selected" : "") + ">" + cap(p) + "</option>";
      }).join(""));
    prioSel.addEventListener("change", function () { ui.filterPriority = this.value; render(); });
    var textInput = el("input", { class: "input", type: "search", placeholder: "Filter cards on this board…", style: "max-width:220px" });
    textInput.value = ui.filterText || "";
    var textTimer = null;
    textInput.addEventListener("input", function () {
      clearTimeout(textTimer);
      var val = this.value;
      textTimer = setTimeout(function () { ui.filterText = val; render(); var i = $(".board-toolbar input[type=search]"); if (i) { i.focus(); try { i.setSelectionRange(val.length, val.length); } catch (x) {} } }, 180);
    });
    var projectSel = el("select", { class: "select select-sm" },
      "<option value=''>All projects</option>" + state.projects.filter(function (p) { return p.boardId === b.id; }).map(function (p) {
        return "<option value='" + p.id + "'" + (ui.filterProject === p.id ? " selected" : "") + ">" + esc(p.name) + "</option>";
      }).join(""));
    projectSel.addEventListener("change", function () { ui.filterProject = this.value; render(); });
    filters.appendChild(textInput);
    filters.appendChild(projectSel);
    var groupSel = el("select", { class: "select select-sm" }, "<option value=''>All WBS groups</option>" + ["ADMINISTRATION-CB", "TASK-1", "TASK-2", "TASK-3", "TASK-4", "TASK-5"].map(function (g) { return "<option value='" + g + "'" + (ui.filterWbsGroup === g ? " selected" : "") + ">" + esc(g) + "</option>"; }).join(""));
    groupSel.addEventListener("change", function () { ui.filterWbsGroup = this.value; render(); });
    filters.appendChild(groupSel);
    filters.appendChild(assigneeSel);
    filters.appendChild(prioSel);
    if (ui.filterProject || ui.filterAssignee || ui.filterPriority || ui.filterText || ui.filterWbsGroup) {
      var clr = el("button", { class: "btn sm ghost" }, "Clear");
      clr.addEventListener("click", function () { ui.filterProject = ""; ui.filterAssignee = ""; ui.filterPriority = ""; ui.filterText = ""; ui.filterWbsGroup = ""; render(); });
      filters.appendChild(clr);
    }
    toolbar.appendChild(filters);
    var spacer = el("div"); spacer.style.flex = "1"; toolbar.appendChild(spacer);

    // Scale controls (matter at 200+ cards): total count, density, collapse all.
    var totalOnBoard = boardCards(b.id).length;
    var shown = boardCards(b.id).filter(cardMatchesFilter).length;
    var wip = boardWipSummary(b.id);
    toolbar.appendChild(el("span", { class: "faint", style: "font-size:12px" },
      (shown === totalOnBoard ? totalOnBoard + " cards" : shown + " of " + totalOnBoard + " cards")));
    toolbar.appendChild(el("span", { class: "wip-status " + wip.status, title: wip.detail, "aria-label": wip.label + ". " + wip.detail }, wip.label));
    var densityBtn = el("button", { class: "btn sm ghost", title: "Toggle card density" }, state.settings.compact ? "▤ Comfortable" : "≡ Compact");
    densityBtn.addEventListener("click", function () { mutate(function () { state.settings.compact = !state.settings.compact; }); });
    toolbar.appendChild(densityBtn);
    var allCollapsed = b.columns.every(function (col) { return ui.collapsed[col.id]; });
    var collapseBtn = el("button", { class: "btn sm ghost", title: "Collapse or expand all columns" }, allCollapsed ? "⊞ Expand all" : "⊟ Collapse all");
    collapseBtn.addEventListener("click", function () {
      var target = !allCollapsed;
      b.columns.forEach(function (col) { ui.collapsed[col.id] = target; });
      render();
    });
    toolbar.appendChild(collapseBtn);
    if (canEdit()) {
      var addCardBtn = el("button", { class: "btn primary sm" }, "+ New card");
      addCardBtn.addEventListener("click", function () { openCardEditor(null); });
      toolbar.appendChild(addCardBtn);
    }
    root.appendChild(toolbar);

    var board = el("div", { class: "board" + (state.settings.compact ? " compact" : "") });
    b.columns.forEach(function (col) { board.appendChild(renderColumn(b, col)); });
    if (canEdit()) {
      var addCol = el("div", { class: "add-column" });
      var addColBtn = el("button", null, "+ Add column");
      addColBtn.addEventListener("click", addColumn);
      addCol.appendChild(addColBtn);
      board.appendChild(addCol);
    }
    root.appendChild(board);
  };

  function cardMatchesFilter(c) {
    if (ui.filterProject && c.projectId !== ui.filterProject) return false;
    if (ui.filterAssignee && cardResourceShare(c, ui.filterAssignee) <= 0) return false;
    if (ui.filterPriority && c.priority !== ui.filterPriority) return false;
    if (ui.filterWbsGroup && wbsGroupForCode(cardWbsCode(c)) !== ui.filterWbsGroup) return false;
    if (ui.filterText) {
      var q = ui.filterText.toLowerCase();
      var hay = (c.title + " " + (c.desc || "") + " " + cardWbsCode(c) + " " + (c.scheduleTitle || "") + " " + (c.labels || []).join(" ") + " " + (c.type || "")).toLowerCase();
      if (hay.indexOf(q) === -1) return false;
    }
    return true;
  }

  function renderColumn(b, col) {
    var allCardsInCol = boardCards(b.id).filter(function (c) { return c.columnId === col.id; });
    var cards = allCardsInCol
      .filter(cardMatchesFilter)
      .sort(function (a, c) { return a.order - c.order; });
    var totalInCol = cards.length;
    // Per-stage (in-column) filter — appears when a stage overflows its window
    // so cards beyond the visible length can still be found within the stage.
    var cf = (ui.colFilter[col.id] || "").trim().toLowerCase();
    if (cf) cards = cards.filter(function (c) {
      var hay = (c.title + " " + (c.desc || "") + " " + (c.labels || []).join(" ") + " " + (c.type || "") + " " + assignmentSummary(c)).toLowerCase();
      return hay.indexOf(cf) !== -1;
    });
    // A filter sits at the top of every non-empty stage so cards can be viewed by
    // filter; it's essential once a stage overflows its render window.
    var showColFilter = totalInCol > 0 || !!cf;
    var collapsed = !!ui.collapsed[col.id];
    var node = el("div", { class: "column" + (collapsed ? " collapsed" : ""), dataset: { col: col.id } });

    var head = el("div", { class: "column-head" });
    var caret = el("button", { class: "column-collapse", title: collapsed ? "Expand" : "Collapse" }, collapsed ? "▸" : "▾");
    caret.addEventListener("click", function (e) { e.stopPropagation(); ui.collapsed[col.id] = !collapsed; render(); });
    head.appendChild(caret);
    var title = el("input", { class: "column-title", value: col.name, "aria-label": "Column name" });
    title.value = col.name;
    title.disabled = !canEdit();
    title.addEventListener("change", function () {
      mutate(function () { col.name = title.value.trim() || "Untitled"; });
    });
    var wipCount = allCardsInCol.length;
    var overWip = col.wip && wipCount > col.wip;
    var countLabel = (cards.length === wipCount ? String(cards.length) : cards.length + " of " + wipCount) + (col.wip ? " / " + col.wip : "");
    var countTitle = col.wip ? (overWip ? "WIP over by " + (wipCount - col.wip) + " in " + col.name : "WIP limit " + col.wip + " in " + col.name) : "No WIP limit set";
    var count = el("span", { class: "column-count" + (overWip ? " over" : ""), title: countTitle, "aria-label": countTitle },
      countLabel);
    head.appendChild(title);
    head.appendChild(count);
    if (canEdit()) {
      var menu = el("button", { class: "column-menu", title: "Column options" }, "⋯");
      menu.addEventListener("click", function (e) { e.stopPropagation(); columnMenu(b, col); });
      head.appendChild(menu);
    }
    node.appendChild(head);

    if (collapsed) {
      // Collapsed columns render as a slim strip — keeps a 12-column board navigable.
      head.style.cursor = "pointer";
      head.addEventListener("click", function () { ui.collapsed[col.id] = false; render(); });
      return node;
    }

    if (showColFilter) {
      var cfWrap = el("div", { class: "col-filter" });
      var cfInput = el("input", { class: "input", type: "search", placeholder: "Filter " + (totalInCol) + " in this stage…", dataset: { colfilter: col.id } });
      cfInput.value = ui.colFilter[col.id] || "";
      var cfTimer = null;
      cfInput.addEventListener("input", function () {
        clearTimeout(cfTimer);
        var v = this.value;
        cfTimer = setTimeout(function () {
          ui.colFilter[col.id] = v; ui.reveal[col.id] = 0; render();
          var again = document.querySelector("[data-colfilter='" + col.id + "']");
          if (again) { again.focus(); try { again.setSelectionRange(v.length, v.length); } catch (x) {} }
        }, 160);
      });
      cfInput.addEventListener("click", function (e) { e.stopPropagation(); });
      cfWrap.appendChild(cfInput);
      if (cf) cfWrap.appendChild(el("span", { class: "faint", style: "font-size:11px;padding:0 4px" }, cards.length + " of " + totalInCol));
      node.appendChild(cfWrap);
    }

    var body = el("div", { class: "column-body", dataset: { col: col.id } });
    if (!cards.length) body.appendChild(el("div", { class: "faint", style: "padding:8px;font-size:12px;" }, cf ? "No matches in this stage" : "No cards"));

    // Windowed rendering: only build DOM for the first N cards; reveal more on demand.
    // This keeps a 200+ card column responsive instead of rendering every node.
    var limit = ui.reveal[col.id] || COLUMN_RENDER_CAP;
    var visible = cards.slice(0, limit);
    visible.forEach(function (c) { body.appendChild(renderCard(c)); });
    if (cards.length > limit) {
      var remaining = cards.length - limit;
      var more = el("div", { class: "show-more" });
      var moreBtn = el("button", { class: "btn sm" }, "Show " + Math.min(COLUMN_RENDER_CAP, remaining) + " more (" + remaining + " hidden)");
      moreBtn.addEventListener("click", function (e) { e.stopPropagation(); ui.reveal[col.id] = limit + COLUMN_RENDER_CAP; render(); });
      var allBtn = el("button", { class: "btn sm ghost" }, "Show all");
      allBtn.addEventListener("click", function (e) { e.stopPropagation(); ui.reveal[col.id] = cards.length; render(); });
      more.appendChild(moreBtn); more.appendChild(allBtn);
      body.appendChild(more);
    }
    node.appendChild(body);

    if (canEdit()) {
      var add = el("div", { class: "column-add" });
      var addBtn = el("button", null, "+ Add card");
      addBtn.addEventListener("click", function () { quickAddCard(col.id); });
      add.appendChild(addBtn);
      node.appendChild(add);
    }

    setupColumnDnD(body, col.id);
    return node;
  }

  function renderCard(c) {
    var r = resourceById(c.assigneeId);
    var node = el("div", { class: "card prio-" + c.priority, draggable: canEdit() ? "true" : "false", dataset: { card: c.id } });
    var labels = (c.labels || []).map(function (l) {
      var color = LABEL_COLORS[l] || "#64748b";
      return "<span class='chip label'><span class='tag-dot' style='background:" + color + "'></span> " + esc(l) + "</span>";
    }).join("");
    var du = daysUntil(c.due);
    var dueCls = du == null ? "" : du < 0 && !isDone(c) ? "overdue" : du <= 3 ? "soon" : "";
    var dueTxt = c.due ? "📅 " + fmtDate(c.due) : "";
    var checklist = (c.checklist || []);
    var doneCk = checklist.filter(function (x) { return x.done; }).length;
    var html = "";
    if (labels) html += "<div class='card-labels'>" + labels + "</div>";
    html += "<div class='card-title'>" + (c.milestone ? "◆ " : "") + esc(c.title) + "</div>";
    if (cardWbsCode(c)) html += "<div class='wbs-path'><span class='badge neutral'>WBS / Schedule ID " + esc(cardWbsCode(c)) + "</span>" + (c.billingMilestone ? " <span class='badge warn'>Billing</span>" : "") + (isTask3Blocked(c) ? " <span class='badge danger'>Blocked" + (dependencyBlockLabel(c) ? " by " + esc(dependencyBlockLabel(c)) : " by E1010") + "</span>" : "") + "</div>";
    html += "<div class='mini-progress' title='Progress " + (c.progress || 0) + "%'><span style='width:" + clamp(c.progress || 0, 0, 100) + "%'></span></div>";
    html += "<div class='card-meta'>";
    html += "<span class='chip label'>" + esc(c.type) + "</span>";
    if (dueTxt) html += "<span class='due " + dueCls + "'>" + dueTxt + "</span>";
    if (checklist.length) html += "<span title='Checklist'>☑ " + doneCk + "/" + checklist.length + "</span>";
    var depCount = dependencyCards(c).length;
    if (depCount) html += "<span title='Dependencies'>Links " + depCount + "</span>";
    html += "</div>";
    html += cardTeamHTML(c);
    node.innerHTML = html;
    node.addEventListener("click", function () { openCardEditor(c.id); });
    if (canEdit()) setupCardDnD(node, c.id);
    return node;
  }

  /* ---------- WBS List ---------- */
  VIEWS.wbslist = function (root) {
    var p = projectById(ui.wbsProjectId) || state.projects[0];
    ui.wbsProjectId = p && p.id;
    var head = pageHead("WBS List", "Hierarchical work breakdown list separated from the Kanban flow board.");
    var sel = el("select", { class: "select select-sm" }, state.projects.map(function (x) { return "<option value='" + x.id + "'" + (p && x.id === p.id ? " selected" : "") + ">" + esc(x.name) + "</option>"; }).join(""));
    sel.addEventListener("change", function () { ui.wbsProjectId = sel.value; render(); });
    head.querySelector(".head-actions").appendChild(sel);
    root.appendChild(head);
    if (p) renderWorkspaceWbs(root, p);
  };

  /* ---------- Action Items ---------- */
  VIEWS.actionitems = function (root) {
    var head = pageHead("Action Items", "Project-specific action, issue, decision, and evidence closeout list.");
    if (canEdit()) head.querySelector(".head-actions").appendChild(mkBtn("+ Action item", "btn primary sm", function () { openActionItemEditor(null); }));
    root.appendChild(head);
    var p = projectById(ui.actionProjectId) || null;
    var filters = el("div", { class: "filters mb" });
    var sel = el("select", { class: "select select-sm" }, "<option value=''>All projects</option>" + state.projects.map(function (x) { return "<option value='" + x.id + "'" + (p && x.id === p.id ? " selected" : "") + ">" + esc(x.name) + "</option>"; }).join(""));
    sel.addEventListener("change", function () { ui.actionProjectId = sel.value; render(); });
    filters.appendChild(sel);
    root.appendChild(filters);
    renderActionItemsTable(root, (state.actionItems || []).filter(function (a) { return !ui.actionProjectId || a.projectId === ui.actionProjectId; }));
  };
  function renderActionItemsTable(root, rows) {
    rows = rows.map(normalizeActionItem).slice().sort(function (a, b) {
      var ac = a.status === "Closed" ? 1 : 0, bc = b.status === "Closed" ? 1 : 0;
      return ac - bc || (a.dueDate || "9999").localeCompare(b.dueDate || "9999");
    });
    var tbl = el("table", { class: "table table-dense" });
    tbl.innerHTML = "<thead><tr><th>Item</th><th>Project</th><th>Type</th><th>Priority</th><th>Status</th><th>Assignee</th><th>Due</th><th>Objective evidence</th><th></th></tr></thead>";
    var tb = el("tbody");
    rows.forEach(function (a) {
      var p = projectById(a.projectId), r = resourceById(a.assigneeId);
      var statusClass = a.status === "Closed" ? "ok" : a.status === "Blocked" ? "danger" : a.status === "Pending Evidence" ? "warn" : "neutral";
      var tr = el("tr", { style: canEdit() ? "cursor:pointer" : "" }, "<td><strong>" + esc(a.title) + "</strong><div class='muted'>" + esc(a.description || "") + "</div></td><td>" + esc(p ? p.name : "-") + "</td><td>" + esc(a.type) + "</td><td><span class='badge " + (a.priority === "Critical" ? "danger" : a.priority === "High" ? "warn" : "neutral") + "'>" + esc(a.priority) + "</span></td><td><span class='badge " + statusClass + "'>" + esc(a.status) + "</span></td><td class='muted'>" + esc(r ? r.name : "-") + "</td><td>" + fmtDate(a.dueDate) + "</td><td class='muted'>" + esc(a.objectiveEvidence || a.evidenceRequired || "-") + "</td><td class='right'></td>");
      if (canEdit()) {
        tr.addEventListener("click", function () { openActionItemEditor(a.id); });
        var del = el("button", { class: "btn sm danger", title: "Delete action item" }, "Delete");
        del.addEventListener("click", function (e) { e.stopPropagation(); deleteActionItemPrompt(a.id); });
        tr.querySelector("td.right").appendChild(del);
      }
      tb.appendChild(tr);
    });
    if (!rows.length) tb.appendChild(el("tr", null, "<td colspan='9' class='empty'>No action items for this scope.</td>"));
    tbl.appendChild(tb); root.appendChild(el("div", { class: "panel table-wrap" })).appendChild(tbl);
  }
  function deleteActionItemPrompt(id) {
    var a = (state.actionItems || []).filter(function (x) { return x.id === id; })[0];
    if (!a) return;
    confirmModal("Delete action item?", "'" + a.title + "' will be removed from the project action list.", function () {
      mutate(function () {
        state.actionItems = (state.actionItems || []).filter(function (x) { return x.id !== id; });
        recordAudit("Action Item", id, "Action item deleted", a.title);
      });
      toast("Action item deleted", "ok");
    });
  }
  function openActionItemEditor(id) {
    var isNew = !id, a = id ? (state.actionItems || []).filter(function (x) { return x.id === id; })[0] : { id: uid("ai"), projectId: ui.workspaceProjectId || (state.projects[0] || {}).id, type: "Action", title: "", priority: "Moderate", status: "Open", assigneeId: "", dueDate: todayISO(), description: "", objectiveEvidence: "", evidenceRequired: "", closeoutDate: "", source: "Local" };
    normalizeActionItem(a);
    // Decision records require governance authority (V15 team-member boundary);
    // team members may still raise and edit Issues, Actions, Evidence, and RFIs.
    if (a.type === "Decision" && !canGovernRegisters()) { toast("Decision records are read-only for your role", "err"); return; }
    var typeChoices = canGovernRegisters() ? ACTION_ITEM_TYPES : ACTION_ITEM_TYPES.filter(function (x) { return x !== "Decision"; });
    var body = el("div");
    body.innerHTML = "<div class='form-grid'><div class='form-row full'><label class='field-label inline'>Title</label><input class='input' id='aiTitle' value='" + esc(a.title) + "'></div><div class='form-row'><label class='field-label inline'>Project</label><select class='select' id='aiProject'>" + state.projects.map(function (p) { return "<option value='" + p.id + "'" + (p.id === a.projectId ? " selected" : "") + ">" + esc(p.name) + "</option>"; }).join("") + "</select></div><div class='form-row'><label class='field-label inline'>Assignee</label><select class='select' id='aiOwner'><option value=''>Unassigned</option>" + state.resources.map(function (r) { return "<option value='" + r.id + "'" + (r.id === a.assigneeId ? " selected" : "") + ">" + esc(r.name) + "</option>"; }).join("") + "</select></div><div class='form-row'><label class='field-label inline'>Type</label><select class='select' id='aiType'>" + typeChoices.map(function (x) { return "<option" + (x === a.type ? " selected" : "") + ">" + x + "</option>"; }).join("") + "</select></div><div class='form-row'><label class='field-label inline'>Priority</label><select class='select' id='aiPrio'>" + ISSUE_PRIORITIES.map(function (x) { return "<option" + (x === a.priority ? " selected" : "") + ">" + x + "</option>"; }).join("") + "</select></div><div class='form-row'><label class='field-label inline'>Status</label><select class='select' id='aiStatus'>" + ACTION_ITEM_STATUS.map(function (x) { return "<option" + (x === a.status ? " selected" : "") + ">" + x + "</option>"; }).join("") + "</select></div><div class='form-row'><label class='field-label inline'>Due</label><input class='input' type='date' id='aiDue' value='" + (a.dueDate || "") + "'></div><div class='form-row'><label class='field-label inline'>Closeout date</label><input class='input' type='date' id='aiClose' value='" + (a.closeoutDate || "") + "'></div><div class='form-row full'><label class='field-label inline'>Description</label><textarea class='textarea' id='aiDesc'>" + esc(a.description || "") + "</textarea></div><div class='form-row full'><label class='field-label inline'>Evidence required</label><textarea class='textarea' id='aiReq'>" + esc(a.evidenceRequired || "") + "</textarea></div><div class='form-row full'><label class='field-label inline'>Objective evidence / closeout record</label><textarea class='textarea' id='aiEv'>" + esc(a.objectiveEvidence || "") + "</textarea></div></div>";
    var foot = [];
    if (!isNew) foot.push({ label: "Delete", cls: "btn danger", side: "left", fn: function () { closeModal(); deleteActionItemPrompt(a.id); } });
    foot.push({ label: "Cancel", cls: "btn", fn: closeModal });
    foot.push({ label: "Save", cls: "btn primary", fn: function () { var title = $("#aiTitle").value.trim(); if (!title) return toast("Action item title is required", "err"); mutate(function () { a.title = title; a.projectId = $("#aiProject").value; a.assigneeId = $("#aiOwner").value; a.type = $("#aiType").value; a.priority = $("#aiPrio").value; a.status = $("#aiStatus").value; a.dueDate = $("#aiDue").value; a.closeoutDate = $("#aiClose").value; a.description = $("#aiDesc").value; a.evidenceRequired = $("#aiReq").value; a.objectiveEvidence = $("#aiEv").value; normalizeActionItem(a); if (isNew) state.actionItems.push(a); recordAudit("Action Item", a.id, isNew ? "Action item created" : "Action item saved", a.title); }); closeModal(); toast("Action item saved", "ok"); } });
    modal(isNew ? "New action item" : "Action item", body, foot);
  }

  /* ---------- Resources ---------- */
  VIEWS.resources = function (root) {
    var head = pageHead("Resource Utilization", "Spreadsheet-style resource register, capacity pressure, and a 4-week forecast.");
    var canManage = canManageResources();
    if (canManage) {
      var expBtn = el("button", { class: "btn sm" }, "⬇ Export resources");
      expBtn.addEventListener("click", exportResourcesCSV);
      var impBtn = el("button", { class: "btn sm" }, "⬆ Import resources");
      impBtn.addEventListener("click", importResourcesPrompt);
      var addBtn = el("button", { class: "btn primary sm" }, "+ Resource");
      addBtn.addEventListener("click", function () { addResourceInline(); });
      var cleanBtn = el("button", { class: "btn sm ghost" }, "Clean placeholders");
      cleanBtn.addEventListener("click", function () { var n = cleanGeneratedResourcePlaceholders(state); if (n) { save(); render(); toast("Removed " + n + " generated placeholder resource(s)", "ok"); } else toast("No generated placeholders found", "ok"); });
      head.querySelector(".head-actions").appendChild(expBtn);
      head.querySelector(".head-actions").appendChild(impBtn);
      head.querySelector(".head-actions").appendChild(cleanBtn);
      head.querySelector(".head-actions").appendChild(addBtn);
    }
    root.appendChild(head);
    var fin = canFinance();

    var filterBar = el("div", { class: "filters mb" });
    var search = el("input", { class: "input", type: "search", placeholder: "Search name, role, company...", style: "max-width:260px" });
    search.value = ui.resourceSearch || "";
    search.addEventListener("input", function () { ui.resourceSearch = search.value; render(); });
    var typeFilter = el("select", { class: "select select-sm" }, "<option value=''>All types</option>" + RESOURCE_TYPES.map(function (t) { return "<option" + (ui.resourceType === t ? " selected" : "") + ">" + esc(t) + "</option>"; }).join(""));
    typeFilter.addEventListener("change", function () { ui.resourceType = typeFilter.value; render(); });
    var utilFilter = el("select", { class: "select select-sm" }, "<option value=''>All utilization</option><option value='over'" + (ui.resourceUtilFilter === "over" ? " selected" : "") + ">Over 100%</option><option value='watch'" + (ui.resourceUtilFilter === "watch" ? " selected" : "") + ">90%-100%</option><option value='open'" + (ui.resourceUtilFilter === "open" ? " selected" : "") + ">Under 90%</option>");
    utilFilter.addEventListener("change", function () { ui.resourceUtilFilter = utilFilter.value; render(); });
    filterBar.appendChild(search); filterBar.appendChild(typeFilter); filterBar.appendChild(utilFilter);
    root.appendChild(filterBar);

    var panel = el("div", { class: "panel table-wrap" });
    var tbl = el("table", { class: "table table-dense" });
    tbl.innerHTML = "<thead><tr><th>Rank</th><th>Resource</th><th>Type</th><th>Role / Use</th><th>Company</th><th class='num'>Active</th><th class='num'>Allocated</th><th>Utilization</th><th>Wk1</th><th>Wk2</th><th>Wk3</th><th>Wk4</th>" + (fin ? "<th class='num'>Capacity</th><th class='num'>Cost</th><th class='num'>Bill</th>" : "") + (canManage ? "<th>Status</th><th></th>" : "") + "</tr></thead>";
    var tb = el("tbody");
    var resources = state.resources.filter(function (r) {
      var u = resourceUtil(r);
      var q = String(ui.resourceSearch || "").toLowerCase();
      if (q && String(r.name + " " + r.role + " " + r.company).toLowerCase().indexOf(q) === -1) return false;
      if (ui.resourceType && r.type !== ui.resourceType) return false;
      if (ui.resourceUtilFilter === "over" && u.util <= 100) return false;
      if (ui.resourceUtilFilter === "watch" && (u.util < 90 || u.util > 100)) return false;
      if (ui.resourceUtilFilter === "open" && u.util >= 90) return false;
      return true;
    }).sort(function (a, b) { return resourceUtil(b).util - resourceUtil(a).util || a.name.localeCompare(b.name); });
    resources.forEach(function (r, rank) {
      normalizeResource(r);
      var u = resourceUtil(r);
      var cls = u.util > 110 ? "danger" : u.util > 90 ? "warn" : "ok";
      var tr = el("tr");
      tr.dataset.resourceId = r.id;
      var viewBtn = "<button class='btn sm ghost' data-view-resource='" + r.id + "' title='View assignments & utilization' style='padding:2px 7px'>&#128269;</button>";
      var nameCell = canManage
        ? "<div class='flex' style='gap:6px;align-items:center'>" + viewBtn + "<input class='input sm' data-rfield='name' value='" + esc(r.name) + "'></div>"
        : "<div class='flex' style='gap:6px;align-items:center'>" + viewBtn + "<span class='avatar' style='background:" + avatarColor(r.name) + "'>" + esc(initials(r.name)) + "</span> <button class='linklike' data-view-resource='" + r.id + "'><strong>" + esc(r.name) + "</strong></button></div>";
      var typeCell = canManage
        ? "<select class='select select-sm' data-rfield='type'>" + RESOURCE_TYPES.map(function (t) { return "<option" + (t === r.type ? " selected" : "") + ">" + esc(t) + "</option>"; }).join("") + "</select>"
        : "<span class='badge neutral'>" + esc(r.type) + "</span>";
      var roleCell = canManage ? "<input class='input sm' data-rfield='role' value='" + esc(r.role) + "'>" : "<span class='muted'>" + esc(r.role) + "</span>";
      var companyCell = canManage ? "<input class='input sm' data-rfield='company' value='" + esc(r.company) + "'>" : "<span class='muted'>" + esc(r.company || "—") + "</span>";
      tr.innerHTML =
        "<td class='num'>" + (rank + 1) + "</td>" +
        "<td>" + nameCell + "</td>" +
        "<td>" + typeCell + "</td>" +
        "<td>" + roleCell + "</td>" +
        "<td>" + companyCell + "</td>" +
        "<td class='num'>" + u.active + "</td>" +
        "<td class='num'>" + hours(u.allocated) + " / " + hours(u.capacity) + "</td>" +
        "<td><div class='flex'><div class='bar'><span class='" + cls + "' style='width:" + clamp(u.util, 0, 100) + "%'></span></div> <span class='muted'>" + pct(u.util) + "</span></div></td>" +
        u.weeks.map(function (w) { return "<td class='muted'>" + (w ? hours(w) : "—") + "</td>"; }).join("") +
        (fin ? "<td class='num'>" + (canManage ? "<input class='input sm num' type='number' min='0' step='0.25' data-rfield='capacityHrs' value='" + r.capacityHrs + "'>" : hours(r.capacityHrs)) + "</td><td class='num'>" + (canManage ? "<input class='input sm num' type='number' min='0' step='0.01' data-rfield='costRate' value='" + r.costRate + "'>" : money(r.costRate) + "/" + esc(r.unit)) + "</td><td class='num'>" + (canManage ? "<input class='input sm num' type='number' min='0' step='0.01' data-rfield='billRate' value='" + r.billRate + "'>" : (r.billRate ? money(r.billRate) + "/" + esc(r.unit) : "—")) + "</td>" : "") +
        (canManage ? "<td><select class='select select-sm' data-rfield='status'><option" + (r.status === "Active" ? " selected" : "") + ">Active</option><option" + (r.status === "Inactive" ? " selected" : "") + ">Inactive</option><option" + (r.status === "Preferred" ? " selected" : "") + ">Preferred</option><option" + (r.status === "Hold" ? " selected" : "") + ">Hold</option></select></td><td><button class='btn sm ghost' data-delete-resource='" + r.id + "'>Delete</button></td>" : "");
      tb.appendChild(tr);
    });
    if (canManage) {
      tb.addEventListener("change", function (e) {
        var field = e.target && e.target.dataset ? e.target.dataset.rfield : "";
        if (!field) return;
        var tr = e.target.closest("tr");
        var r = tr ? resourceById(tr.dataset.resourceId) : null;
        if (!r) return;
        mutate(function () {
          if (field === "capacityHrs" || field === "costRate" || field === "billRate") r[field] = normHours(e.target.value);
          else r[field] = e.target.value;
          normalizeResource(r);
        });
      });
      tb.addEventListener("click", function (e) {
        var id = e.target && e.target.dataset ? e.target.dataset.deleteResource : "";
        if (!id) return;
        deleteResourcePrompt(id);
      });
    }
    tb.addEventListener("click", function (e) {
      var vid = e.target && e.target.closest ? (e.target.closest("[data-view-resource]") || {}).getAttribute && e.target.closest("[data-view-resource]").getAttribute("data-view-resource") : "";
      if (vid) { e.preventDefault(); openResourceDetail(vid); }
    });
    if (!resources.length) tb.appendChild(el("tr", null, "<td colspan='16' class='empty'>No resources match the current filters.</td>"));
    tbl.appendChild(tb);
    panel.appendChild(tbl);
    panel.appendChild(el("div", { class: "hint panel-pad" }, "PMO resource types include employees, subcontracted firms, tools/software, equipment, facilities, materials, and other costed constraints. Import merges by resource name or ID and preserves existing card assignments."));
    root.appendChild(panel);

    if (!fin) root.appendChild(el("div", { class: "warn-banner mt" }, "Cost rates are hidden for your role. Financial visibility is limited to manager roles."));
    if (!canManage) root.appendChild(el("div", { class: "hint mt" }, "Resource import, export, and inline editing are limited to Admin, Department Manager, and Project Manager roles."));
  };

  /* ---------- Resource drill-down (assignments across cards & projects) ---------- */
  function remainingShareHours(c, rid) {
    var a = cardAssignments(c).filter(function (x) { return x.resourceId === rid; })[0];
    var share = a ? (a.allocationPct || 0) / 100 : 0;
    return Math.max(0, (c.estimateHours || 0) - (c.loggedHours || 0)) * share;
  }
  function setResourceAllocationOnCard(cardId, resourceId, pctVal) {
    mutate(function () {
      var c = cardById(cardId); if (!c) return;
      normalizeResourceAssignmentsForCard(c);
      var row = (c.resourceAssignments || []).filter(function (a) { return a.resourceId === resourceId; })[0];
      if (row) row.allocationPct = clamp(pctVal, 0, 100);
      normalizeResourceAssignmentsForCard(c);
      c.assigneeId = c.resourceAssignments.length ? c.resourceAssignments[0].resourceId : c.assigneeId;
      recordAudit("Card", c.id, "Resource allocation adjusted", (resourceById(resourceId) || {}).name + " → " + Math.round(pctVal) + "%");
    });
  }
  function removeResourceFromCard(cardId, resourceId, reopenResourceId) {
    var c = cardById(cardId); if (!c) return;
    mutate(function () {
      normalizeResourceAssignmentsForCard(c);
      c.resourceAssignments = (c.resourceAssignments || []).filter(function (a) { return a.resourceId !== resourceId; });
      if (c.assigneeId === resourceId) c.assigneeId = c.resourceAssignments.length ? c.resourceAssignments[0].resourceId : null;
      recordAudit("Card", c.id, "Resource unassigned", (resourceById(resourceId) || {}).name + " removed from " + c.title);
    });
    toast("Removed from card", "ok");
    openResourceDetail(reopenResourceId);
  }
  function openResourceDetail(resourceId) {
    var r = resourceById(resourceId);
    if (!r) return;
    var u = resourceUtil(r);
    var canManage = canManageResources();
    var assigned = state.cards.filter(function (c) { return c.assigneeId === r.id || (c.resourceAssignments || []).some(function (a) { return a.resourceId === r.id; }); });
    assigned.sort(function (a, b) {
      var da = isDone(a) ? 1 : 0, db = isDone(b) ? 1 : 0;
      if (da !== db) return da - db;
      return remainingShareHours(b, r.id) - remainingShareHours(a, r.id);
    });
    var byProject = {};
    assigned.forEach(function (c) { if (!isDone(c)) byProject[c.projectId || "none"] = (byProject[c.projectId || "none"] || 0) + 1; });
    var projectCount = Object.keys(byProject).length;

    var body = el("div", { class: "resource-detail" });
    var utilCls = u.util > 110 ? "danger" : u.util > 90 ? "warn" : "ok";
    var stats = el("div", { class: "grid cols-4 mb" });
    stats.innerHTML =
      statCardHTML("Utilization", pct(u.util), "weekly demand " + hours(u.weeklyDemand) + " / " + hours(u.capacity) + " cap") +
      statCardHTML("Active cards", u.active, "across " + projectCount + " project" + (projectCount === 1 ? "" : "s")) +
      statCardHTML("Remaining share", hours(u.allocated), "your open work") +
      statCardHTML("4-week forecast", u.weeks.map(function (w) { return w ? hours(w) : "—"; }).join(" · "), "remaining hrs / week");
    var utilVal = stats.querySelector(".stat-value");
    if (utilVal) utilVal.className = "stat-value " + utilCls;
    body.appendChild(stats);
    if (u.util > 100) body.appendChild(el("div", { class: "warn-banner mb" }, "Over-allocated at " + pct(u.util) + ". Lower an allocation %, reassign a card, or extend a schedule to bring weekly demand under capacity."));

    var panel = el("div", { class: "panel table-wrap" });
    var tbl = el("table", { class: "table table-dense" });
    tbl.innerHTML = "<thead><tr><th>Project</th><th>Card</th><th>Stage</th><th>Role</th><th class='num'>Alloc %</th><th class='num'>Rem hrs</th><th></th></tr></thead>";
    var tbb = el("tbody");
    assigned.forEach(function (c) {
      var a = cardAssignments(c).filter(function (x) { return x.resourceId === r.id; })[0] || { allocationPct: 0, role: "" };
      var lead = ((cardAssignments(c)[0] || {}).resourceId === r.id);
      var p = projectById(c.projectId);
      var overdue = daysUntil(c.due) != null && daysUntil(c.due) < 0 && !isDone(c);
      var tr = el("tr", isDone(c) ? { class: "muted" } : null);
      tr.innerHTML =
        "<td>" + esc(p ? p.name : "—") + "</td>" +
        "<td><strong>" + esc(c.title) + "</strong>" + (c.milestone ? " <span class='badge neutral'>M</span>" : "") + (overdue ? " <span class='badge danger'>overdue</span>" : "") + "</td>" +
        "<td class='muted'>" + esc(columnName(c) || "—") + "</td>" +
        "<td>" + (lead ? "<span class='badge ok'>Lead</span>" : "<span class='muted'>" + esc(a.role || "Contributor") + "</span>") + "</td>" +
        "<td class='num'>" + (canManage && !isDone(c) ? "<input class='input sm num' type='number' min='0' max='100' step='5' data-alloc-card='" + c.id + "' value='" + Math.round(a.allocationPct || 0) + "' style='width:66px'>" : Math.round(a.allocationPct || 0) + "%") + "</td>" +
        "<td class='num'>" + (isDone(c) ? "<span class='muted'>done</span>" : hours(remainingShareHours(c, r.id))) + "</td>" +
        "<td class='right'></td>";
      var actions = tr.querySelector("td.right");
      actions.appendChild(mkBtn("Open", "btn sm", function () { openCardEditor(c.id); }));
      if (canManage) actions.appendChild(mkBtn("Remove", "btn sm ghost", function () { removeResourceFromCard(c.id, r.id, resourceId); }));
      tbb.appendChild(tr);
    });
    if (!assigned.length) tbb.appendChild(el("tr", null, "<td colspan='7' class='empty'>Not assigned to any cards yet.</td>"));
    tbl.appendChild(tbb); panel.appendChild(tbl); body.appendChild(panel);
    if (canManage) {
      panel.addEventListener("change", function (e) {
        var cid = e.target && e.target.dataset ? e.target.dataset.allocCard : "";
        if (!cid) return;
        setResourceAllocationOnCard(cid, r.id, clamp(parseFloat(e.target.value) || 0, 0, 100));
        openResourceDetail(resourceId);
      });
    }
    body.appendChild(el("div", { class: "hint mt" }, canManage
      ? "Adjust an allocation % inline to re-level utilization instantly, or Open a card to change the full team, estimate, and schedule."
      : "Open a card to view its full team, estimate, and schedule."));
    modal("Resource · " + r.name + (r.role ? " — " + r.role : ""), body, [{ label: "Close", cls: "btn primary", fn: closeModal }]);
  }

  /* ---------- Project Workspace ---------- */
  VIEWS.workspace = function (root) {
    if (!state.projects.length) { root.appendChild(el("div", { class: "panel panel-pad empty" }, "No projects are available.")); return; }
    var selectedId = ui.workspaceProjectId || state.projects[0].id;
    var p = projectById(selectedId) || state.projects[0];
    ui.workspaceProjectId = p.id;
    var head = pageHead("Project Workspace", "Native Techniek execution workspace replacing native project execution control.");
    var sel = el("select", { class: "select select-sm" }, state.projects.map(function (x) { return "<option value='" + x.id + "'" + (x.id === p.id ? " selected" : "") + ">" + esc(x.name) + "</option>"; }).join(""));
    sel.addEventListener("change", function () { ui.workspaceProjectId = sel.value; render(); });
    head.querySelector(".head-actions").appendChild(sel);
    root.appendChild(head);
    var tabs = workspaceTabs();
    var active = ui.workspaceTab || "Summary";
    if (tabs.indexOf(active) === -1) active = "Summary";
    var tabbar = el("div", { class: "flex wrap mb" });
    tabs.forEach(function (t) { var b = el("button", { class: "btn sm" + (active === t ? " primary" : " ghost") }, t); b.addEventListener("click", function () { ui.workspaceTab = t; render(); }); tabbar.appendChild(b); });
    root.appendChild(tabbar);
    if (active === "Summary") renderWorkspaceSummary(root, p);
    else if (active === "WBS List") renderWorkspaceWbs(root, p);
    else if (active === "Kanban") { var prev = ui.filterProject; ui.filterProject = p.id; renderWorkspaceKanban(root, p, prev); }
    else if (active === "Gantt") renderWorkspaceGantt(root, p);
    else if (active === "Resources") renderWorkspaceResources(root, p);
    else if (active === "Financials") {
      if (!canFinance()) root.appendChild(el("div", { class: "warn-banner" }, "Financials are limited to manager roles (Admin, Department Manager, Project Manager, Resource Manager)."));
      else renderWorkspaceFinancials(root, p);
    }
    else if (active === "Risk Register") renderProjectRiskRegister(root, p);
    else if (active === "Action Items") renderActionItemsTable(root, (state.actionItems || []).filter(function (i) { return i.projectId === p.id; }));
    else if (active === "Changes") renderWorkspaceLinkedTable(root, "Changes", changeOrdersFor(p.id));
    else if (active === "FV/EAC") {
      if (!canFinance()) root.appendChild(el("div", { class: "warn-banner" }, "FV/EAC history is limited to manager roles (Admin, Department Manager, Project Manager, Resource Manager)."));
      else root.appendChild(renderProjectFinancialHistory(p));
    }
    else if (active === "Attachments") root.appendChild(el("div", { class: "panel panel-pad" }, "Attachment register is backend-ready. Store links to SharePoint project libraries when live integration is approved."));
    else renderWorkspaceReports(root, p);
  };

  function projectMetricRows(p) {
    var r = projectRollup(p), v = projectEVM(p), mult = projectMultiplier(r), fo = p.financialOverride || {};
    var hist = projectFinancialHistory(p), latest = hist[hist.length - 1] || {};
    function row(group, metric, value, basis) { return { group: group, metric: metric, value: value, basis: basis || "" }; }
    return [
      row("Executive", "Progress", pct(r.progress), "Project rollup physical progress"),
      row("Executive", "Contract / funded value", money(contractValue(p)), "Latest funding profile value"),
      row("Executive", "Contribution margin", pctRatio(r.contributionMargin), "CM = (earned revenue - billable direct labor) / earned revenue"),
      row("Executive", "Multiplier", fmtMultiplier(mult), "Multiplier = earned revenue / billable direct labor"),
      row("Financial", "Target cost budget", money(fo.targetCostBudget || r.committed), fo.sourceFile || "Project committed cost basis"),
      row("Financial", "Cost EAC", money(latest.costEAC || p.costEACOverride || v.eac), "Project FV/EAC history or EVM EAC"),
      row("Financial", "Bill EAC", latest.billEAC == null ? "-" : money(latest.billEAC), "Shown for T&M billing"),
      row("Financial", "VAC", money((contractValue(p) || 0) - (latest.costEAC || p.costEACOverride || v.eac || 0)), "Contract value - Cost EAC"),
      row("EVM", "BAC", money(v.bac), v.sourceFile || "Budget at completion"),
      row("EVM", "PV", money(v.pv), "Planned value"),
      row("EVM", "EV", money(v.ev), "Earned value"),
      row("EVM", "AC", money(v.ac), "Actual cost"),
      row("EVM", "CPI", num2(v.cpi), "CPI = EV / AC"),
      row("EVM", "SPI", num2(v.spi), "SPI = EV / PV"),
      row("EVM", "SV", money(v.sv), "SV = EV - PV"),
      row("EVM", "CV", money(v.cv), "CV = EV - AC"),
      row("EVM", "EAC", money(v.eac), "EAC = BAC / CPI"),
      row("P6 Source", "Source file", fo.sourceFile || v.sourceFile || "Local app data", "Current project controls basis"),
      row("P6 Source", "Data date", fo.dataDate || v.dataDate || "", "Schedule-cost file date"),
      row("P6 Source", "P6 funded value", fo.fundedValue ? moneyExact(fo.fundedValue) : "-", "ERMAS funded value from P6 workbook"),
      row("P6 Source", "P6 multiplier", fo.multiplier ? fmtMultiplier(fo.multiplier) : "-", "Configured project multiplier"),
      row("P6 Source", "P6 progress", fo.progressPct != null ? pct(fo.progressPct) : "-", "Workbook project % complete"),
      row("P6 Source", "P6 EAC", fo.p6EstimateAtCompletion ? moneyExact(fo.p6EstimateAtCompletion) : "-", "Estimate at completion from P6 workbook")
    ];
  }
  function selectedMetricRows(p) {
    var selected = ui.projectMetricSet || (p && hasSourceSystemControls(p) ? "Schedule Controls" : (canFinance() ? "Executive" : "EVM"));
    var rows = filterMetricsForRole(projectMetricRows(p));
    if (selected === "All") return rows;
    if (selected === "Schedule Controls") return rows.filter(function (r) { return ["Executive", "Financial", "EVM", "P6 Source"].indexOf(r.group) !== -1; });
    return rows.filter(function (r) { return r.group === selected; });
  }
  function renderProjectMetricsPanel(root, p) {
    var panel = el("div", { class: "panel panel-pad mt project-metrics-panel" });
    var top = el("div", { class: "flex wrap mb", style: "justify-content:space-between;gap:12px" });
    top.appendChild(el("div", null, "<h2 style='margin:0'>Project metrics</h2><div class='muted'>Selectable controls, EVM, margin, multiplier, and source-basis values for " + esc(p.unanetProjectCode || p.name) + ".</div>"));
    var sel = el("select", { class: "select select-sm", id: "projectMetricSet" }, metricGroupOptions(p).map(function (g) { return "<option value='" + esc(g) + "'" + ((ui.projectMetricSet || (hasSourceSystemControls(p) ? "Schedule Controls" : "Executive")) === g ? " selected" : "") + ">" + esc(g) + "</option>"; }).join(""));
    sel.addEventListener("change", function () { ui.projectMetricSet = sel.value; render(); });
    top.appendChild(sel);
    panel.appendChild(top);
    var rows = selectedMetricRows(p);
    var tbl = el("table", { class: "table table-dense" });
    tbl.innerHTML = "<thead><tr><th>Group</th><th>Metric</th><th class='num'>Value</th><th>Basis / calculation</th></tr></thead>";
    var tb = el("tbody");
    rows.forEach(function (r) { tb.appendChild(el("tr", null, "<td><span class='badge neutral'>" + esc(r.group) + "</span></td><td><strong>" + esc(r.metric) + "</strong></td><td class='num'>" + esc(r.value) + "</td><td class='muted'>" + esc(r.basis) + "</td>")); });
    tbl.appendChild(tb);
    panel.appendChild(tbl);
    if (hasSourceSystemControls(p)) {
      panel.appendChild(el("div", { class: "hint mt" }, "Controls for " + esc(p.unanetProjectCode || p.name) + " are synchronized from " + esc(p.sourceSystem || "an external schedule-cost system") + ". Source-system values take precedence over locally derived rollups."));
    }
    root.appendChild(panel);
  }
  function renderWorkspaceSummary(root, p) {
    var r = projectRollup(p), v = projectEVM(p);
    var pg = (state.programs || []).filter(function (x) { return x.id === p.programId; })[0];
    var pf = (state.portfolios || []).filter(function (x) { return x.id === p.portfolioId; })[0];
    var panel = el("div", { class: "panel panel-pad" });
    panel.innerHTML = "<div class='grid cols-4'>" +
      statCardHTML("Project state", p.status, p.unanetState || "local") + statCardHTML("Org unit", p.orgUnit || DEFAULT_ORG_UNIT, pg ? pg.name : (pf ? pf.name : "local")) +
      statCardHTML("Schedule", fmtDate(p.startDate) + " - " + fmtDate(p.endDate), p.unanetProjectCode || "local") + statCardHTML("Progress", r.progress + "%", r.done + "/" + r.cards + " work items") + "</div>";
    root.appendChild(panel);
    if (p.unanetUrl) root.appendChild(el("div", { class: "hint mt" }, "Open in Unanet: " + p.unanetUrl));
    var evm = el("div", { class: "grid cols-4 mt" });
    evm.appendChild(statCard("SPI", num2(v.spi), "schedule performance", v.spi < 0.9 ? "danger" : v.spi < 1 ? "warn" : "ok"));
    evm.appendChild(statCard("CPI", num2(v.cpi), "cost performance", v.cpi < 0.9 ? "danger" : v.cpi < 1 ? "warn" : "ok"));
    if (canFinance()) {
      evm.appendChild(statCard("SV ($)", money(v.sv), "EV - PV", v.sv < 0 ? "warn" : "ok"));
      evm.appendChild(statCard("EAC", money(v.eac), "BAC / CPI"));
    } else {
      evm.appendChild(statCard("Progress", r.progress + "%", r.done + "/" + r.cards + " work items"));
      evm.appendChild(statCard("On-time", (r.cards ? Math.round((r.cards - r.overdue) / r.cards * 100) : 100) + "%", r.overdue + " overdue"));
    }
    root.appendChild(evm);
    if (filterMetricsForRole(projectMetricRows(p)).length) renderProjectMetricsPanel(root, p);
  }

  function renderWorkspaceWbs(root, p) {
    var head = el("div", { class: "flex wrap mb" });
    if (canEdit()) {
      head.appendChild(mkBtn("+ WBS element", "btn primary sm", function () { openWbsElementEditor(p.id); }));
      head.appendChild(mkBtn("Upload WBS CSV", "btn sm", function () { uploadWbsElementsPrompt(p.id); }));
      head.appendChild(mkBtn("Import CES/P6 WBS", "btn sm", function () { importWbsPrompt(p.id); }));
    }
    head.appendChild(mkBtn("Export project package", "btn sm", function () { download("opsboard-project-" + p.unanetProjectCode + ".json", JSON.stringify(exportProjectPackage(p.id), null, 2), "application/json"); }));
    root.appendChild(head);
    var filters = el("div", { class: "filters mb" });
    var groupSel = el("select", { class: "select select-sm" }, "<option value=''>All WBS groups</option>" + ["ADMINISTRATION-CB", "TASK-1", "TASK-2", "TASK-3", "TASK-4", "TASK-5"].map(function (g) { return "<option value='" + g + "'" + (ui.wbsGroupFilter === g ? " selected" : "") + ">" + esc(g) + "</option>"; }).join(""));
    groupSel.addEventListener("change", function () { ui.wbsGroupFilter = groupSel.value; render(); });
    var search = el("input", { class: "input", type: "search", placeholder: "Search WBS / Schedule ID, title...", style: "max-width:280px" });
    search.value = ui.wbsSearch || "";
    search.addEventListener("input", function () { ui.wbsSearch = search.value; render(); });
    filters.appendChild(search); filters.appendChild(groupSel); root.appendChild(filters);
    var elements = projectWbsElements(p.id);
    if (ui.wbsGroupFilter) elements = elements.filter(function (w) { return w.wbsCode === ui.wbsGroupFilter || w.parentWbsCode === ui.wbsGroupFilter || wbsGroupForCode(w.wbsCode) === ui.wbsGroupFilter; });
    if (ui.wbsSearch) { var q = ui.wbsSearch.toLowerCase(); elements = elements.filter(function (w) { return String(w.wbsCode + " " + w.parentWbsCode + " " + w.title + " " + w.sourceBasis).toLowerCase().indexOf(q) !== -1; }); }
    var linked = {};
    state.cards.filter(function (c) { return c.projectId === p.id; }).forEach(function (c) { var code = cardWbsCode(c); linked[code] = (linked[code] || 0) + 1; });
    var tbl = el("table", { class: "table table-dense" });
    tbl.innerHTML = "<thead><tr><th>WBS / Schedule ID</th><th>Parent</th><th>Schedule title</th><th>Type</th><th>Planned</th><th class='num'>%</th><th class='num'>Cards</th><th>Source basis</th><th></th></tr></thead>";
    var tb = el("tbody");
    elements.forEach(function (w) {
      var tr = el("tr", null, "<td><strong>" + esc(w.wbsCode) + "</strong></td><td class='muted'>" + esc(w.parentWbsCode || "-") + "</td><td>" + esc(w.title) + "</td><td><span class='badge " + (w.isSummary ? "neutral" : "ok") + "'>" + (w.isSummary ? "Summary" : "Activity") + "</span></td><td>" + fmtDate(w.plannedStart) + " - " + fmtDate(w.plannedFinish) + "</td><td class='num'>" + pct(w.percentComplete) + "</td><td class='num'>" + (linked[w.wbsCode] || 0) + "</td><td class='muted'>" + esc(w.sourceBasis || "") + "</td><td class='right'></td>");
      if (canEdit()) {
        tr.querySelector("td.right").appendChild(mkBtn("Edit", "btn sm", function () { openWbsElementEditor(p.id, w); }));
        tr.querySelector("td.right").appendChild(mkBtn("Delete", "btn sm danger", function () { deleteWbsElementPrompt(p.id, w.wbsCode); }));
      }
      tb.appendChild(tr);
    });
    if (!elements.length) tb.appendChild(el("tr", null, "<td colspan='9' class='empty'>No WBS elements for this project. Add one or upload a WBS CSV.</td>"));
    tbl.appendChild(tb); root.appendChild(el("div", { class: "panel table-wrap" })).appendChild(tbl);
  }
  function openWbsElementEditor(projectId, existing) {
    if (!canEdit()) return toast("Viewer role is read-only", "err");
    var w = existing ? Object.assign({}, existing) : { projectId: projectId, wbsCode: "", parentWbsCode: "", title: "", description: "", isSummary: false, sourceBasis: "", plannedStart: "", plannedFinish: "", percentComplete: 0, remainingDuration: "", sortOrder: projectWbsElements(projectId).length + 1 };
    var body = el("div");
    body.innerHTML = "<div class='form-grid'>" +
      "<div class='form-row'><label class='field-label inline'>WBS / Schedule ID</label><input class='input' id='wbsCode' value='" + esc(w.wbsCode || "") + "'></div>" +
      "<div class='form-row'><label class='field-label inline'>Parent WBS</label><input class='input' id='wbsParent' value='" + esc(w.parentWbsCode || "") + "'></div>" +
      "<div class='form-row full'><label class='field-label inline'>Schedule title</label><input class='input' id='wbsTitle' value='" + esc(w.title || "") + "'></div>" +
      "<div class='form-row'><label class='field-label inline'>Planned start</label><input class='input' type='date' id='wbsStart' value='" + esc(w.plannedStart || "") + "'></div>" +
      "<div class='form-row'><label class='field-label inline'>Planned finish</label><input class='input' type='date' id='wbsFinish' value='" + esc(w.plannedFinish || "") + "'></div>" +
      "<div class='form-row'><label class='field-label inline'>Percent complete</label><input class='input' type='number' min='0' max='100' id='wbsPct' value='" + esc(w.percentComplete || 0) + "'></div>" +
      "<div class='form-row'><label class='field-label inline'>Remaining duration</label><input class='input' type='number' min='0' step='0.25' id='wbsRem' value='" + esc(w.remainingDuration || "") + "'></div>" +
      "<div class='form-row'><label class='field-label inline'>Sort order</label><input class='input' type='number' id='wbsSort' value='" + esc(w.sortOrder || 0) + "'></div>" +
      "<div class='form-row full'><label class='field-label inline'><input type='checkbox' id='wbsSummary'" + (w.isSummary ? " checked" : "") + "> Summary grouping</label></div>" +
      "<div class='form-row full'><label class='field-label inline'>Description</label><textarea class='textarea' id='wbsDesc'>" + esc(w.description || "") + "</textarea></div>" +
      "<div class='form-row full'><label class='field-label inline'>Source basis</label><textarea class='textarea' id='wbsSource'>" + esc(w.sourceBasis || "") + "</textarea></div></div>";
    modal(existing ? "Edit WBS element" : "Add WBS element", body, [{ label: "Cancel", cls: "btn", fn: closeModal }, { label: existing ? "Save" : "Add", cls: "btn primary", fn: function () {
      var code = $("#wbsCode").value.trim().toUpperCase();
      if (!code) return toast("WBS / Schedule ID is required", "err");
      if (isLegacyWbsCode(code)) return toast("Legacy numeric WBS codes cannot be used as visible WBS codes", "err");
      mutate(function () {
        var current = existing ? wbsByCode(projectId, existing.wbsCode) : null;
        if (!current) { current = { id: uid("wbs"), projectId: projectId }; state.wbsElements.push(current); }
        current.wbsCode = code; current.parentWbsCode = $("#wbsParent").value.trim().toUpperCase(); current.title = $("#wbsTitle").value.trim(); current.description = $("#wbsDesc").value; current.isSummary = $("#wbsSummary").checked; current.sourceBasis = $("#wbsSource").value; current.plannedStart = $("#wbsStart").value; current.plannedFinish = $("#wbsFinish").value; current.percentComplete = normProgress($("#wbsPct").value); current.remainingDuration = $("#wbsRem").value; current.sortOrder = Number($("#wbsSort").value) || 0; normalizeWbsElement(current);
        state.cards.filter(function (c) { return c.projectId === projectId && cardWbsCode(c) === (existing && existing.wbsCode); }).forEach(function (c) { c.wbsCode = code; c.scheduleActivityId = isScheduleActivityCode(code) ? code : c.scheduleActivityId; c.parentWbsCode = current.parentWbsCode; c.scheduleTitle = current.title; });
        recordAudit("WBS", projectId, existing ? "WBS element updated" : "WBS element added", code);
      });
      closeModal(); toast("WBS element saved", "ok");
    } }], "sm");
  }
  function deleteWbsElementPrompt(projectId, code) {
    var linked = state.cards.filter(function (c) { return c.projectId === projectId && cardWbsCode(c) === code; }).length;
    confirmModal("Delete WBS element?", code + " will be removed." + (linked ? " " + linked + " linked card(s) will also be deleted." : ""), function () {
      mutate(function () {
        state.wbsElements = (state.wbsElements || []).filter(function (w) { return !(w.projectId === projectId && w.wbsCode === code); });
        state.cards = state.cards.filter(function (c) { return !(c.projectId === projectId && cardWbsCode(c) === code); });
        recordAudit("WBS", projectId, "WBS element deleted", code);
      });
      toast("WBS element deleted", "ok");
    });
  }
  function parseWbsCsv(text, projectId) {
    var rows = parseCSV(text, text.indexOf("\\t") !== -1 && text.indexOf(",") === -1 ? "\\t" : ",");
    if (rows.length < 2) throw new Error("WBS upload needs a header row and at least one WBS row.");
    var headers = rows[0].map(function (h) { return String(h || "").trim().toLowerCase(); });
    function val(row, names) { for (var i = 0; i < names.length; i++) { var idx = headers.indexOf(names[i]); if (idx !== -1) return row[idx] || ""; } return ""; }
    return rows.slice(1).map(function (row, idx) {
      return normalizeWbsElement({ projectId: projectId, wbsCode: val(row, ["wbscode", "wbs code", "wbs / schedule id", "scheduleactivityid", "activity id"]), parentWbsCode: val(row, ["parentwbscode", "parent wbs", "parent"]), title: val(row, ["title", "schedule title", "name"]), description: val(row, ["description"]), isSummary: /true|yes|summary/i.test(val(row, ["issummary", "summary", "type"])), sourceBasis: val(row, ["sourcebasis", "source basis"]), plannedStart: val(row, ["plannedstart", "planned start", "start"]), plannedFinish: val(row, ["plannedfinish", "planned finish", "finish"]), percentComplete: normProgress(val(row, ["percentcomplete", "percent complete", "% complete"])), remainingDuration: val(row, ["remainingduration", "remaining duration"]), sortOrder: Number(val(row, ["sortorder", "sort order"])) || idx + 1 });
    }).filter(function (w) { return w.wbsCode; });
  }
  function uploadWbsElementsPrompt(projectId) {
    var input = el("input", { type: "file", accept: ".csv,.tsv,text/csv,text/tab-separated-values" });
    input.addEventListener("change", function () { var file = input.files && input.files[0]; if (!file) return; var reader = new FileReader(); reader.onload = function () { try { var rows = parseWbsCsv(String(reader.result || ""), projectId); mutate(function () { rows.forEach(function (w) { if (isLegacyWbsCode(w.wbsCode)) throw new Error("Legacy numeric WBS code found: " + w.wbsCode); var existing = wbsByCode(projectId, w.wbsCode); if (existing) Object.assign(existing, w); else state.wbsElements.push(w); }); recordAudit("WBS", projectId, "WBS upload", file.name + " - " + rows.length + " rows"); }); toast("WBS upload complete: " + rows.length + " row(s)", "ok"); } catch (e) { toast(e.message || "WBS upload failed", "err"); } }; reader.readAsText(file); });
    input.click();
  }

  function renderWorkspaceKanban(root, p, prevFilter) {
    var prevBoard = state.activeBoardId;
    var prevProject = ui.filterProject;
    state.activeBoardId = p.boardId;
    ui.filterProject = p.id || prevFilter || "";
    var b = activeBoard();
    var cards = state.cards.filter(function (c) { return c.projectId === p.id; });
    var banner = el("div", { class: "panel panel-pad mb project-kanban-workspace", "data-project-kanban": p.id });
    banner.innerHTML = "<div class='flex wrap' style='align-items:flex-start;justify-content:space-between;gap:12px'><div><h2 style='margin:0'>Project Kanban · " + esc(p.unanetProjectCode || p.name) + "</h2><div class='muted'>Dedicated project execution view using this project\'s WBS, rules of credit, dependencies, and resource assignments. The global Kanban board remains a cross-project control center.</div></div><div class='right'><span class='badge ok'>" + esc(p.orgUnit || DEFAULT_ORG_UNIT) + "</span><span class='badge neutral' style='margin-left:6px'>" + esc((b && b.name) || "Project board") + "</span></div></div>" +
      "<div class='grid cols-4 mt'>" + statCardHTML("Work items", cards.length, "filtered to this project") + statCardHTML("Board layout", b ? b.columns.length + " stages" : "—", "project-specific lane set") + statCardHTML("Rules linked", cards.filter(function (c) { return c.ruleOfCreditId; }).length, "physical % control") + statCardHTML("Resources", projectResourceRows(p.id).length, "assigned on cards") + "</div>";
    root.appendChild(banner);
    VIEWS.board(root);
    state.activeBoardId = prevBoard;
    ui.filterProject = p.id || prevProject || "";
  }
  function renderWorkspaceGantt(root, p) {
    var prev = state.activeBoardId; state.activeBoardId = p.boardId; VIEWS.gantt(root); state.activeBoardId = prev;
  }
  function projectResourceRows(projectId) {
    var map = {};
    state.cards.filter(function (c) { return c.projectId === projectId; }).forEach(function (c) {
      cardAssignments(c).forEach(function (a) {
        var rid = a.resourceId, share = (a.allocationPct || 0) / 100;
        var row = map[rid] || (map[rid] = { resourceId: rid, cards: 0, estimate: 0, logged: 0, remaining: 0, earned: 0, allocationPct: 0, preparerCards: 0, reviewerCards: 0, approverCards: 0 });
        row.cards += 1; row.estimate += (c.estimateHours || 0) * share; row.logged += (c.loggedHours || 0) * share; row.remaining += Math.max(0, (c.estimateHours || 0) - (c.loggedHours || 0)) * share; row.earned += (c.estimateHours || 0) * ((c.progress || 0) / 100) * share; row.allocationPct += a.allocationPct || 0;
        if ((c.preparers || []).length) row.preparerCards += 1;
        if ((c.reviewers || []).length) row.reviewerCards += 1;
        if ((c.approvers || []).length) row.approverCards += 1;
      });
    });
    return Object.keys(map).map(function (k) { return map[k]; }).sort(function (a, b) { return ((resourceById(a.resourceId) || {}).name || "") > ((resourceById(b.resourceId) || {}).name || "") ? 1 : -1; });
  }
  function renderWorkspaceResources(root, p) {
    var rows = projectResourceRows(p.id);
    var filterBar = el("div", { class: "filters mb" });
    var search = el("input", { class: "input", type: "search", placeholder: "Search assigned resources...", style: "max-width:260px" });
    search.value = ui.projectResourceSearch || "";
    search.addEventListener("input", function () { ui.projectResourceSearch = search.value; render(); });
    var utilFilter = el("select", { class: "select select-sm" }, "<option value=''>All utilization</option><option value='over'" + (ui.projectResourceUtilFilter === "over" ? " selected" : "") + ">Over 100%</option><option value='watch'" + (ui.projectResourceUtilFilter === "watch" ? " selected" : "") + ">90%-100%</option><option value='open'" + (ui.projectResourceUtilFilter === "open" ? " selected" : "") + ">Under 90%</option>");
    utilFilter.addEventListener("change", function () { ui.projectResourceUtilFilter = utilFilter.value; render(); });
    filterBar.appendChild(search); filterBar.appendChild(utilFilter); root.appendChild(filterBar);
    rows = rows.filter(function (row) {
      var r = resourceById(row.resourceId), u = r ? resourceUtil(r) : { util: 0 };
      var q = String(ui.projectResourceSearch || "").toLowerCase();
      if (q && String((r ? r.name : "") + " " + (r ? r.role : "") + " " + (r ? r.type : "")).toLowerCase().indexOf(q) === -1) return false;
      if (ui.projectResourceUtilFilter === "over" && u.util <= 100) return false;
      if (ui.projectResourceUtilFilter === "watch" && (u.util < 90 || u.util > 100)) return false;
      if (ui.projectResourceUtilFilter === "open" && u.util >= 90) return false;
      row.util = u.util; return true;
    }).sort(function (a, b) { return (b.util || 0) - (a.util || 0); });
    var tbl = el("table", { class: "table table-dense" });
    tbl.innerHTML = "<thead><tr><th>Rank</th><th>Resource</th><th>Type</th><th class='num'>Cards</th><th class='num'>Estimate</th><th class='num'>Logged</th><th class='num'>Remaining</th><th class='num'>Earned hrs</th><th>Utilization</th><th>Role trace</th></tr></thead>";
    var tb = el("tbody");
    rows.forEach(function (row, idx) { var r = resourceById(row.resourceId); var cls = row.util > 110 ? "danger" : row.util > 90 ? "warn" : "ok"; tb.appendChild(el("tr", null, "<td class='num'>" + (idx + 1) + "</td><td>" + esc(r ? r.name : "-") + "</td><td>" + esc(r ? r.type : "-") + "</td><td class='num'>" + row.cards + "</td><td class='num'>" + hours(row.estimate) + "</td><td class='num'>" + hours(row.logged) + "</td><td class='num'>" + hours(row.remaining) + "</td><td class='num'>" + hours(row.earned) + "</td><td><div class='flex'><div class='bar'><span class='" + cls + "' style='width:" + clamp(row.util || 0, 0, 100) + "%'></span></div> <span class='muted'>" + pct(row.util || 0) + "</span></div></td><td class='muted'>P:" + row.preparerCards + " R:" + row.reviewerCards + " A:" + row.approverCards + "</td>")); });
    if (!rows.length) tb.appendChild(el("tr", null, "<td colspan='10' class='empty'>No resource assignments match the current filters.</td>"));
    tbl.appendChild(tb); root.appendChild(el("div", { class: "panel table-wrap" })).appendChild(tbl);
    var totals = rows.reduce(function (a, r) { a.estimate += r.estimate; a.logged += r.logged; a.remaining += r.remaining; a.earned += r.earned; return a; }, { estimate: 0, logged: 0, remaining: 0, earned: 0 });
    root.appendChild(el("div", { class: "grid cols-4 mt" }, statCardHTML("Assigned estimate", hours(totals.estimate), "from cards") + statCardHTML("Logged", hours(totals.logged), "from cards") + statCardHTML("Remaining", hours(totals.remaining), "estimate - logged") + statCardHTML("Earned hours", hours(totals.earned), "estimate x progress")));
  }
  function renderWorkspaceFinancials(root, p) {
    var r = projectRollup(p), v = projectEVM(p), mult = projectMultiplier(r);
    var thirdTile = isInternalProject(p)
      ? statCardHTML("Budget variance", money(r.variance), (internalProjectClass(p)) + " · budget − committed")
      : statCardHTML("CM %", pctRatio(r.contributionMargin), mult ? num2(mult) + "x multiplier" : "internal");
    root.appendChild(el("div", { class: "grid cols-4" }, statCardHTML("Budget", money(r.budget), projectBillingType(p)) + statCardHTML("Committed", money(r.committed), "cost EAC basis") + thirdTile + statCardHTML("Burn", pct(r.burn * 100), "spent / budget")));
    root.appendChild(el("div", { class: "grid cols-4 mt" }, statCardHTML("BAC", money(v.bac), "") + statCardHTML("EV", money(v.ev), "") + statCardHTML("AC", money(v.ac), "") + statCardHTML("EAC", money(v.eac), "")));
    renderProjectMetricsPanel(root, p);
  }
  function renderWorkspaceReports(root, p) {
    var actions = el("div", { class: "flex wrap mb no-print" });
    actions.appendChild(mkBtn("Export PDF", "btn primary sm", function () { window.print(); }));
    actions.appendChild(el("span", { class: "hint" }, "Use the browser print dialog and choose Save as PDF."));
    root.appendChild(actions);
    if (canFinance()) {
      var r = projectRollup(p), evm = projectEVM(p), hist = projectFinancialHistory(p), latest = hist[hist.length - 1] || {};
      root.appendChild(el("div", { class: "grid cols-4 mb" }, statCardHTML("Contract value", money(contractValue(p)), "latest funded value") + statCardHTML("Cost EAC", money(latest.costEAC || p.costEACOverride || evm.eac), "dynamic from cards / EV") + statCardHTML("Bill EAC", latest.billEAC == null ? "-" : money(latest.billEAC), projectBillingType(p)) + statCardHTML("VAC", money((contractValue(p) || 0) - (latest.costEAC || evm.eac || 0)), "contract - cost EAC")));
      if (filterMetricsForRole(projectMetricRows(p)).length) renderProjectMetricsPanel(root, p);
    }
    root.appendChild(renderClientReport(p));
  }
  function renderProjectRiskRegister(root, p) {
    var risks = (state.risks || []).filter(function (r) { return r.projectId === p.id; });
    var gov = canGovernRegisters();
    var actions = el("div", { class: "flex wrap mb", style: "gap:8px" });
    if (gov) actions.appendChild(mkBtn("+ Add risk", "btn primary sm", function () { openRiskEditor(null, p.id); }));
    actions.appendChild(mkBtn("⬇ Export register", "btn sm", function () { exportRiskRegisterCSV(p.id); }));
    root.appendChild(actions);

    // Signed Risk Management Plan (tracked with the project).
    root.appendChild(renderRiskPlanPanel(p));

    var header = el("div", { class: "grid cols-4 mb" });
    var open = risks.filter(function (r) { return r.status !== "Closed"; });
    var high = risks.filter(function (r) { return r.status !== "Closed" && riskScore(r) >= 12; });
    var plan = p.riskManagementPlan;
    header.innerHTML = statCardHTML("Project risks", risks.length, p.unanetProjectCode || "") + statCardHTML("Open", open.length, "active") + statCardHTML("High exposure", high.length, "score ≥ 12") +
      statCardHTML("Signed plan", plan ? (plan.revision || "on file") : "none", plan ? (plan.signedDate ? "signed " + fmtDate(plan.signedDate) : "not signed") : "upload to track");
    root.appendChild(header);

    var panel = el("div", { class: "panel table-wrap" });
    var tbl = el("table", { class: "table table-dense" });
    tbl.innerHTML = "<thead><tr><th>Risk</th><th>Type</th><th>Category</th><th class='num'>Score</th><th class='num'>Residual</th><th>Response</th><th>Owner</th><th>Status</th><th>Due</th><th>Trigger</th></tr></thead>";
    var tb = el("tbody");
    risks.slice().sort(function (a, b) { return riskScore(b) - riskScore(a); }).forEach(function (rk) {
      var score = riskScore(rk), res = riskResidualScore(rk), owner = resourceById(rk.ownerId);
      var tr = el("tr", gov ? { style: "cursor:pointer" } : null);
      tr.innerHTML = "<td><strong>" + esc(rk.title) + "</strong>" + (rk.notes ? "<div class='muted'>" + esc(rk.notes) + "</div>" : "") + "</td>" +
        "<td><span class='badge " + (rk.riskType === "Opportunity" ? "ok" : "neutral") + "'>" + esc(rk.riskType || "Threat") + "</span></td>" +
        "<td>" + esc(rk.category || "") + "</td>" +
        "<td class='num'><span class='badge " + riskSevClass(score) + "'>" + score + "</span></td>" +
        "<td class='num'><span class='badge " + riskSevClass(res) + "'>" + res + "</span></td>" +
        "<td>" + esc(rk.response || "") + "</td><td class='muted'>" + esc(owner ? owner.name : "-") + "</td>" +
        "<td><span class='badge " + (rk.status === "Closed" ? "ok" : rk.status === "Mitigating" ? "warn" : "neutral") + "'>" + esc(rk.status || "") + "</span></td>" +
        "<td class='muted'>" + (rk.dueDate ? fmtDate(rk.dueDate) : "—") + "</td>" +
        "<td class='muted'>" + esc(rk.trigger || "") + "</td>";
      if (gov) tr.addEventListener("click", function () { openRiskEditor(rk.id, p.id); });
      tb.appendChild(tr);
    });
    if (!risks.length) tb.appendChild(el("tr", null, "<td colspan='10' class='empty'>No risks for this project." + (gov ? " Use “+ Add risk” to start the register." : "") + "</td>"));
    tbl.appendChild(tb); panel.appendChild(tbl); root.appendChild(panel);
  }

  /* ---------- Risk Management Plan (signed, tracked with the project) ---------- */
  var RISK_PLAN_MAX_BYTES = 8 * 1024 * 1024; // localStorage-safe upload guard
  function renderRiskPlanPanel(p) {
    var gov = canGovernRegisters();
    var plan = p.riskManagementPlan;
    var wrap = el("div", { class: "panel panel-pad mb" });
    var head = el("div", { class: "flex", style: "justify-content:space-between;align-items:flex-start;gap:12px" });
    head.appendChild(el("div", null, "<h2 style='margin:0;font-size:15px'>Risk Management Plan</h2><div class='muted' style='font-size:12px'>The signed, controlled plan governing this project's risk process. Tracked with the project and included in exports.</div>"));
    var btns = el("div", { class: "flex", style: "gap:8px" });
    if (gov) {
      btns.appendChild(mkBtn(plan ? "Replace / update" : "Upload signed plan", "btn primary sm", function () { openRiskPlanEditor(p.id); }));
    }
    if (plan && (plan.dataUrl || plan.url)) btns.appendChild(mkBtn("Open / download", "btn sm", function () { openRiskPlanDocument(p.id); }));
    if (plan && gov) btns.appendChild(mkBtn("Remove", "btn sm danger", function () { removeRiskPlan(p.id); }));
    head.appendChild(btns);
    wrap.appendChild(head);

    if (!plan) {
      wrap.appendChild(el("div", { class: "empty", style: "margin-top:10px" }, gov ? "No signed risk management plan on file. Upload the approved plan (PDF/DOCX) or link the controlled copy in SharePoint." : "No signed risk management plan on file."));
      return wrap;
    }
    var meta = el("table", { class: "table table-dense mt" });
    var loc = plan.dataUrl ? "Stored locally" : plan.url ? "Linked (" + esc(plan.url) + ")" : "—";
    meta.innerHTML = "<tbody>" +
      row2("Document", esc(plan.fileName || plan.url || "Risk Management Plan")) +
      row2("Revision", esc(plan.revision || "—")) +
      row2("Signed by", esc(plan.signedBy || "—") + (plan.signedDate ? " · " + fmtDate(plan.signedDate) : "")) +
      row2("Approved by", esc(plan.approvedBy || "—")) +
      row2("Status", "<span class='badge " + (plan.signedDate ? "ok" : "warn") + "'>" + (plan.signedDate ? "Signed / controlled" : "Draft — not signed") + "</span>") +
      row2("Uploaded", esc((plan.uploadedBy ? plan.uploadedBy + " · " : "") + (plan.uploadedAt ? new Date(plan.uploadedAt).toLocaleString() : "")) + (plan.size ? " · " + fmtBytes(plan.size) : "")) +
      row2("Source", loc) +
      (plan.notes ? row2("Notes", esc(plan.notes)) : "") +
      "</tbody>";
    wrap.appendChild(meta);
    return wrap;
    function row2(k, v) { return "<tr><td class='muted' style='width:130px'>" + k + "</td><td>" + v + "</td></tr>"; }
  }
  function fmtBytes(n) { n = n || 0; if (n >= 1048576) return (n / 1048576).toFixed(1) + " MB"; if (n >= 1024) return Math.round(n / 1024) + " KB"; return n + " B"; }
  function openRiskPlanDocument(projectId) {
    var p = projectById(projectId); if (!p || !p.riskManagementPlan) return;
    var plan = p.riskManagementPlan;
    if (plan.dataUrl) { downloadDataUrl(plan.fileName || "risk-management-plan", plan.dataUrl); }
    else if (plan.url) { window.open(plan.url, "_blank", "noopener"); }
  }
  function removeRiskPlan(projectId) {
    var p = projectById(projectId); if (!p || !canGovernRegisters()) return;
    confirmModal("Remove risk management plan?", "This removes the signed plan record from this project. You can undo.", function () {
      mutate(function () { delete p.riskManagementPlan; recordAudit("Risk Plan", p.id, "Risk management plan removed", p.name); });
      toast("Risk management plan removed", "ok");
    });
  }
  function openRiskPlanEditor(projectId) {
    var p = projectById(projectId);
    if (!p || !canGovernRegisters()) { toast("Risk plan management is limited to governance roles", "err"); return; }
    var plan = p.riskManagementPlan || {};
    var pending = { dataUrl: plan.dataUrl || "", fileName: plan.fileName || "", mimeType: plan.mimeType || "", size: plan.size || 0 };
    var body = el("div");
    body.innerHTML =
      "<div class='form-grid'>" +
      "<div class='form-row full'><label class='field-label inline'>Signed plan file (PDF, DOCX, XLSX…)</label><input class='input' type='file' id='rpFile' accept='.pdf,.doc,.docx,.xlsx,.xls,.ppt,.pptx,.md,.txt'><div class='hint' id='rpFileHint'>" + (pending.fileName ? "Current: " + esc(pending.fileName) + (pending.size ? " (" + fmtBytes(pending.size) + ")" : "") : "Max " + fmtBytes(RISK_PLAN_MAX_BYTES) + " for local storage. For larger files, use the SharePoint link below.") + "</div></div>" +
      "<div class='form-row full'><label class='field-label inline'>…or controlled-copy link (SharePoint / DMS)</label><input class='input' id='rpUrl' value='" + esc(plan.url || "") + "' placeholder='https://contoso.sharepoint.com/…/Risk Management Plan.pdf'></div>" +
      "<div class='form-row'><label class='field-label inline'>Revision</label><input class='input' id='rpRev' value='" + esc(plan.revision || "Rev 0") + "'></div>" +
      "<div class='form-row'><label class='field-label inline'>Signed by</label><input class='input' id='rpSignedBy' value='" + esc(plan.signedBy || "") + "' placeholder='Name / title'></div>" +
      "<div class='form-row'><label class='field-label inline'>Signed date</label><input class='input' type='date' id='rpSignedDate' value='" + esc(plan.signedDate || "") + "'></div>" +
      "<div class='form-row'><label class='field-label inline'>Approved by</label><input class='input' id='rpApprovedBy' value='" + esc(plan.approvedBy || "") + "' placeholder='PMO / client approver'></div>" +
      "<div class='form-row full'><label class='field-label inline'>Notes</label><textarea class='textarea' id='rpNotes'>" + esc(plan.notes || "") + "</textarea></div>" +
      "</div>";
    body.querySelector("#rpFile").addEventListener("change", function () {
      var file = this.files && this.files[0]; if (!file) return;
      var hint = body.querySelector("#rpFileHint");
      if (file.size > RISK_PLAN_MAX_BYTES) { hint.innerHTML = "<span style='color:var(--danger)'>File is " + fmtBytes(file.size) + " — over the " + fmtBytes(RISK_PLAN_MAX_BYTES) + " local limit. Use the SharePoint link instead.</span>"; this.value = ""; return; }
      var reader = new FileReader();
      reader.onload = function () { pending.dataUrl = String(reader.result || ""); pending.fileName = file.name; pending.mimeType = file.type || ""; pending.size = file.size; hint.textContent = "Selected: " + file.name + " (" + fmtBytes(file.size) + ")"; };
      reader.onerror = function () { toast("Could not read file", "err"); };
      reader.readAsDataURL(file);
    });
    modal((p.riskManagementPlan ? "Update" : "Upload") + " Risk Management Plan", body, [
      { label: "Cancel", cls: "btn", fn: closeModal },
      { label: "Save plan", cls: "btn primary", fn: function () {
        var url = $("#rpUrl").value.trim();
        if (!pending.dataUrl && !url) { toast("Attach a file or provide a controlled-copy link", "err"); return; }
        mutate(function () {
          var prior = p.riskManagementPlan;
          if (prior) { p.riskManagementPlanHistory = p.riskManagementPlanHistory || []; var arch = Object.assign({}, prior); delete arch.dataUrl; p.riskManagementPlanHistory.push(arch); }
          p.riskManagementPlan = {
            id: uid("rmp"), fileName: pending.fileName || (url ? url.split("/").pop() : "Risk Management Plan"),
            mimeType: pending.mimeType || "", size: pending.size || 0, dataUrl: pending.dataUrl || "", url: url || "",
            revision: $("#rpRev").value.trim() || "Rev 0", signedBy: $("#rpSignedBy").value.trim(), signedDate: $("#rpSignedDate").value,
            approvedBy: $("#rpApprovedBy").value.trim(), notes: $("#rpNotes").value.trim(),
            uploadedBy: (currentUser() || {}).displayName || state.settings.role || "User", uploadedAt: new Date().toISOString(),
          };
          recordAudit("Risk Plan", p.id, "Risk management plan " + (prior ? "updated" : "uploaded"), (p.riskManagementPlan.fileName || "") + " " + p.riskManagementPlan.revision);
        });
        closeModal(); toast("Risk management plan saved", "ok");
      } },
    ]);
  }
  function exportRiskRegisterCSV(projectId) {
    var rows = (state.risks || []).filter(function (r) { return !projectId || r.projectId === projectId; });
    var headers = ["ID", "Project", "Risk", "Type", "Category", "Probability", "Impact", "Score", "Response", "Residual Probability", "Residual Impact", "Residual Score", "Owner", "Status", "Cost Impact", "Schedule Impact (days)", "Date Identified", "Last Reviewed", "Response Due", "Trigger", "Response Plan / Notes"];
    var lines = [headers.map(csvCell).join(",")];
    rows.forEach(function (r) {
      var p = projectById(r.projectId), owner = resourceById(r.ownerId);
      lines.push([r.id, p ? p.name : "", r.title, r.riskType || "Threat", r.category || "", r.probability, r.impact, riskScore(r), r.response || "", r.residualProbability, r.residualImpact, riskResidualScore(r), owner ? owner.name : "", r.status || "", r.costImpact || 0, r.scheduleImpactDays || 0, r.dateIdentified || "", r.lastReviewed || "", r.dueDate || "", r.trigger || "", r.notes || ""].map(csvCell).join(","));
    });
    var scope = projectId ? ((projectById(projectId) || {}).unanetProjectCode || "project") : "portfolio";
    var name = "risk-register-" + String(scope).replace(/[^A-Za-z0-9_-]+/g, "-") + "-" + todayISO() + ".csv";
    download(name, lines.join("\r\n"), "text/csv");
    toast("Risk register exported (" + rows.length + " risk" + (rows.length === 1 ? "" : "s") + ")", "ok");
  }
  function renderWorkspaceLinkedTable(root, label, rows) {
    var tbl = el("table", { class: "table" });
    tbl.innerHTML = "<thead><tr><th>" + esc(label) + "</th><th>Status</th><th>Owner / Date</th></tr></thead>";
    var tb = el("tbody");
    rows.forEach(function (x) { tb.appendChild(el("tr", null, "<td>" + esc(x.title || x.name || x.number || "—") + "</td><td>" + esc(x.status || x.state || "—") + "</td><td class='muted'>" + esc(x.ownerId ? ((resourceById(x.ownerId) || {}).name || "") : (x.requestedDate || x.proposedDate || "")) + "</td>")); });
    if (!rows.length) tb.appendChild(el("tr", null, "<td colspan='3' class='empty'>No " + esc(label.toLowerCase()) + " for this project.</td>"));
    tbl.appendChild(tb); root.appendChild(el("div", { class: "panel" })).appendChild(tbl);
  }
  function importWbsPrompt(projectId) {
    var input = el("input", { type: "file", accept: ".csv,.tsv,text/csv,text/tab-separated-values" });
    input.addEventListener("change", function () { var file = input.files && input.files[0]; if (!file) return; var reader = new FileReader(); reader.onload = function () { try { var parsed = parseCesP6Csv(String(reader.result || ""), file.name); if (parsed.errors.length) throw new Error(parsed.errors.join(" ")); var id = importWbsTasks(projectId, parsed); toast("WBS import complete: " + parsed.tasks.length + " item(s)", "ok"); } catch (e) { toast(e.message || "WBS import failed", "err"); } }; reader.readAsText(file); });
    input.click();
  }

  /* ---------- Projects ---------- */
  VIEWS.projects = function (root) {
    var head = pageHead("Projects", "Rollups across all boards. Open a board, or administer a project's information and change orders.");
    if (canGovernRegisters()) {
      var addBtn = el("button", { class: "btn primary sm" }, "+ New project");
      addBtn.addEventListener("click", function () { openProjectAdmin(null); });
      head.querySelector(".head-actions").appendChild(addBtn);
    }
    root.appendChild(head);
    var fin = canFinance();
    if (!state.projects.length) { root.appendChild(el("div", { class: "panel panel-pad empty" }, "No projects yet. Create one to start tracking scope, budget, and change orders.")); return; }
    var panel = el("div", { class: "panel" });
    var tbl = el("table", { class: "table" });
    var targetCmLabel = pct1(targetContributionMarginRatio() * 100);
    tbl.innerHTML = "<thead><tr><th>Project</th><th>Client</th><th>Status</th><th>Progress</th><th class='num'>Cards</th><th class='num'>CO</th>" +
      (fin ? "<th class='num'>Budget</th><th class='num'>Spent</th><th class='num'>CM % <span class='muted'>(target " + targetCmLabel + ")</span></th><th>Budget Burn</th>" : "") + "<th></th></tr></thead>";
    var tb = el("tbody");
    state.projects.forEach(function (p) {
      var r = projectRollup(p);
      var tr = el("tr");
      var burnCls = r.burn > 0.9 ? "danger" : r.burn > 0.7 ? "warn" : "ok";
      var cos = changeOrdersFor(p.id);
      var pending = cos.filter(function (c) { return !coApproved(c) && c.status !== "Rejected"; }).length;
      var html =
        "<td><button class='linklike' data-open-project='" + p.id + "'>" + esc(p.name) + "</button></td>" +
        "<td class='muted'>" + esc(p.client) + "</td>" +
        "<td><span class='badge " + (p.status === "Active" ? "ok" : p.status === "Closed" || p.status === "Cancelled" ? "neutral" : "warn") + "'>" + esc(p.status) + "</span></td>" +
        "<td><div class='flex'><div class='bar'><span class='ok' style='width:" + r.progress + "%'></span></div> <span class='muted'>" + r.progress + "%</span></div></td>" +
        "<td class='num'>" + r.done + "/" + r.cards + "</td>" +
        "<td class='num'>" + cos.length + (pending ? " <span class='badge warn'>" + pending + " pend</span>" : "") + "</td>";
      if (fin) {
        html += "<td class='num'>" + money(r.budget) + "</td>" +
          "<td class='num'>" + money(r.spent) + "</td>" +
          "<td class='num'>" + (isInternalProject(p) ? "<span class='badge " + (r.variance >= 0 ? "ok" : "danger") + "' title='Budget variance — " + esc(internalProjectClass(p)) + "'>" + money(r.variance) + "</span>" : "<span class='badge " + contributionMarginStatusClass(r.contributionMargin) + "' title='Target CM " + targetCmLabel + "'>" + pctRatio(r.contributionMargin) + "</span>") + "</td>" +
          "<td><div class='flex'><div class='bar'><span class='" + burnCls + "' style='width:" + clamp(r.burn * 100, 0, 100) + "%'></span></div> <span class='muted'>" + pct(r.burn * 100) + "</span></div></td>";
      }
      html += "<td class='right'></td>";
      tr.innerHTML = html;
      var adminBtn = el("button", { class: "btn sm" }, canGovernRegisters() ? "⚙ Admin" : "View");
      adminBtn.addEventListener("click", function () { openProjectAdmin(p.id); });
      tr.querySelector("td.right").appendChild(adminBtn);
      if (fin) {
        var histBtn = el("button", { class: "btn sm ghost", style: "margin-left:6px" }, "FV/EAC");
        histBtn.addEventListener("click", function () { openProjectFinancialHistory(p.id); });
        tr.querySelector("td.right").appendChild(histBtn);
      }
      tb.appendChild(tr);
    });
    tbl.appendChild(tb);
    panel.appendChild(tbl);
    root.appendChild(panel);
  };

  /* ---------- Project administration ---------- */
  function openProjectAdmin(projectId) {
    if (!canEdit() && !projectId) return;
    var isNew = !projectId;
    var p = projectId ? projectById(projectId) : {
      id: uid("p"), name: "", client: "", boardId: (activeBoard() || state.boards[0]).id, budget: 0,
      billable: true, billingType: "T&M", orgUnit: DEFAULT_ORG_UNIT, startDate: todayISO(), endDate: todayISO(), status: "Active", _new: true,
    };
    var ro = !canEdit();
    var body = el("div", { class: "card-editor-compact" });
    body.innerHTML =
      "<div class='form-grid'>" +
      "<div class='form-row full'><label class='field-label inline'>Project name</label><input class='input' id='paName' value='" + esc(p.name) + "'" + (ro ? " disabled" : "") + "></div>" +
      "<div class='form-row'><label class='field-label inline'>Client</label><input class='input' id='paClient' value='" + esc(p.client) + "'" + (ro ? " disabled" : "") + "></div>" +
      "<div class='form-row'><label class='field-label inline'>Primary board</label><select class='select' id='paBoard'" + (ro ? " disabled" : "") + ">" + state.boards.map(function (b) { return "<option value='" + b.id + "'" + (b.id === p.boardId ? " selected" : "") + ">" + esc(b.name) + "</option>"; }).join("") + "</select></div>" +
      "<div class='form-row'><label class='field-label inline'>Org unit</label><select class='select' id='paOrgUnit'" + (ro ? " disabled" : "") + ">" + ORG_UNITS.map(function (org) { return "<option value='" + org + "'" + (org === (p.orgUnit || DEFAULT_ORG_UNIT) ? " selected" : "") + ">" + org + "</option>"; }).join("") + "</select></div>" +
      "<div class='form-row'><label class='field-label inline'>Status</label><select class='select' id='paStatus'" + (ro ? " disabled" : "") + ">" + PROJECT_STATUS.map(function (s) { return "<option" + (s === p.status ? " selected" : "") + ">" + s + "</option>"; }).join("") + "</select></div>" +
      "<div class='form-row'><label class='field-label inline'>Contract value / budget ($)</label><input class='input' type='number' id='paBudget' value='" + (p.budget || 0) + "'" + (ro ? " disabled" : "") + "></div>" +
      "<div class='form-row'><label class='field-label inline'>Billing type</label><select class='select' id='paBillingType'" + (ro ? " disabled" : "") + ">" + BILLING_TYPES.map(function (bt) { return "<option" + (bt === projectBillingType(p) ? " selected" : "") + ">" + bt + "</option>"; }).join("") + "</select></div>" +
      "<div class='form-row'><label class='field-label inline'><input type='checkbox' id='paBillable'" + (p.billable ? " checked" : "") + (ro ? " disabled" : "") + "> Billable (client-facing revenue)</label></div>" +
      "<div class='form-row'><label class='field-label inline'>Start date</label><input class='input' type='date' id='paStart' value='" + (p.startDate || "") + "'" + (ro ? " disabled" : "") + "></div>" +
      "<div class='form-row'><label class='field-label inline'>Target end date</label><input class='input' type='date' id='paEnd' value='" + (p.endDate || "") + "'" + (ro ? " disabled" : "") + "></div>" +
      "</div>";

    if (!isNew) {
      // Baseline + change-control summary (finance roles only).
      if (canFinance()) {
        var bImpact = coBudgetImpact(p.id), sImpact = coScheduleImpact(p.id);
        var base = p.baseline || { budget: p.budget, endDate: p.endDate };
        var summary = el("div", { class: "panel panel-pad mt" });
        summary.innerHTML = "<h2 style='font-size:14px'>Baseline & change-control impact</h2>" +
          "<div class='grid cols-3'>" +
          statCardHTML("Original budget", money(base.budget), "baseline") +
          statCardHTML("Approved CO impact", (bImpact >= 0 ? "+" : "") + money(bImpact), sImpact ? sImpact + " days schedule" : "no schedule change") +
          statCardHTML("Current budget", money(p.budget), "baseline + approved COs") + "</div>";
        body.appendChild(summary);
      }

      // Change orders list
      var coWrap = el("div", { class: "mt" });
      var coHead = el("div", { class: "flex" });
      coHead.appendChild(el("label", { class: "field-label inline", style: "flex:1" }, "Change orders"));
      if (canGovernRegisters()) { var addCo = el("button", { class: "btn sm" }, "+ Add change order"); addCo.addEventListener("click", function () { closeModal(); openChangeOrderEditor(null, p.id); }); coHead.appendChild(addCo); }
      coWrap.appendChild(coHead);
      var cos = changeOrdersFor(p.id);
      if (!cos.length) coWrap.appendChild(el("div", { class: "muted mt" }, "No change orders."));
      else {
        var ct = el("table", { class: "table mt" });
        ct.innerHTML = "<thead><tr><th>#</th><th>Title</th><th>Category</th><th class='num'>Δ Budget</th><th class='num'>Δ Days</th><th>Status</th></tr></thead>";
        var ctb = el("tbody");
        cos.forEach(function (co) {
          var tr = el("tr", { style: "cursor:pointer" });
          tr.innerHTML = "<td>" + esc(co.number) + "</td><td>" + esc(co.title) + "</td><td><span class='chip label'>" + esc(co.category) + "</span></td>" +
            "<td class='num'>" + (co.budgetDelta ? money(co.budgetDelta) : "—") + "</td><td class='num'>" + (co.scheduleDeltaDays || "—") + "</td>" +
            "<td>" + coStatusBadge(co.status) + "</td>";
          tr.addEventListener("click", function () {
            if (!canGovernRegisters()) { toast("Change control is read-only for your role", "err"); return; }
            closeModal(); openChangeOrderEditor(co.id, p.id);
          });
          ctb.appendChild(tr);
        });
        ct.appendChild(ctb); coWrap.appendChild(ct);
      }
      body.appendChild(coWrap);

      if (canFinance()) {
        var histWrap = el("div", { class: "panel mt" });
        histWrap.appendChild(el("div", { class: "panel-pad" }, "<div class='flex'><button class='btn sm primary' type='button'>FV &amp; EAC History</button><span class='muted'>Budget audit trail and EAC trend tab</span></div>"));
        histWrap.appendChild(renderProjectFinancialHistory(p));
        body.appendChild(histWrap);
      }

      var planWrap = el("div", { class: "panel panel-pad mt" });
      planWrap.innerHTML = "<div class='flex'><h2 style='font-size:14px;flex:1;margin:0'>Project plan revisions</h2></div><p class='muted'>Upload and manage project management plans, execution plans, risk plans, or client-approved revisions retained with this project.</p>";
      if (canGovernRegisters()) planWrap.querySelector(".flex").appendChild(mkBtn("+ Upload plan revision", "btn sm primary", function () { uploadProjectPlanPrompt(p.id); }));
      var plans = p.projectPlans || [];
      if (!plans.length) planWrap.appendChild(el("div", { class: "empty" }, "No project plan revisions uploaded."));
      else {
        var pt = el("table", { class: "table table-dense mt" });
        pt.innerHTML = "<thead><tr><th>Plan</th><th>Revision</th><th>Status</th><th>Uploaded</th><th>Notes</th><th></th></tr></thead>";
        var ptb = el("tbody");
        plans.slice().sort(function (a, b) { return String(b.uploadedAt).localeCompare(String(a.uploadedAt)); }).forEach(function (pl) {
          var tr = el("tr", null, "<td><strong>" + esc(pl.name) + "</strong><div class='muted'>" + esc(pl.type || "") + "</div></td><td>" + esc(pl.revision || "") + "</td><td><span class='badge " + (pl.status === "Current" ? "ok" : "neutral") + "'>" + esc(pl.status || "Current") + "</span></td><td class='muted'>" + new Date(pl.uploadedAt).toLocaleString() + "</td><td class='muted'>" + esc(pl.notes || "") + "</td><td class='right'></td>");
          if (canGovernRegisters()) tr.querySelector("td.right").appendChild(mkBtn("Delete", "btn sm danger", function () { deleteProjectPlanRevision(p.id, pl.id); }));
          ptb.appendChild(tr);
        });
        pt.appendChild(ptb); planWrap.appendChild(pt);
      }
      body.appendChild(planWrap);
    }

    var foot = [];
    if (!isNew && canGovernRegisters()) foot.push({ label: "Delete project", cls: "btn danger", side: "left", fn: function () {
      closeModal();
      confirmModal("Delete project " + p.name + "?", "Its " + changeOrdersFor(p.id).length + " change order(s) are removed and its cards are unlinked (not deleted). Undoable.", function () {
        mutate(function () {
          state.changeOrders = (state.changeOrders || []).filter(function (co) { return co.projectId !== p.id; });
          state.cards.forEach(function (c) { if (c.projectId === p.id) c.projectId = null; });
          state.projects = state.projects.filter(function (x) { return x.id !== p.id; });
        });
        toast("Project deleted");
      });
    } });
    foot.push({ label: "Close", cls: "btn", fn: closeModal });
    if (canGovernRegisters()) foot.push({ label: isNew ? "Create project" : "Save", cls: "btn primary", fn: function () {
      var name = $("#paName").value.trim();
      if (!name) { toast("Project name is required", "err"); return; }
      mutate(function () {
        p.name = name; p.client = $("#paClient").value.trim(); p.boardId = $("#paBoard").value; p.orgUnit = $("#paOrgUnit").value || DEFAULT_ORG_UNIT;
        p.status = $("#paStatus").value; p.budget = parseFloat($("#paBudget").value) || 0;
        p.billingType = $("#paBillingType").value; p.billable = $("#paBillable").checked; p.startDate = $("#paStart").value || null; p.endDate = $("#paEnd").value || null;
        if (p._new) { delete p._new; p.baseline = { budget: p.budget, endDate: p.endDate }; normalizeProject(p, state); state.projects.push(p); recordAudit("Project", p.id, "Project created", p.name); }
        else { normalizeProject(p, state); recordAudit("Project", p.id, "Project saved", p.name); }
      });
      closeModal();
      toast(isNew ? "Project created" : "Project saved", "ok");
    } });
    modal(isNew ? "New project" : "Administer · " + p.name, body, foot);
    setTimeout(function () { var n = $("#paName"); if (n && isNew) n.focus(); }, 30);
  }

  function uploadProjectPlanPrompt(projectId) {
    var p = projectById(projectId);
    if (!p || !canGovernRegisters()) return;
    var input = el("input", { type: "file", accept: ".pdf,.doc,.docx,.xlsx,.xls,.csv,.md,.txt,.pptx,.json" });
    input.addEventListener("change", function () {
      var file = input.files && input.files[0];
      if (!file) return;
      var rev = prompt("Revision label", "Rev " + ((p.projectPlans || []).length + 1));
      if (rev == null) return;
      var notes = prompt("Revision notes", "") || "";
      var reader = new FileReader();
      reader.onload = function () {
        mutate(function () {
          p.projectPlans = p.projectPlans || [];
          p.projectPlans.forEach(function (pl) { if (pl.status === "Current") pl.status = "Superseded"; });
          p.projectPlans.push({ id: uid("plan"), name: file.name, type: file.type || "project-plan", size: file.size, revision: rev || "Rev " + (p.projectPlans.length + 1), status: "Current", notes: notes, uploadedAt: new Date().toISOString(), dataUrl: String(reader.result || "") });
          recordAudit("Project Plan", p.id, "Plan revision uploaded", file.name + " " + rev);
        });
        closeModal(); openProjectAdmin(projectId); toast("Project plan revision uploaded", "ok");
      };
      reader.readAsDataURL(file);
    });
    input.click();
  }
  function deleteProjectPlanRevision(projectId, planId) {
    var p = projectById(projectId);
    if (!p) return;
    confirmModal("Delete project plan revision?", "This removes the selected project plan revision from local storage.", function () {
      mutate(function () { p.projectPlans = (p.projectPlans || []).filter(function (pl) { return pl.id !== planId; }); recordAudit("Project Plan", p.id, "Plan revision deleted", planId); });
      closeModal(); openProjectAdmin(projectId); toast("Project plan revision deleted", "ok");
    });
  }
  function coStatusBadge(s) {
    var cls = s === "Approved" || s === "Implemented" ? "ok" : s === "Rejected" ? "danger" : s === "Under Review" ? "warn" : "neutral";
    return "<span class='badge " + cls + "'>" + esc(s) + "</span>";
  }

  function normalizeFileAttachment(att) {
    att = att || {};
    return {
      id: att.id || uid("file"),
      name: att.name || att.filename || "Change order file",
      revision: att.revision || att.rev || "",
      type: att.type || "",
      size: Number(att.size || att.bytes || 0),
      uploadedAt: att.uploadedAt || new Date().toISOString(),
      uploadedBy: att.uploadedBy || ((currentUser() || {}).displayName || "Local user"),
      dataUrl: att.dataUrl || att.url || "",
      notes: att.notes || ""
    };
  }
  function addChangeOrderAttachment(co, att) {
    if (!co) return 0;
    co.attachments = (co.attachments || []).map(normalizeFileAttachment);
    co.attachments.push(normalizeFileAttachment(att));
    return co.attachments.length;
  }

  function nextCoNumber() {
    var max = 0;
    (state.changeOrders || []).forEach(function (co) { var m = String(co.number || "").match(/(\d+)/); if (m) max = Math.max(max, parseInt(m[1], 10)); });
    var n = max + 1;
    return "CO-" + (n < 100 ? ("00" + n).slice(-3) : n);
  }

  /* ---------- Change Control register (PMI integrated change control) ---------- */
  VIEWS.changecontrol = function (root) {
    var head = pageHead("Change Control", "Integrated change control: requests, CCB decisions, and baseline impact across all projects.");
    if (canGovernRegisters() && state.projects.length) {
      var addBtn = el("button", { class: "btn primary sm" }, "+ New change order");
      addBtn.addEventListener("click", function () { openChangeOrderEditor(null, ui.changeProjectId || state.projects[0].id); });
      head.querySelector(".head-actions").appendChild(addBtn);
    }
    root.appendChild(head);

    var filterBar = el("div", { class: "filters mb" });
    var projectSel = el("select", { class: "select select-sm" }, "<option value=''>All projects</option>" + state.projects.map(function (p) { return "<option value='" + p.id + "'" + (ui.changeProjectId === p.id ? " selected" : "") + ">" + esc(p.name) + "</option>"; }).join(""));
    projectSel.addEventListener("change", function () { ui.changeProjectId = projectSel.value; render(); });
    filterBar.appendChild(projectSel);
    root.appendChild(filterBar);
    var cos = (state.changeOrders || []).filter(function (co) { return !ui.changeProjectId || co.projectId === ui.changeProjectId; }).slice();
    var pending = cos.filter(function (c) { return !coApproved(c) && c.status !== "Rejected"; });
    var approved = cos.filter(coApproved);
    var approvedBudget = approved.reduce(function (a, c) { return a + (c.budgetDelta || 0); }, 0);
    var approvedDays = approved.reduce(function (a, c) { return a + (c.scheduleDeltaDays || 0); }, 0);
    var pendingBudget = pending.reduce(function (a, c) { return a + (c.budgetDelta || 0); }, 0);

    var stats = el("div", { class: "grid cols-4" });
    stats.appendChild(statCard("Total change orders", cos.length, approved.length + " approved"));
    stats.appendChild(statCard("Pending CCB", pending.length, money(pendingBudget) + " at stake", pending.length ? "warn" : "ok"));
    stats.appendChild(statCard("Approved Δ budget", (approvedBudget >= 0 ? "+" : "") + money(approvedBudget), "applied to baselines", approvedBudget > 0 ? "warn" : "ok"));
    stats.appendChild(statCard("Approved Δ schedule", approvedDays + " days", "across projects", approvedDays > 0 ? "warn" : "ok"));
    root.appendChild(stats);

    if (!cos.length) { root.appendChild(el("div", { class: "panel panel-pad empty mt" }, "No change orders yet. Raise one from here or from a project's admin panel.")); return; }

    var panel = el("div", { class: "panel mt" });
    var tbl = el("table", { class: "table" });
    var fin = canFinance();
    tbl.innerHTML = "<thead><tr><th>#</th><th>Project</th><th>Title</th><th>Category</th>" + (fin ? "<th class='num'>Δ Budget</th>" : "") + "<th class='num'>Δ Days</th><th>Scope</th><th class='num'>Files</th><th>Status</th><th>Requested</th></tr></thead>";
    var tb = el("tbody");
    cos.sort(function (a, b) { return String(b.requestedDate || "").localeCompare(String(a.requestedDate || "")); }).forEach(function (co) {
      var p = projectById(co.projectId);
      var tr = el("tr", { style: "cursor:pointer" });
      tr.innerHTML = "<td>" + esc(co.number) + "</td>" +
        "<td>" + (p ? esc(p.name) : "—") + "</td>" +
        "<td><strong>" + esc(co.title) + "</strong></td>" +
        "<td><span class='chip label'>" + esc(co.category) + "</span></td>" +
        (fin ? "<td class='num'>" + (co.budgetDelta ? money(co.budgetDelta) : "—") + "</td>" : "") +
        "<td class='num'>" + (co.scheduleDeltaDays || "—") + "</td>" +
        "<td class='muted'>" + ((co.scopeItems || []).length ? (co.scopeItems.length + " item" + (co.scopeItems.length > 1 ? "s" : "")) : "—") + "</td>" +
        "<td class='num'>" + ((co.attachments || []).length || "—") + "</td>" +
        "<td>" + coStatusBadge(co.status) + (co.applied ? " <span class='faint' title='Applied to baseline'>●</span>" : "") + "</td>" +
        "<td class='muted'>" + fmtDate(co.requestedDate) + "</td>";
      tr.addEventListener("click", function () { openChangeOrderEditor(co.id, co.projectId); });
      tb.appendChild(tr);
    });
    tbl.appendChild(tb);
    panel.appendChild(tbl);
    root.appendChild(panel);
    if (!fin) root.appendChild(el("div", { class: "warn-banner mt" }, "Budget figures and CCB approval are limited to manager roles. You can raise and review requests."));
  };

  function openChangeOrderEditor(coId, projectId) {
    if (!canGovernRegisters()) { toast("Change control is read-only for your role", "err"); return; }
    var isNew = !coId;
    var co = coId ? (state.changeOrders.filter(function (x) { return x.id === coId; })[0]) : {
      id: uid("co"), projectId: projectId || (state.projects[0] || {}).id, number: nextCoNumber(), title: "", category: "Scope",
      description: "", requestedBy: (currentUser() || {}).displayName || "", requestedDate: todayISO(),
      budgetDelta: 0, scheduleDeltaDays: 0, scopeItems: [], attachments: [], status: "Requested", decidedDate: "", decidedBy: "", notes: "", applied: false, createdCardIds: [], _new: true,
    };
    co.attachments = (co.attachments || []).map(normalizeFileAttachment);
    var fin = canFinance();
    // Non-managers cannot move a CO into an approving (budget-impacting) state.
    var statusOpts = CO_STATUS.filter(function (s) { return fin || (s !== "Approved" && s !== "Implemented"); });
    if (statusOpts.indexOf(co.status) === -1) statusOpts.push(co.status);

    var body = el("div");
    body.innerHTML =
      "<div class='form-grid'>" +
      "<div class='form-row'><label class='field-label inline'>Number</label><input class='input' id='coNum' value='" + esc(co.number) + "'></div>" +
      "<div class='form-row'><label class='field-label inline'>Project</label><select class='select' id='coProject'>" + state.projects.map(function (p) { return "<option value='" + p.id + "'" + (p.id === co.projectId ? " selected" : "") + ">" + esc(p.name) + "</option>"; }).join("") + "</select></div>" +
      "<div class='form-row full'><label class='field-label inline'>Title</label><input class='input' id='coTitle' value='" + esc(co.title) + "' placeholder='Short change description'></div>" +
      "<div class='form-row full'><label class='field-label inline'>Description / justification</label><textarea class='textarea' id='coDesc'>" + esc(co.description) + "</textarea></div>" +
      "<div class='form-row'><label class='field-label inline'>Category</label><select class='select' id='coCat'>" + CO_CATEGORIES.map(function (c) { return "<option" + (c === co.category ? " selected" : "") + ">" + c + "</option>"; }).join("") + "</select></div>" +
      "<div class='form-row'><label class='field-label inline'>Requested by</label><input class='input' id='coBy' value='" + esc(co.requestedBy) + "'></div>" +
      "<div class='form-row'><label class='field-label inline'>Δ Budget ($)</label><input class='input' type='number' id='coBudget' value='" + (co.budgetDelta || 0) + "'" + (fin ? "" : " disabled") + "></div>" +
      "<div class='form-row'><label class='field-label inline'>Δ Schedule (days)</label><input class='input' type='number' id='coDays' value='" + (co.scheduleDeltaDays || 0) + "'></div>" +
      "<div class='form-row'><label class='field-label inline'>Status</label><select class='select' id='coStatus'>" + statusOpts.map(function (s) { return "<option" + (s === co.status ? " selected" : "") + ">" + s + "</option>"; }).join("") + "</select></div>" +
      "<div class='form-row'><label class='field-label inline'>Decision notes</label><input class='input' id='coNotes' value='" + esc(co.notes || "") + "'></div>" +
      "</div>";

    // Additional scope items (cards created on approval)
    var scopeWrap = el("div", { class: "mt" });
    scopeWrap.innerHTML = "<label class='field-label inline'>Additional scope (cards created on approval)</label>";
    var scopeList = el("div", { id: "coScope" });
    (co.scopeItems || []).forEach(function (it) { scopeList.appendChild(scopeRow(it)); });
    scopeWrap.appendChild(scopeList);
    var addScope = el("button", { class: "btn sm mt", type: "button" }, "+ Add scope item");
    addScope.addEventListener("click", function () { scopeList.appendChild(scopeRow({ title: "", estimate: 0 })); });
    scopeWrap.appendChild(addScope);
    body.appendChild(scopeWrap);

    var fileWrap = el("div", { class: "mt" });
    fileWrap.innerHTML = "<label class='field-label inline'>Change order files</label>";
    var fileList = el("div", { class: "co-file-list" });
    function renderCoFiles() {
      fileList.innerHTML = "";
      if (!(co.attachments || []).length) {
        fileList.appendChild(el("div", { class: "empty panel-pad" }, "No change order files uploaded."));
        return;
      }
      var tbl = el("table", { class: "table table-dense" });
      tbl.innerHTML = "<thead><tr><th>File</th><th>Revision</th><th>Uploaded</th><th class='num'>Size</th><th></th></tr></thead>";
      var tb = el("tbody");
      (co.attachments || []).forEach(function (f) {
        var tr = el("tr");
        tr.innerHTML = "<td><strong>" + esc(f.name) + "</strong><div class='muted'>" + esc(f.type || "") + "</div></td><td>" + esc(f.revision || "-") + "</td><td class='muted'>" + esc((f.uploadedAt || "").slice(0, 10)) + "</td><td class='num'>" + Math.round((f.size || 0) / 1024) + " KB</td><td class='right'></td>";
        if (f.dataUrl) {
          var open = el("a", { class: "btn sm", href: f.dataUrl, download: f.name }, "Download");
          tr.querySelector("td.right").appendChild(open);
        }
        var del = el("button", { class: "btn sm danger", type: "button" }, "Delete");
        del.addEventListener("click", function () { co.attachments = (co.attachments || []).filter(function (x) { return x.id !== f.id; }); renderCoFiles(); });
        tr.querySelector("td.right").appendChild(del);
        tb.appendChild(tr);
      });
      tbl.appendChild(tb);
      fileList.appendChild(tbl);
    }
    fileWrap.appendChild(fileList);
    var addFile = el("button", { class: "btn sm mt", type: "button" }, "Upload change order file");
    addFile.addEventListener("click", function () {
      var input = el("input", { type: "file", multiple: "multiple" });
      input.addEventListener("change", function () {
        [].slice.call(input.files || []).forEach(function (file) {
          var reader = new FileReader();
          reader.onload = function () { addChangeOrderAttachment(co, { name: file.name, type: file.type, size: file.size, dataUrl: reader.result }); renderCoFiles(); };
          reader.readAsDataURL(file);
        });
      });
      input.click();
    });
    fileWrap.appendChild(addFile);
    renderCoFiles();
    body.appendChild(fileWrap);
    if (co.applied) body.appendChild(el("div", { class: "warn-banner mt" }, "This change order is approved and applied to the project baseline (" + (co.createdCardIds || []).length + " scope card(s) created). Changing it to a non-approved status will reverse the budget, schedule, and scope impact."));

    var foot = [];
    if (!isNew) foot.push({ label: "Delete", cls: "btn danger", side: "left", fn: function () {
      closeModal();
      confirmModal("Delete change order " + co.number + "?", co.applied ? "It is applied; its baseline and scope impact will be reversed first." : "This removes the request.", function () {
        mutate(function () { if (co.applied) revertChangeOrder(co); state.changeOrders = state.changeOrders.filter(function (x) { return x.id !== co.id; }); });
        toast("Change order deleted");
      });
    } });
    foot.push({ label: "Cancel", cls: "btn", fn: closeModal });
    foot.push({ label: isNew ? "Raise change order" : "Save", cls: "btn primary", fn: function () {
      var title = $("#coTitle").value.trim();
      if (!title) { toast("Title is required", "err"); return; }
      var newStatus = $("#coStatus").value;
      var scopeItems = [].slice.call(scopeList.querySelectorAll(".scope-row")).map(function (rowEl) {
        return { title: rowEl.querySelector(".scope-title").value.trim(), estimate: parseFloat(rowEl.querySelector(".scope-est").value) || 0 };
      }).filter(function (x) { return x.title; });
      mutate(function () {
        co.number = $("#coNum").value.trim() || co.number;
        co.projectId = $("#coProject").value;
        co.title = title;
        co.description = $("#coDesc").value;
        co.category = $("#coCat").value;
        co.requestedBy = $("#coBy").value;
        if (fin) co.budgetDelta = parseFloat($("#coBudget").value) || 0;
        co.scheduleDeltaDays = parseFloat($("#coDays").value) || 0;
        co.notes = $("#coNotes").value;
        // Scope items can only change while not yet applied.
        if (!co.applied) co.scopeItems = scopeItems;
        var becomingApproved = coApprovedStatus(newStatus) && !coApproved(co);
        co.status = newStatus;
        if (becomingApproved) { co.decidedDate = todayISO(); co.decidedBy = (currentUser() || {}).displayName || ""; }
        if (co._new) { delete co._new; state.changeOrders.push(co); recordAudit("Change", co.id, "Change order raised", co.number + " " + co.title); }
        else recordAudit("Change", co.id, "Change order saved", co.number + " " + co.title);
        reconcileChangeOrder(co); // applies or reverses baseline impact to match status
      });
      closeModal();
      toast(isNew ? "Change order raised" : "Change order saved", "ok");
    } });
    modal((isNew ? "New change order" : co.number) + " · integrated change control", body, foot);
    setTimeout(function () { var t = $("#coTitle"); if (t) t.focus(); }, 30);
  }
  function coApprovedStatus(s) { return s === "Approved" || s === "Implemented"; }
  function scopeRow(it) {
    var row = el("div", { class: "scope-row flex", style: "gap:8px;margin-top:6px" });
    var t = el("input", { class: "input scope-title", placeholder: "Scope task" }); t.value = it.title || "";
    var e = el("input", { class: "input scope-est", type: "number", placeholder: "hrs", style: "max-width:90px" }); e.value = it.estimate || 0;
    var del = el("button", { class: "btn sm ghost", type: "button" }, "✕");
    del.addEventListener("click", function () { row.remove(); });
    row.appendChild(t); row.appendChild(e); row.appendChild(del);
    return row;
  }

  /* ---------- Critical path (longest dependency chain by duration) ---------- */
  function criticalPath(cards) {
    var byId = {};
    cards.forEach(function (c) { byId[c.id] = c; });
    function dur(c) { return Math.max(1, c.estimateHours || 8) / 8; } // workdays
    var memo = {};
    var stack = {};
    function longest(id) {
      if (memo[id] != null) return memo[id];
      if (stack[id]) return 0; // guard against cycles
      stack[id] = true;
      var c = byId[id];
      var best = 0;
      (c && c.deps || []).forEach(function (dep) { if (byId[dep]) best = Math.max(best, longest(dep)); });
      stack[id] = false;
      return (memo[id] = best + dur(c));
    }
    var maxLen = 0, endId = null;
    cards.forEach(function (c) { var l = longest(c.id); if (l > maxLen) { maxLen = l; endId = c.id; } });
    // Walk back along the max-length predecessor chain.
    var path = {};
    var cur = endId;
    while (cur) {
      path[cur] = true;
      var c = byId[cur];
      var next = null, nv = -1;
      (c && c.deps || []).forEach(function (dep) { if (byId[dep] && memo[dep] > nv) { nv = memo[dep]; next = dep; } });
      cur = next;
    }
    return { set: path, lengthDays: Math.round(maxLen) };
  }

  /* ---------- Gantt & Critical Path ---------- */
  // Print the current view to PDF. Landscape is injected only for the duration of
  // the print (wide timelines like the Gantt) and reverted afterward so report
  // prints stay portrait.
  function printView(landscape) {
    if (!landscape) { window.print(); return; }
    var prior = document.getElementById("print-orientation");
    if (prior) prior.remove();
    var style = document.createElement("style");
    style.id = "print-orientation";
    style.textContent = "@media print { @page { size: landscape; margin: 10mm; } }";
    document.head.appendChild(style);
    var cleanup = function () { var s = document.getElementById("print-orientation"); if (s) s.remove(); window.removeEventListener("afterprint", cleanup); };
    window.addEventListener("afterprint", cleanup);
    setTimeout(function () { window.print(); }, 30);
  }
  VIEWS.gantt = function (root) {
    var b = activeBoard();
    var head = pageHead("Gantt & Critical Path — " + b.name, "Scheduled work by date. Drag a bar to reschedule start and finish dates; the critical path is highlighted.");
    var printBtn = el("button", { class: "btn primary sm no-print" }, "🖨 Print / PDF");
    printBtn.addEventListener("click", function () { printView(true); });
    (head.querySelector(".head-actions") || head).appendChild(printBtn);
    root.appendChild(head);
    var cards = boardCards(b.id).filter(function (c) { return c.due || c.startDate; });
    if (!cards.length) { root.appendChild(el("div", { class: "panel panel-pad empty" }, "No dated work on this board yet. Add start/due dates to cards to see the timeline.")); return; }

    // Determine date span.
    var dates = [];
    cards.forEach(function (c) { if (c.startDate) dates.push(parseDate(c.startDate)); if (c.due) dates.push(parseDate(c.due)); });
    var min = new Date(Math.min.apply(null, dates)), max = new Date(Math.max.apply(null, dates));
    min.setDate(min.getDate() - 2); max.setDate(max.getDate() + 2);
    var span = Math.max(1, (max - min) / 86400000);
    var cp = criticalPath(boardCards(b.id));

    var legend = el("div", { class: "flex wrap mb", style: "gap:14px;font-size:12px" });
    legend.innerHTML = "<span class='flex'><span class='gantt-swatch cp'></span> Critical path (" + cp.lengthDays + " workdays)</span>" +
      "<span class='flex'><span class='gantt-swatch'></span> Scheduled work</span>" +
      "<span class='flex'><span class='gantt-swatch ms'></span> Milestone</span>" +
      "<span class='flex'><span class='gantt-swatch late'></span> Overdue</span>" +
      (canEdit() ? "<span class='faint'>Drag bars to shift dates</span>" : "");
    root.appendChild(legend);

    var panel = el("div", { class: "panel", style: "overflow-x:auto" });
    var chart = el("div", { class: "gantt" });
    // Month gridlines header
    var header = el("div", { class: "gantt-row gantt-head" });
    header.appendChild(el("div", { class: "gantt-label" }, "Task"));
    var track = el("div", { class: "gantt-track" });
    var cursor = new Date(min);
    while (cursor <= max) {
      var leftPct = ((cursor - min) / 86400000 / span) * 100;
      track.appendChild(el("div", { class: "gantt-grid", style: "left:" + leftPct + "%" },
        "<span>" + cursor.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + "</span>"));
      cursor.setDate(cursor.getDate() + 7);
    }
    header.appendChild(track);
    chart.appendChild(header);

    cards.sort(function (a, c) { return (a.startDate || a.due || "").localeCompare(c.startDate || c.due || ""); });
    cards.forEach(function (c) {
      var s = parseDate(cardStart(c));
      var e = parseDate(cardFinish(c));
      if (e < s) { var t = s; s = e; e = t; }
      var leftPct = ((s - min) / 86400000 / span) * 100;
      var widthPct = Math.max(1.5, ((e - s) / 86400000 / span) * 100);
      var onCP = cp.set[c.id];
      var overdue = daysUntil(c.due) != null && daysUntil(c.due) < 0 && !isDone(c);
      var r = resourceById(c.assigneeId);
      var duration = cardDurationDays(c);
      var row = el("div", { class: "gantt-row" });
      row.appendChild(el("div", { class: "gantt-label", title: c.title },
        "<button class='linklike' data-open-card='" + c.id + "'>" + (c.milestone ? "◆ " : "") + esc(c.title) + "</button>" +
        "<div class='faint' style='font-size:11px'>" + (r ? esc(r.name) : "Unassigned") + " · " + fmtDate(cardStart(c)) + " to " + fmtDate(cardFinish(c)) + " · " + (duration || 1) + "d</div>"));
      var rtrack = el("div", { class: "gantt-track" });
      var barCls = "gantt-bar" + (onCP ? " cp" : "") + (c.milestone ? " ms" : "") + (overdue ? " late" : "");
      var bar = el("div", { class: barCls, style: "left:" + leftPct + "%;width:" + widthPct + "%", title: fmtDate(cardStart(c)) + " to " + fmtDate(cardFinish(c)) + " · drag to reschedule" });
      bar.innerHTML = "<span class='gantt-fill' style='width:" + (c.progress || 0) + "%'></span><span class='gantt-bar-label'>" + (c.progress || 0) + "%</span>";
      bindGanttDrag(bar, rtrack, c, span);
      rtrack.appendChild(bar);
      row.appendChild(rtrack);
      chart.appendChild(row);
    });
    panel.appendChild(chart);
    root.appendChild(panel);
  };

  function bindGanttDrag(bar, track, c, spanDays) {
    if (!canEdit()) return;
    bar.classList.add("draggable");
    var startX = 0, trackW = 1, deltaDays = 0, moved = false, startISO = null, finishISO = null;
    function onMove(e) {
      var dx = e.clientX - startX;
      deltaDays = Math.round(dx / trackW * spanDays);
      moved = moved || Math.abs(dx) > 4;
      bar.style.transform = "translateX(" + dx + "px)";
      bar.dataset.shift = (deltaDays >= 0 ? "+" : "") + deltaDays + "d";
    }
    function onUp() {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      bar.classList.remove("dragging");
      bar.style.transform = "";
      delete bar.dataset.shift;
      if (!moved || deltaDays === 0) return;
      mutate(function () { rescheduleCard(c.id, deltaDays); });
      toast("Rescheduled " + c.title, "ok");
    }
    bar.addEventListener("pointerdown", function (e) {
      if (e.button !== 0) return;
      startISO = cardStart(c);
      finishISO = cardFinish(c);
      if (!startISO && !finishISO) return;
      if (!startISO) startISO = finishISO;
      if (!finishISO) finishISO = startISO;
      startX = e.clientX;
      trackW = Math.max(1, track.getBoundingClientRect().width);
      deltaDays = 0;
      moved = false;
      bar.classList.add("dragging");
      e.preventDefault();
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    });
  }

  /* ---------- Risk Register (PMBOK) ---------- */
  VIEWS.risks = function (root) {
    var head = pageHead("Risk Register", "Qualitative risk analysis (probability × impact), response strategy, and ownership.");
    var expBtn = el("button", { class: "btn sm" }, "⬇ Export register");
    expBtn.addEventListener("click", function () { exportRiskRegisterCSV(null); });
    head.querySelector(".head-actions").appendChild(expBtn);
    if (canGovernRegisters()) {
      var addBtn = el("button", { class: "btn primary sm" }, "+ Add risk");
      addBtn.addEventListener("click", function () { openRiskEditor(null); });
      head.querySelector(".head-actions").appendChild(addBtn);
    }
    root.appendChild(head);

    var risks = state.risks || [];
    var open = risks.filter(function (r) { return r.status !== "Closed"; });
    var high = risks.filter(function (r) { return r.probability * r.impact >= 12 && r.status !== "Closed"; });
    var stats = el("div", { class: "grid cols-4" });
    stats.appendChild(statCard("Total risks", risks.length, open.length + " open"));
    stats.appendChild(statCard("High exposure", high.length, "score ≥ 12", high.length ? "danger" : "ok"));
    stats.appendChild(statCard("Mitigating", risks.filter(function (r) { return r.status === "Mitigating"; }).length, "active responses", "warn"));
    stats.appendChild(statCard("Closed", risks.filter(function (r) { return r.status === "Closed"; }).length, "retired"));
    root.appendChild(stats);

    var two = el("div", { class: "grid cols-2 mt" });
    var matrixPanel = el("div", { class: "panel panel-pad" });
    matrixPanel.appendChild(el("h2", null, "Probability × Impact matrix"));
    matrixPanel.appendChild(riskMatrix(risks));
    two.appendChild(matrixPanel);

    var byCat = {};
    risks.forEach(function (r) { byCat[r.category] = (byCat[r.category] || 0) + 1; });
    var catPanel = el("div", { class: "panel panel-pad" });
    catPanel.appendChild(el("h2", null, "Response strategy mix (PMBOK)"));
    var respCount = {};
    RISK_RESPONSES.forEach(function (rs) { respCount[rs] = risks.filter(function (r) { return r.response === rs && r.status !== "Closed"; }).length; });
    var maxResp = Math.max(1, Math.max.apply(null, RISK_RESPONSES.map(function (rs) { return respCount[rs]; })));
    RISK_RESPONSES.forEach(function (rs) {
      catPanel.appendChild(el("div", { class: "flex mt", style: "gap:10px" },
        "<span style='width:80px' class='muted'>" + rs + "</span><div class='bar' style='flex:1'><span class='ok' style='width:" + (respCount[rs] / maxResp * 100) + "%'></span></div><span class='muted'>" + respCount[rs] + "</span>"));
    });
    two.appendChild(catPanel);
    root.appendChild(two);

    var panel = el("div", { class: "panel mt" });
    var tbl = el("table", { class: "table" });
    tbl.innerHTML = "<thead><tr><th>Risk</th><th>Type</th><th>Project</th><th>Category</th><th class='num'>P</th><th class='num'>I</th><th class='num'>Score</th><th>Response</th><th class='num'>Residual</th><th>Owner</th><th>Status</th></tr></thead>";
    var tb = el("tbody");
    risks.slice().sort(function (a, c) { return riskScore(c) - riskScore(a); }).forEach(function (rk) {
      var score = riskScore(rk), res = riskResidualScore(rk);
      var p = projectById(rk.projectId);
      var owner = resourceById(rk.ownerId);
      var tr = el("tr", { style: "cursor:pointer" });
      tr.innerHTML =
        "<td><strong>" + esc(rk.title) + "</strong></td>" +
        "<td><span class='badge " + (rk.riskType === "Opportunity" ? "ok" : "neutral") + "'>" + esc(rk.riskType || "Threat") + "</span></td>" +
        "<td class='muted'>" + (p ? esc(p.name) : "—") + "</td>" +
        "<td><span class='chip label'>" + esc(rk.category) + "</span></td>" +
        "<td class='num'>" + rk.probability + "</td><td class='num'>" + rk.impact + "</td>" +
        "<td class='num'><span class='badge " + riskSevClass(score) + "'>" + score + "</span></td>" +
        "<td>" + esc(rk.response) + "</td>" +
        "<td class='num'><span class='badge " + riskSevClass(res) + "'>" + res + "</span></td>" +
        "<td class='muted'>" + (owner ? esc(owner.name) : "—") + "</td>" +
        "<td><span class='badge " + (rk.status === "Closed" ? "ok" : rk.status === "Mitigating" ? "warn" : "neutral") + "'>" + esc(rk.status) + "</span></td>";
      if (canGovernRegisters()) tr.addEventListener("click", function () { openRiskEditor(rk.id); });
      tb.appendChild(tr);
    });
    if (!risks.length) tb.appendChild(el("tr", null, "<td colspan='11' class='empty'>No risks logged. Add the first risk to start the register.</td>"));
    tbl.appendChild(tb);
    panel.appendChild(tbl);
    root.appendChild(panel);
  };

  function riskMatrix(risks) {
    var counts = {};
    risks.filter(function (r) { return r.status !== "Closed"; }).forEach(function (r) {
      var k = r.probability + "x" + r.impact;
      counts[k] = (counts[k] || 0) + 1;
    });
    var wrap = el("div", { class: "risk-matrix" });
    // Header row (impact axis)
    var head = el("div", { class: "rm-row" });
    head.appendChild(el("div", { class: "rm-cell rm-axis" }, "P＼I"));
    for (var i = 1; i <= 5; i++) head.appendChild(el("div", { class: "rm-cell rm-axis" }, String(i)));
    wrap.appendChild(head);
    for (var p = 5; p >= 1; p--) {
      var row = el("div", { class: "rm-row" });
      row.appendChild(el("div", { class: "rm-cell rm-axis" }, String(p)));
      for (var im = 1; im <= 5; im++) {
        var score = p * im;
        var sev = score >= 15 ? "danger" : score >= 8 ? "warn" : "ok";
        var n = counts[p + "x" + im] || 0;
        row.appendChild(el("div", { class: "rm-cell rm-" + sev + (n ? " has" : ""), title: "P" + p + " × I" + im + " = " + score }, n ? String(n) : ""));
      }
      wrap.appendChild(row);
    }
    return wrap;
  }

  function openRiskEditor(riskId, presetProjectId) {
    if (!canGovernRegisters()) { toast("The risk register is read-only for your role", "err"); return; }
    var rk = riskId ? (state.risks.filter(function (r) { return r.id === riskId; })[0]) : normalizeRisk({
      id: uid("rk"), projectId: presetProjectId || (state.projects[0] ? state.projects[0].id : null), title: "", riskType: "Threat", category: "Technical",
      probability: 3, impact: 3, residualProbability: 2, residualImpact: 2, response: "Mitigate", ownerId: null, status: "Open",
      trigger: "", notes: "", dateIdentified: todayISO(), lastReviewed: todayISO(), dueDate: "", costImpact: 0, scheduleImpactDays: 0, _new: true,
    });
    var scaleOpts = function (sel) { return RISK_SCALE.map(function (s) { return "<option value='" + s.v + "'" + (s.v === sel ? " selected" : "") + ">" + s.v + " · " + s.label + "</option>"; }).join(""); };
    var respOpts = function (type, sel) { return riskResponsesFor(type).map(function (c) { return "<option" + (c === sel ? " selected" : "") + ">" + c + "</option>"; }).join(""); };
    var body = el("div");
    body.innerHTML =
      "<div class='form-grid'>" +
      "<div class='form-row full'><label class='field-label inline'>Risk statement (cause → risk → effect)</label><input class='input' id='rkTitle' value='" + esc(rk.title) + "' placeholder='Because … there is a risk that … which would …'></div>" +
      "<div class='form-row'><label class='field-label inline'>Project</label><select class='select' id='rkProject'><option value=''>Portfolio-level</option>" + state.projects.map(function (p) { return "<option value='" + p.id + "'" + (p.id === rk.projectId ? " selected" : "") + ">" + esc(p.name) + "</option>"; }).join("") + "</select></div>" +
      "<div class='form-row'><label class='field-label inline'>Type</label><select class='select' id='rkType'>" + RISK_TYPES.map(function (t) { return "<option" + (t === rk.riskType ? " selected" : "") + ">" + t + "</option>"; }).join("") + "</select></div>" +
      "<div class='form-row'><label class='field-label inline'>Category</label><select class='select' id='rkCategory'>" + RISK_CATEGORIES.map(function (c) { return "<option" + (c === rk.category ? " selected" : "") + ">" + c + "</option>"; }).join("") + "</select></div>" +
      "<div class='form-row'><label class='field-label inline'>Owner</label><select class='select' id='rkOwner'><option value=''>Unassigned</option>" + state.resources.map(function (r) { return "<option value='" + r.id + "'" + (r.id === rk.ownerId ? " selected" : "") + ">" + esc(r.name) + "</option>"; }).join("") + "</select></div>" +
      "<div class='form-row'><label class='field-label inline'>Inherent probability</label><select class='select' id='rkProb'>" + scaleOpts(rk.probability) + "</select></div>" +
      "<div class='form-row'><label class='field-label inline'>Inherent impact</label><select class='select' id='rkImpact'>" + scaleOpts(rk.impact) + "</select></div>" +
      "<div class='form-row'><label class='field-label inline'>Response strategy (PMBOK)</label><select class='select' id='rkResponse'>" + respOpts(rk.riskType, rk.response) + "</select></div>" +
      "<div class='form-row'><label class='field-label inline'>Residual probability</label><select class='select' id='rkResProb'>" + scaleOpts(rk.residualProbability) + "</select></div>" +
      "<div class='form-row'><label class='field-label inline'>Residual impact</label><select class='select' id='rkResImpact'>" + scaleOpts(rk.residualImpact) + "</select></div>" +
      "<div class='form-row'><label class='field-label inline'>Status</label><select class='select' id='rkStatus'>" + RISK_STATUS.map(function (c) { return "<option" + (c === rk.status ? " selected" : "") + ">" + c + "</option>"; }).join("") + "</select></div>" +
      "<div class='form-row'><label class='field-label inline'>Cost impact ($)</label><input class='input' type='number' min='0' step='100' id='rkCost' value='" + (rk.costImpact || 0) + "'></div>" +
      "<div class='form-row'><label class='field-label inline'>Schedule impact (days)</label><input class='input' type='number' min='0' step='1' id='rkSched' value='" + (rk.scheduleImpactDays || 0) + "'></div>" +
      "<div class='form-row'><label class='field-label inline'>Date identified</label><input class='input' type='date' id='rkIdent' value='" + esc(rk.dateIdentified || "") + "'></div>" +
      "<div class='form-row'><label class='field-label inline'>Last reviewed</label><input class='input' type='date' id='rkReview' value='" + esc(rk.lastReviewed || "") + "'></div>" +
      "<div class='form-row'><label class='field-label inline'>Response due</label><input class='input' type='date' id='rkDue' value='" + esc(rk.dueDate || "") + "'></div>" +
      "<div class='form-row full'><label class='field-label inline'>Trigger / early-warning indicator</label><input class='input' id='rkTrigger' value='" + esc(rk.trigger) + "' placeholder='Observable condition that signals the risk is materializing'></div>" +
      "<div class='form-row full'><label class='field-label inline'>Response plan / notes</label><textarea class='textarea' id='rkNotes'>" + esc(rk.notes) + "</textarea></div>" +
      "</div>";
    // Response strategies depend on threat vs opportunity.
    body.querySelector("#rkType").addEventListener("change", function () {
      var sel = body.querySelector("#rkResponse");
      var cur = sel.value;
      sel.innerHTML = respOpts(this.value, riskResponsesFor(this.value).indexOf(cur) !== -1 ? cur : null);
    });
    var foot = [];
    if (!rk._new) foot.push({ label: "Delete", cls: "btn danger", side: "left", fn: function () {
      closeModal();
      confirmModal("Delete risk?", "This removes it from the register. You can undo.", function () {
        mutate(function () { state.risks = state.risks.filter(function (r) { return r.id !== rk.id; }); recordAudit("Risk", rk.id, "Risk deleted", rk.title); });
        toast("Risk deleted");
      });
    } });
    foot.push({ label: "Cancel", cls: "btn", fn: closeModal });
    foot.push({ label: rk._new ? "Add risk" : "Save", cls: "btn primary", fn: function () {
      var title = $("#rkTitle").value.trim();
      if (!title) { toast("Risk statement is required", "err"); return; }
      var wasNew = !!rk._new;
      mutate(function () {
        rk.title = title;
        rk.projectId = $("#rkProject").value || null;
        rk.riskType = $("#rkType").value;
        rk.category = $("#rkCategory").value;
        rk.probability = parseInt($("#rkProb").value, 10);
        rk.impact = parseInt($("#rkImpact").value, 10);
        rk.residualProbability = parseInt($("#rkResProb").value, 10);
        rk.residualImpact = parseInt($("#rkResImpact").value, 10);
        rk.response = $("#rkResponse").value;
        rk.status = $("#rkStatus").value;
        rk.ownerId = $("#rkOwner").value || null;
        rk.costImpact = parseFloat($("#rkCost").value) || 0;
        rk.scheduleImpactDays = parseFloat($("#rkSched").value) || 0;
        rk.dateIdentified = $("#rkIdent").value;
        rk.lastReviewed = $("#rkReview").value;
        rk.dueDate = $("#rkDue").value;
        rk.trigger = $("#rkTrigger").value;
        rk.notes = $("#rkNotes").value;
        normalizeRisk(rk);
        if (wasNew) { delete rk._new; state.risks.push(rk); }
        recordAudit("Risk", rk.id, wasNew ? "Risk added" : "Risk saved", rk.title);
      });
      closeModal();
      toast(wasNew ? "Risk added" : "Risk saved", "ok");
    } });
    modal(rk._new ? "New risk" : "Edit risk", body, foot);
    setTimeout(function () { var t = $("#rkTitle"); if (t) t.focus(); }, 30);
  }

  /* ----------------------------------------------------------------------- *
   * Inline SVG chart library (zero-dependency, theme-aware, print-accurate)
   * Gives report consumers an immediate visual snapshot of status.
   * ----------------------------------------------------------------------- */
  var CHART = { brand: "#0f766e", navy: "#1e3a5f", teal: "#14b8a6", amber: "#d97706", red: "#dc2626", green: "#16a34a", blue: "#2563eb", violet: "#7c3aed", slate: "#64748b", track: "var(--surface-3)", grid: "var(--border)" };
  function niceMax(v) { if (!(v > 0)) return 1; var p = Math.pow(10, Math.floor(Math.log10(v))); var f = v / p; var n = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10; return n * p; }
  function trimLabel(s, n) { s = String(s == null ? "" : s); n = n || 12; return s.length > n ? s.slice(0, n - 1) + "…" : s; }
  function moneyShort(v) { v = v || 0; var a = Math.abs(v); var sign = v < 0 ? "-" : ""; if (a >= 1e6) return sign + "$" + (a / 1e6).toFixed(a >= 1e7 ? 0 : 1) + "M"; if (a >= 1e3) return sign + "$" + Math.round(a / 1e3) + "k"; return sign + "$" + Math.round(a); }
  function chartCard(title, cap, inner) {
    return "<div class='chart-card'><h3>" + esc(title) + "</h3>" + (cap ? "<div class='chart-cap'>" + esc(cap) + "</div>" : "") + inner + "</div>";
  }
  function svgDonut(pct, opts) {
    opts = opts || {}; pct = clamp(pct, 0, 100);
    var size = 132, sw = 15, r = (size - sw) / 2, c = size / 2, circ = 2 * Math.PI * r, dash = circ * pct / 100;
    var color = opts.color || CHART.brand;
    return "<div class='chart-wrap'><svg class='chart-svg chart-radial' viewBox='0 0 " + size + " " + size + "' width='180' height='180' role='img' aria-label='" + esc((opts.label || "") + " " + Math.round(pct) + "%") + "'>" +
      "<circle cx='" + c + "' cy='" + c + "' r='" + r + "' fill='none' stroke='" + CHART.track + "' stroke-width='" + sw + "'/>" +
      "<circle cx='" + c + "' cy='" + c + "' r='" + r + "' fill='none' stroke='" + color + "' stroke-width='" + sw + "' stroke-linecap='round' stroke-dasharray='" + dash.toFixed(1) + " " + circ.toFixed(1) + "' transform='rotate(-90 " + c + " " + c + ")'/>" +
      "<text x='" + c + "' y='" + (c - 1) + "' text-anchor='middle' class='chart-num'>" + (opts.center != null ? esc(opts.center) : Math.round(pct) + "%") + "</text>" +
      (opts.sub ? "<text x='" + c + "' y='" + (c + 16) + "' text-anchor='middle' class='chart-sub'>" + esc(opts.sub) + "</text>" : "") +
      "</svg></div>";
  }
  function svgPie(segments, opts) {
    opts = opts || {};
    segments = segments.filter(function (s) { return s.value > 0; });
    var total = segments.reduce(function (a, s) { return a + s.value; }, 0) || 1;
    var size = 132, sw = 22, r = (size - sw) / 2, c = size / 2, circ = 2 * Math.PI * r, angle = -90;
    var svg = "<svg class='chart-svg chart-radial' viewBox='0 0 " + size + " " + size + "' width='180' height='180' role='img'>";
    if (!segments.length) svg += "<circle cx='" + c + "' cy='" + c + "' r='" + r + "' fill='none' stroke='" + CHART.track + "' stroke-width='" + sw + "'/>";
    segments.forEach(function (s) {
      var frac = s.value / total, dash = circ * frac;
      svg += "<circle cx='" + c + "' cy='" + c + "' r='" + r + "' fill='none' stroke='" + s.color + "' stroke-width='" + sw + "' stroke-dasharray='" + dash.toFixed(1) + " " + (circ - dash).toFixed(1) + "' transform='rotate(" + angle.toFixed(2) + " " + c + " " + c + ")'><title>" + esc(s.label + ": " + s.value) + "</title></circle>";
      angle += frac * 360;
    });
    svg += "<text x='" + c + "' y='" + (c - 1) + "' text-anchor='middle' class='chart-num'>" + (opts.center != null ? esc(opts.center) : Math.round(total)) + "</text>" +
      (opts.sub ? "<text x='" + c + "' y='" + (c + 16) + "' text-anchor='middle' class='chart-sub'>" + esc(opts.sub) + "</text>" : "") + "</svg>";
    var legend = segments.map(function (s) { return "<span class='chart-leg'><span class='chart-dot' style='background:" + s.color + "'></span>" + esc(s.label) + " (" + s.value + ")</span>"; }).join("");
    return "<div class='chart-wrap'>" + svg + "<div class='chart-legend'>" + legend + "</div></div>";
  }
  function svgGauge(value, opts) {
    opts = opts || {};
    var min = opts.min != null ? opts.min : 0.5, max = opts.max != null ? opts.max : 1.5;
    var frac = clamp((value - min) / (max - min), 0, 1);
    var W = 168, H = 104, cx = 84, cy = 88, r = 66;
    function pt(f) { var a = Math.PI * (1 - f); return [cx + r * Math.cos(a), cy - r * Math.sin(a)]; }
    function arc(f0, f1, color) { var p0 = pt(f0), p1 = pt(f1), large = (f1 - f0) > 0.5 ? 1 : 0; return "<path d='M " + p0[0].toFixed(1) + " " + p0[1].toFixed(1) + " A " + r + " " + r + " 0 " + large + " 1 " + p1[0].toFixed(1) + " " + p1[1].toFixed(1) + "' fill='none' stroke='" + color + "' stroke-width='13' stroke-linecap='round'/>"; }
    var f9 = clamp((0.9 - min) / (max - min), 0, 1), f10 = clamp((1 - min) / (max - min), 0, 1);
    var needle = pt(frac), color = value >= 1 ? CHART.green : value >= 0.9 ? CHART.amber : CHART.red;
    return "<div class='chart-wrap'><svg class='chart-svg' viewBox='0 0 " + W + " " + H + "' width='100%' role='img' aria-label='" + esc((opts.label || "") + " " + num2(value)) + "'>" +
      arc(0, f9, CHART.red) + arc(f9, f10, CHART.amber) + arc(f10, 1, CHART.green) +
      "<line x1='" + cx + "' y1='" + cy + "' x2='" + needle[0].toFixed(1) + "' y2='" + needle[1].toFixed(1) + "' stroke='" + CHART.navy + "' stroke-width='3'/>" +
      "<circle cx='" + cx + "' cy='" + cy + "' r='4.5' fill='" + CHART.navy + "'/>" +
      "<text x='" + cx + "' y='" + (cy - 16) + "' text-anchor='middle' class='chart-num' style='fill:" + color + "'>" + num2(value) + "</text>" +
      "<text x='" + cx + "' y='" + (H - 2) + "' text-anchor='middle' class='chart-sub'>" + esc(opts.sub || "target ≥ 1.00") + "</text>" +
      "</svg></div>";
  }
  function svgGroupedBars(cats, series, opts) {
    opts = opts || {};
    var W = 540, H = 250, padL = 52, padR = 12, padT = 14, padB = 58;
    var plotW = W - padL - padR, plotH = H - padT - padB;
    var max = 0; series.forEach(function (s) { s.values.forEach(function (v) { max = Math.max(max, v || 0); }); }); max = niceMax(max);
    var n = Math.max(1, cats.length), g = Math.max(1, series.length), groupW = plotW / n, barW = Math.min(26, (groupW - 10) / g);
    var fmt = opts.fmt || function (v) { return Math.round(v); };
    var svg = "<svg class='chart-svg' viewBox='0 0 " + W + " " + H + "' width='100%' preserveAspectRatio='xMidYMid meet' role='img'>";
    for (var i = 0; i <= 4; i++) { var y = padT + plotH * i / 4, val = max * (1 - i / 4); svg += "<line x1='" + padL + "' y1='" + y.toFixed(1) + "' x2='" + (W - padR) + "' y2='" + y.toFixed(1) + "' stroke='" + CHART.grid + "'/>" + "<text x='" + (padL - 6) + "' y='" + (y + 3).toFixed(1) + "' text-anchor='end' class='chart-axis'>" + esc(fmt(val)) + "</text>"; }
    cats.forEach(function (cat, ci) {
      var gx = padL + groupW * ci + (groupW - barW * g) / 2;
      series.forEach(function (s, si) { var v = s.values[ci] || 0, h = plotH * (v / max), x = gx + si * barW, y = padT + plotH - h; svg += "<rect x='" + x.toFixed(1) + "' y='" + y.toFixed(1) + "' width='" + (barW - 2).toFixed(1) + "' height='" + Math.max(0, h).toFixed(1) + "' fill='" + s.color + "' rx='2'><title>" + esc(cat + " · " + s.name + ": " + fmt(v)) + "</title></rect>"; });
      svg += "<text x='" + (padL + groupW * ci + groupW / 2).toFixed(1) + "' y='" + (H - padB + 16) + "' text-anchor='middle' class='chart-axis'>" + esc(trimLabel(cat, 12)) + "</text>";
    });
    svg += "</svg>";
    var legend = series.map(function (s) { return "<span class='chart-leg'><span class='chart-dot' style='background:" + s.color + "'></span>" + esc(s.name) + "</span>"; }).join("");
    return "<div class='chart-wrap'>" + svg + "<div class='chart-legend'>" + legend + "</div></div>";
  }
  function svgHBars(rows, opts) {
    opts = opts || {};
    var W = 540, rowH = 28, padL = opts.padL || 132, padR = 60, padT = 8;
    var H = padT * 2 + rows.length * rowH;
    var max = niceMax(Math.max.apply(null, rows.map(function (r) { return r.value || 0; }).concat([1])));
    var svg = "<svg class='chart-svg' viewBox='0 0 " + W + " " + Math.max(H, 40) + "' width='100%' preserveAspectRatio='xMidYMid meet' role='img'>";
    rows.forEach(function (r, i) {
      var y = padT + i * rowH, bw = (W - padL - padR) * ((r.value || 0) / max);
      svg += "<text x='" + (padL - 8) + "' y='" + (y + rowH / 2 + 3) + "' text-anchor='end' class='chart-axis'>" + esc(trimLabel(r.label, 18)) + "</text>" +
        "<rect x='" + padL + "' y='" + (y + 5) + "' width='" + (W - padL - padR) + "' height='" + (rowH - 12) + "' fill='" + CHART.track + "' rx='3'/>" +
        "<rect x='" + padL + "' y='" + (y + 5) + "' width='" + Math.max(2, bw).toFixed(1) + "' height='" + (rowH - 12) + "' fill='" + (r.color || CHART.brand) + "' rx='3'><title>" + esc(r.label + ": " + (r.valueLabel != null ? r.valueLabel : r.value)) + "</title></rect>" +
        "<text x='" + (W - padR + 6) + "' y='" + (y + rowH / 2 + 3) + "' class='chart-axis'>" + esc(r.valueLabel != null ? r.valueLabel : r.value) + "</text>";
    });
    svg += "</svg>";
    return "<div class='chart-wrap'>" + svg + "</div>";
  }
  function scheduleHealthSegments(cards) {
    var overdue = 0, soon = 0, ontrack = 0, done = 0;
    cards.forEach(function (c) { if (isDone(c)) { done++; return; } var d = daysUntil(c.due); if (d != null && d < 0) overdue++; else if (d != null && d <= 7) soon++; else ontrack++; });
    return [
      { label: "Complete", value: done, color: CHART.green },
      { label: "On track", value: ontrack, color: CHART.blue },
      { label: "Due ≤7d", value: soon, color: CHART.amber },
      { label: "Overdue", value: overdue, color: CHART.red },
    ];
  }
  function managerReportCharts() {
    var projects = state.projects;
    var cats = projects.map(function (p) { return p.name; });
    var rollups = projects.map(projectRollup), evms = projects.map(projectEVM);
    var wrap = el("div", { class: "panel panel-pad mt report-charts" });
    var inner = "<h2>Portfolio visual snapshot</h2><div class='chart-cap'>Immediate read on financial position, earned value, and schedule health across the portfolio.</div><div class='chart-grid'>";
    // Financial: budget vs earned vs direct labor
    inner += chartCard("Budget vs earned vs direct labor", "By project ($)", svgGroupedBars(cats, [
      { name: "Budget", color: CHART.navy, values: rollups.map(function (r) { return r.budget; }) },
      { name: "Earned revenue", color: CHART.teal, values: rollups.map(function (r) { return r.earnedRevenue; }) },
      { name: "Direct labor", color: CHART.amber, values: rollups.map(function (r) { return r.spent; }) },
    ], { fmt: moneyShort }));
    // EVM PV/EV/AC
    inner += chartCard("Earned value (PV · EV · AC)", "By project ($)", svgGroupedBars(cats, [
      { name: "PV", color: CHART.slate, values: evms.map(function (v) { return v.pv; }) },
      { name: "EV", color: CHART.brand, values: evms.map(function (v) { return v.ev; }) },
      { name: "AC", color: CHART.red, values: evms.map(function (v) { return v.ac; }) },
    ], { fmt: moneyShort }));
    // Program CPI / SPI gauges
    var pe = programEVM();
    inner += chartCard("Program performance indices", "CPI / SPI (target ≥ 1.00)", "<div class='gauge-row'>" + svgGauge(pe.cpi, { label: "CPI", sub: "CPI · cost" }) + svgGauge(pe.spi, { label: "SPI", sub: "SPI · schedule" }) + "</div>");
    // Schedule health donut
    inner += chartCard("Schedule health", "All work items by status", svgPie(scheduleHealthSegments(state.cards), { sub: "items" }));
    // Portfolio budget burn donut
    var t = portfolioTotals();
    inner += chartCard("Portfolio budget burn", "Committed vs remaining", svgPie([
      { label: "Committed", value: Math.round(t.committed || t.spent), color: CHART.amber },
      { label: "Remaining", value: Math.max(0, Math.round((t.budget || 0) - (t.committed || t.spent))), color: CHART.green },
    ], { center: t.budget ? Math.round((t.committed || t.spent) / t.budget * 100) + "%" : "0%", sub: "burned" }));
    // Progress by project
    inner += chartCard("Progress by project", "Physical % complete", svgHBars(rollups.map(function (r, i) { return { label: projects[i].name, value: r.progress, valueLabel: r.progress + "%", color: r.progress >= 66 ? CHART.green : r.progress >= 33 ? CHART.teal : CHART.amber }; })));
    inner += "</div>";
    wrap.innerHTML = inner;
    return wrap;
  }

  /* ---------- Manager Report ---------- */
  VIEWS.reports = function (root) {
    if (!canFinance()) {
      root.appendChild(pageHead("Manager Report", "Restricted view."));
      root.appendChild(el("div", { class: "warn-banner" }, "The manager report includes financial data and is limited to manager roles. Switch role to a manager to view, or open the Client Report."));
      return;
    }
    var head = pageHead("Manager Report", "Internal portfolio briefing with full financials. " + fmtDateLong(todayISO()) + ".");
    var actions = el("div", { class: "head-actions no-print" });
    var printBtn = el("button", { class: "btn" }, "🖨 Print / PDF");
    printBtn.addEventListener("click", function () { window.print(); });
    var csvBtn = el("button", { class: "btn" }, "⬇ Export CSV");
    csvBtn.addEventListener("click", exportReportCSV);
    var jiraBtn = el("button", { class: "btn" }, "⬇ Jira CSV");
    jiraBtn.addEventListener("click", exportJiraCSV);
    actions.appendChild(printBtn); actions.appendChild(csvBtn); actions.appendChild(jiraBtn);
    head.querySelector(".head-actions") ? head.querySelector(".head-actions").appendChild(actions) : head.appendChild(actions);
    root.appendChild(head);

    var t = portfolioTotals();
    var portfolioMult = portfolioMultiplier(t);
    var stats = el("div", { class: "grid cols-4" });
    stats.appendChild(statCard("Billable value", money(t.revenue), money(t.earnedRevenue) + " earned to date"));
    stats.appendChild(statCard("Billable labor cost", money(t.billableSpent), money(t.spent) + " total logged effort"));
    stats.appendChild(statCard("Contribution margin", pctRatio(t.contributionMargin), fmtMultiplier(portfolioMult) + " earned multiplier", t.contributionMargin != null && t.contributionMargin < 0 ? "danger" : "ok"));
    stats.appendChild(statCard("Overdue", t.overdue, t.dueSoon + " due in 7 days", t.overdue > 0 ? "danger" : "ok"));
    root.appendChild(stats);

    root.appendChild(managerReportCharts());

    var deliveryProjects = state.projects.filter(function (p) { return !isInternalProject(p); });
    var internalProjects = state.projects.filter(isInternalProject);

    var panel = el("div", { class: "panel mt" });
    panel.appendChild(el("div", { class: "panel-pad" }, "<h2>Client delivery financials</h2><p class='muted' style='margin:0;font-size:12px'>Billable, client-facing delivery — measured on earned revenue, contribution margin, and multiplier.</p>"));
    var tbl = el("table", { class: "table" });
    tbl.innerHTML = "<thead><tr><th>Project</th><th>Client</th><th class='num'>Budget</th><th class='num'>Earned Revenue</th><th class='num'>Committed</th><th class='num'>Direct Labor</th><th class='num'>Variance</th><th class='num'>Contribution Margin %</th><th class='num'>Multiplier</th><th class='num'>Budget Burn</th><th class='num'>Progress</th></tr></thead>";
    var tb = el("tbody");
    deliveryProjects.forEach(function (p) {
      var r = projectRollup(p);
      var mult = projectMultiplier(r);
      tb.appendChild(el("tr", null,
        "<td><strong>" + esc(p.name) + "</strong></td>" +
        "<td class='muted'>" + esc(p.client) + "</td>" +
        "<td class='num'>" + money(r.budget) + "</td>" +
        "<td class='num'>" + (p.billable ? money(r.earnedRevenue) : "<span class='muted'>—</span>") + "</td>" +
        "<td class='num'>" + money(r.committed) + "</td>" +
        "<td class='num'>" + money(r.spent) + "</td>" +
        "<td class='num'>" + (r.variance < 0 ? "<span class='badge danger'>" + money(r.variance) + "</span>" : money(r.variance)) + "</td>" +
        "<td class='num'>" + (p.billable ? pctRatio(r.contributionMargin) : "<span class='muted'>—</span>") + "</td>" +
        "<td class='num'>" + (p.billable ? fmtMultiplier(mult) : "<span class='muted'>—</span>") + "</td>" +
        "<td class='num'>" + pct(r.burn * 100) + "</td>" +
        "<td class='num'>" + r.progress + "%</td>"));
    });
    if (!deliveryProjects.length) tb.appendChild(el("tr", null, "<td colspan='11' class='empty'>No client-delivery projects.</td>"));
    var dRoll = deliveryProjects.map(projectRollup);
    var dtot = { budget: 0, earned: 0, committed: 0, spent: 0, cmDollars: 0 };
    dRoll.forEach(function (r) { dtot.budget += r.budget; dtot.earned += r.earnedRevenue; dtot.committed += r.committed; dtot.spent += r.spent; dtot.cmDollars += r.contributionMarginDollars; });
    var dCm = dtot.earned > 0 ? dtot.cmDollars / dtot.earned : null;
    var dMult = dtot.earned > 0 && dtot.spent > 0 ? dtot.earned / dtot.spent : null;
    tb.appendChild(el("tr", { style: "font-weight:700;border-top:2px solid var(--border-strong)" },
      "<td>Total</td><td></td><td class='num'>" + money(dtot.budget) + "</td><td class='num'>" + money(dtot.earned) + "</td><td class='num'>" + money(dtot.committed) + "</td><td class='num'>" + money(dtot.spent) + "</td><td class='num'>" + money(dtot.budget - dtot.committed) + "</td><td class='num'>" + pctRatio(dCm) + "</td><td class='num'>" + fmtMultiplier(dMult) + "</td><td class='num'>" + (dtot.budget ? pct(dtot.spent / dtot.budget * 100) : "0%") + "</td><td></td>"));
    tbl.appendChild(tb);
    panel.appendChild(tbl);
    root.appendChild(panel);

    // Internal / BD performance — non-revenue KPIs (budget adherence, schedule, throughput).
    if (internalProjects.length) {
      var ipanel = el("div", { class: "panel mt" });
      ipanel.appendChild(el("div", { class: "panel-pad" }, "<h2>Internal &amp; business development performance</h2><p class='muted' style='margin:0;font-size:12px'>Non-billable internal and BD/proposal efforts (IT, website, ops, pursuits) are gauged on budget adherence, schedule performance (SPI), and delivery throughput — PMI/PMO practice for overhead work — not revenue or contribution margin.</p>"));
      var itbl = el("table", { class: "table" });
      itbl.innerHTML = "<thead><tr><th>Project</th><th>Category</th><th class='num'>Budget</th><th class='num'>Committed</th><th class='num'>Invested</th><th class='num'>Budget Var</th><th class='num'>CPI</th><th class='num'>SPI</th><th class='num'>On-time</th><th class='num'>Throughput</th><th class='num'>Progress</th></tr></thead>";
      var itb = el("tbody");
      var itot = { budget: 0, committed: 0, invested: 0, done: 0, cards: 0 };
      internalProjects.forEach(function (p) {
        var m = internalProjectMetrics(p);
        itot.budget += m.budget; itot.committed += m.committed; itot.invested += m.invested; itot.done += m.done; itot.cards += m.cards;
        var cpiB = "<span class='badge " + (m.cpi >= 1 ? "ok" : m.cpi >= 0.9 ? "warn" : "danger") + "'>" + num2(m.cpi) + "</span>";
        var spiB = "<span class='badge " + (m.spi >= 1 ? "ok" : m.spi >= 0.9 ? "warn" : "danger") + "'>" + num2(m.spi) + "</span>";
        var bvB = "<span class='badge " + (m.budgetVariance >= 0 ? "ok" : "danger") + "'>" + money(m.budgetVariance) + "</span>";
        var otB = "<span class='badge " + (m.onTimeRate >= 90 ? "ok" : m.onTimeRate >= 75 ? "warn" : "danger") + "'>" + m.onTimeRate + "%</span>";
        itb.appendChild(el("tr", null,
          "<td><strong>" + esc(p.name) + "</strong><div class='muted'>" + esc(p.client) + "</div></td>" +
          "<td><span class='badge neutral'>" + esc(m.class) + "</span></td>" +
          "<td class='num'>" + money(m.budget) + "</td>" +
          "<td class='num'>" + money(m.committed) + "</td>" +
          "<td class='num'>" + money(m.invested) + "</td>" +
          "<td class='num'>" + bvB + "</td>" +
          "<td class='num'>" + cpiB + "</td>" +
          "<td class='num'>" + spiB + "</td>" +
          "<td class='num'>" + otB + "</td>" +
          "<td class='num'>" + m.done + "/" + m.cards + "</td>" +
          "<td class='num'>" + m.progress + "%</td>"));
      });
      itb.appendChild(el("tr", { style: "font-weight:700;border-top:2px solid var(--border-strong)" },
        "<td>Total</td><td></td><td class='num'>" + money(itot.budget) + "</td><td class='num'>" + money(itot.committed) + "</td><td class='num'>" + money(itot.invested) + "</td><td class='num'>" + money(itot.budget - itot.committed) + "</td><td class='num'>—</td><td class='num'>—</td><td class='num'>—</td><td class='num'>" + itot.done + "/" + itot.cards + "</td><td class='num'>" + (itot.cards ? Math.round(itot.done / itot.cards * 100) : 0) + "%</td>"));
      itbl.appendChild(itb);
      ipanel.appendChild(itbl);
      // Visual snapshot for internal work.
      var icats = internalProjects.map(function (p) { return p.name; });
      var im = internalProjects.map(internalProjectMetrics);
      var icharts = "<div class='chart-grid' style='margin-top:14px'>";
      icharts += chartCard("Budget adherence", "Budget vs committed vs invested ($)", svgGroupedBars(icats, [
        { name: "Budget", color: CHART.navy, values: im.map(function (m) { return m.budget; }) },
        { name: "Committed", color: CHART.amber, values: im.map(function (m) { return m.committed; }) },
        { name: "Invested", color: CHART.teal, values: im.map(function (m) { return m.invested; }) },
      ], { fmt: moneyShort }));
      icharts += chartCard("Schedule performance (SPI)", "target ≥ 1.00", svgHBars(im.map(function (m, i) { return { label: internalProjects[i].name, value: Math.round(m.spi * 100) / 100, valueLabel: num2(m.spi), color: m.spi >= 1 ? CHART.green : m.spi >= 0.9 ? CHART.amber : CHART.red }; }), { padL: 150 }));
      icharts += chartCard("Delivery progress", "Physical % complete", svgHBars(im.map(function (m, i) { return { label: internalProjects[i].name, value: m.progress, valueLabel: m.progress + "%", color: m.progress >= 66 ? CHART.green : m.progress >= 33 ? CHART.teal : CHART.amber }; }), { padL: 150 }));
      icharts += "</div>";
      var icwrap = el("div", { class: "panel-pad report-charts" });
      icwrap.innerHTML = icharts;
      ipanel.appendChild(icwrap);
      root.appendChild(ipanel);
    }

    // PMI Earned Value Management
    var evmPanel = el("div", { class: "panel mt" });
    evmPanel.appendChild(el("div", { class: "panel-pad" },
      "<h2>Earned Value Management (PMI / PMBOK)</h2>" +
      "<p class='muted' style='margin:0;font-size:12px'>Cost basis. BAC budget at completion · PV planned value · EV earned value · AC actual cost · CV cost variance · SV ($) schedule variance in earned-value dollars · CPI cost performance index · SPI schedule performance index · EAC estimate at completion.</p>"));
    var et = el("table", { class: "table" });
    et.innerHTML = "<thead><tr><th>Project</th><th class='num'>BAC</th><th class='num'>PV</th><th class='num'>EV</th><th class='num'>AC</th><th class='num'>CV</th><th class='num'>SV ($)</th><th class='num'>CPI</th><th class='num'>SPI</th><th class='num'>EAC</th></tr></thead>";
    var etb = el("tbody");
    state.projects.forEach(function (p) {
      var v = projectEVM(p);
      var cpiBadge = "<span class='badge " + (v.cpi >= 1 ? "ok" : v.cpi >= 0.9 ? "warn" : "danger") + "'>" + num2(v.cpi) + "</span>";
      var spiBadge = "<span class='badge " + (v.spi >= 1 ? "ok" : v.spi >= 0.9 ? "warn" : "danger") + "'>" + num2(v.spi) + "</span>";
      etb.appendChild(el("tr", null,
        "<td><strong>" + esc(p.name) + "</strong></td>" +
        "<td class='num'>" + money(v.bac) + "</td>" +
        "<td class='num'>" + money(v.pv) + "</td>" +
        "<td class='num'>" + money(v.ev) + "</td>" +
        "<td class='num'>" + money(v.ac) + "</td>" +
        "<td class='num'>" + (v.cv < 0 ? "<span class='badge danger'>" + money(v.cv) + "</span>" : money(v.cv)) + "</td>" +
        "<td class='num'>" + (v.sv < 0 ? "<span class='badge warn'>" + money(v.sv) + "</span>" : money(v.sv)) + "</td>" +
        "<td class='num'>" + cpiBadge + "</td>" +
        "<td class='num'>" + spiBadge + "</td>" +
        "<td class='num'>" + money(v.eac) + "</td>"));
    });
    // Program roll-up row (all projects as one program).
    var pe = programEVM();
    var peCpi = "<span class='badge " + (pe.cpi >= 1 ? "ok" : pe.cpi >= 0.9 ? "warn" : "danger") + "'>" + num2(pe.cpi) + "</span>";
    var peSpi = "<span class='badge " + (pe.spi >= 1 ? "ok" : pe.spi >= 0.9 ? "warn" : "danger") + "'>" + num2(pe.spi) + "</span>";
    etb.appendChild(el("tr", { style: "font-weight:700;border-top:2px solid var(--border-strong)" },
      "<td>Program (all projects)</td>" +
      "<td class='num'>" + money(pe.bac) + "</td><td class='num'>" + money(pe.pv) + "</td><td class='num'>" + money(pe.ev) + "</td>" +
      "<td class='num'>" + money(pe.ac) + "</td><td class='num'>" + money(pe.cv) + "</td><td class='num'>" + money(pe.sv) + "</td>" +
      "<td class='num'>" + peCpi + "</td><td class='num'>" + peSpi + "</td><td class='num'>" + money(pe.eac) + "</td>"));
    et.appendChild(etb);
    evmPanel.appendChild(et);
    root.appendChild(evmPanel);

    // Program-level EVM summary (portfolio as one program of common projects)
    var progPanel = el("div", { class: "panel panel-pad mt" });
    progPanel.appendChild(el("h2", null, "Program performance — " + pe.projects + " projects as one program"));
    var pg = el("div", { class: "grid cols-4" });
    pg.appendChild(statCard("Program EV / BAC", money(pe.ev) + " / " + money(pe.bac), pct(pe.bac ? pe.ev / pe.bac * 100 : 0) + " earned"));
    pg.appendChild(statCard("Actual cost (AC)", money(pe.ac), money(pe.cv) + " cost variance", pe.cv < 0 ? "danger" : "ok"));
    pg.appendChild(statCard("Program CPI", num2(pe.cpi), pe.cpi >= 1 ? "on/under cost" : "over cost", pe.cpi >= 1 ? "ok" : pe.cpi >= 0.9 ? "warn" : "danger"));
    pg.appendChild(statCard("Program SPI", num2(pe.spi), pe.spi >= 1 ? "on/ahead of schedule" : "behind schedule", pe.spi >= 1 ? "ok" : pe.spi >= 0.9 ? "warn" : "danger"));
    progPanel.appendChild(pg);
    var pg2 = el("div", { class: "grid cols-3 mt" });
    pg2.appendChild(statCard("Schedule variance (SV $)", money(pe.sv), "earned value vs planned value", pe.sv < 0 ? "warn" : "ok"));
    pg2.appendChild(statCard("Estimate at completion (EAC)", money(pe.eac), "BAC ÷ CPI", pe.eac > pe.bac ? "danger" : "ok"));
    pg2.appendChild(statCard("Variance at completion (VAC)", money(pe.bac - pe.eac), "BAC − EAC", (pe.bac - pe.eac) < 0 ? "danger" : "ok"));
    progPanel.appendChild(pg2);
    root.appendChild(progPanel);

    var insightPanel = el("div", { class: "panel panel-pad mt" });
    insightPanel.appendChild(el("h2", null, "Manager actions & risks"));
    insights().forEach(function (i) {
      var ico = i.level === "danger" ? "⛔" : i.level === "warn" ? "⚠️" : "✅";
      insightPanel.appendChild(el("div", { class: "insight " + i.level },
        '<span class="ico">' + ico + '</span><div class="insight-body"><strong>' + esc(i.title) + "</strong><span>" + esc(i.body) + "</span></div>"));
    });
    root.appendChild(insightPanel);
  };

  /* ---------- Client Report ---------- */
  VIEWS.client = function (root) {
    var billable = state.projects.filter(function (p) { return p.billable; });
    var head = pageHead("Client Project Briefing", "Printable status snapshot. Internal cost and margin are excluded.");
    var actions = el("div", { class: "head-actions no-print" });
    var sel = el("select", { class: "select select-sm" }, billable.map(function (p, i) {
      return "<option value='" + p.id + "'>" + esc(p.name) + " — " + esc(p.client) + "</option>";
    }).join(""));
    var printBtn = el("button", { class: "btn primary" }, "🖨 Print / PDF");
    printBtn.addEventListener("click", function () { window.print(); });
    actions.appendChild(sel); actions.appendChild(printBtn);
    head.appendChild(actions);
    root.appendChild(head);

    var container = el("div", { id: "clientReportBody" });
    root.appendChild(container);
    function draw(pid2) {
      container.innerHTML = "";
      var p = projectById(pid2);
      if (!p) { container.appendChild(el("div", { class: "empty" }, "No billable project selected.")); return; }
      container.appendChild(renderClientReport(p));
    }
    sel.addEventListener("change", function () { draw(this.value); });
    draw(billable.length ? billable[0].id : null);
  };

  function renderClientReport(p) {
    var r = projectRollup(p);
    var cs = state.cards.filter(function (c) { return c.projectId === p.id; });
    var wrap = el("div");

    var header = el("div", { class: "panel panel-pad" });
    header.innerHTML =
      "<div class='flex' style='justify-content:space-between;align-items:flex-start'>" +
      "<div>" + brandHTML("Techniek Engineering", "Project Status Briefing") + "</div>" +
      "<div class='right muted'><div><strong style='color:var(--text);font-size:16px'>" + esc(p.name) + "</strong></div><div>" + esc(p.client) + "</div><div>" + fmtDateLong(todayISO()) + "</div></div>" +
      "</div>";
    wrap.appendChild(header);

    var stats = el("div", { class: "grid cols-4 mt" });
    stats.appendChild(statCard("Overall progress", r.progress + "%", p.status));
    stats.appendChild(statCard("Milestones", cs.filter(function (c) { return c.milestone && isDone(c); }).length + "/" + cs.filter(function (c) { return c.milestone; }).length, "completed"));
    stats.appendChild(statCard("Deliverables", r.done + "/" + r.cards, "complete"));
    stats.appendChild(statCard("Target date", fmtDate(p.endDate), "planned completion"));
    stats.appendChild(statCard("Contract value", money(contractValue(p)), "latest funded value"));
    wrap.appendChild(stats);

    // Visual snapshot (client-safe: progress, milestones, deliverables, schedule health)
    var msDone = cs.filter(function (c) { return c.milestone && isDone(c); }).length, msTotal = cs.filter(function (c) { return c.milestone; }).length;
    var chartsPanel = el("div", { class: "panel panel-pad mt report-charts" });
    var ci = "<h2>Status at a glance</h2><div class='chart-cap'>Visual snapshot of overall progress, milestone and deliverable completion, and schedule health.</div><div class='chart-grid'>";
    ci += chartCard("Overall progress", p.status, svgDonut(r.progress, { color: r.progress >= 66 ? CHART.green : r.progress >= 33 ? CHART.teal : CHART.amber, sub: "complete" }));
    ci += chartCard("Milestones", "Completed vs remaining", svgPie([
      { label: "Complete", value: msDone, color: CHART.green },
      { label: "Remaining", value: Math.max(0, msTotal - msDone), color: CHART.slate },
    ], { center: msDone + "/" + msTotal, sub: "milestones" }));
    ci += chartCard("Deliverables", "Completed vs remaining", svgPie([
      { label: "Complete", value: r.done, color: CHART.brand },
      { label: "Remaining", value: Math.max(0, r.cards - r.done), color: CHART.slate },
    ], { center: r.done + "/" + r.cards, sub: "work items" }));
    ci += chartCard("Schedule health", "Work items by status", svgPie(scheduleHealthSegments(cs), { sub: "items" }));
    var wsRows = cs.filter(function (c) { return !c.milestone; }).sort(function (a, b) { return (b.progress || 0) - (a.progress || 0); }).slice(0, 6)
      .map(function (c) { return { label: c.title, value: c.progress || 0, valueLabel: (c.progress || 0) + "%", color: (c.progress || 0) >= 66 ? CHART.green : (c.progress || 0) >= 33 ? CHART.teal : CHART.amber }; });
    if (wsRows.length) ci += chartCard("Current workstream progress", "Top active deliverables", svgHBars(wsRows));
    ci += "</div>";
    chartsPanel.innerHTML = ci;
    wrap.appendChild(chartsPanel);

    // Milestones
    var msPanel = el("div", { class: "panel panel-pad mt" });
    msPanel.appendChild(el("h2", null, "Key milestones"));
    var milestones = cs.filter(function (c) { return c.milestone; }).sort(function (a, b) { return (a.due || "").localeCompare(b.due || ""); });
    if (!milestones.length) msPanel.appendChild(el("div", { class: "muted" }, "No milestones defined."));
    else {
      var mt = el("table", { class: "table" });
      mt.innerHTML = "<thead><tr><th>Milestone</th><th>Target</th><th>Status</th></tr></thead>";
      var mtb = el("tbody");
      milestones.forEach(function (c) {
        var st = isDone(c) ? "<span class='badge ok'>Complete</span>" : daysUntil(c.due) < 0 ? "<span class='badge warn'>In progress</span>" : "<span class='badge neutral'>Planned</span>";
        mtb.appendChild(el("tr", null, "<td>" + esc(c.title) + "</td><td>" + fmtDate(c.due) + "</td><td>" + st + "</td>"));
      });
      mt.appendChild(mtb); msPanel.appendChild(mt);
    }
    wrap.appendChild(msPanel);

    // Recent / active deliverables (no cost)
    var actPanel = el("div", { class: "panel panel-pad mt" });
    actPanel.appendChild(el("h2", null, "Current workstream"));
    var at = el("table", { class: "table" });
    at.innerHTML = "<thead><tr><th>Deliverable</th><th>Stage</th><th>Progress</th><th>Target</th></tr></thead>";
    var atb = el("tbody");
    cs.filter(function (c) { return !c.milestone; }).sort(function (a, b) { return (b.progress || 0) - (a.progress || 0); }).slice(0, 12).forEach(function (c) {
      var col = columnName(c);
      atb.appendChild(el("tr", null,
        "<td>" + esc(c.title) + "</td><td class='muted'>" + esc(col) + "</td>" +
        "<td><div class='bar'><span class='ok' style='width:" + (c.progress || 0) + "%'></span></div></td>" +
        "<td class='muted'>" + fmtDate(c.due) + "</td>"));
    });
    at.appendChild(atb); actPanel.appendChild(at);
    wrap.appendChild(actPanel);

    // Billing snapshot — value only, no cost/margin
    var billPanel = el("div", { class: "panel panel-pad mt" });
    billPanel.appendChild(el("h2", null, "Billing snapshot"));
    var billed = Math.round(p.budget * (r.progress / 100));
    billPanel.innerHTML +=
      "<div class='grid cols-3'>" +
      statCardHTML("Contract value", money(contractValue(p)), "latest funded value") +
      statCardHTML("Earned to date", money(Math.round(contractValue(p) * (r.progress / 100))), r.progress + "% complete") +
      statCardHTML("Remaining", money(contractValue(p) - Math.round(contractValue(p) * (r.progress / 100))), "to be delivered") +
      "</div>" +
      "<div class='hint mt'>Figures reflect progress against the agreed contract value. Internal effort, cost, and margin are not shown.</div>";
    wrap.appendChild(billPanel);

    return wrap;
  }

  /* ---------- Issues, Decisions, Audit ---------- */
  VIEWS.issues = function (root) {
    var head = pageHead("Issue Register", "Project issues, owners, priorities, and due dates.");
    if (canEdit()) head.querySelector(".head-actions").appendChild(mkBtn("+ Add issue", "btn primary sm", function () { openIssueEditor(null); }));
    root.appendChild(head);
    renderIssuesTable(root, state.issues || []);
  };
  function renderIssuesTable(root, rows) {
    var tbl = el("table", { class: "table" });
    tbl.innerHTML = "<thead><tr><th>Issue</th><th>Project</th><th>Priority</th><th>Status</th><th>Owner</th><th>Due</th></tr></thead>";
    var tb = el("tbody");
    rows.forEach(function (i) { var p = projectById(i.projectId), r = resourceById(i.ownerId); var tr = el("tr", { style: canEdit() ? "cursor:pointer" : "" }, "<td><strong>" + esc(i.title) + "</strong><div class='muted'>" + esc(i.category || "") + "</div></td><td>" + esc(p ? p.name : "—") + "</td><td><span class='badge " + (i.priority === "Critical" ? "danger" : i.priority === "High" ? "warn" : "neutral") + "'>" + esc(i.priority || "Moderate") + "</span></td><td>" + esc(i.status || "Open") + "</td><td class='muted'>" + esc(r ? r.name : "—") + "</td><td>" + fmtDate(i.dueDate) + "</td>"); if (canEdit()) tr.addEventListener("click", function () { openIssueEditor(i.id); }); tb.appendChild(tr); });
    if (!rows.length) tb.appendChild(el("tr", null, "<td colspan='6' class='empty'>No issues logged.</td>"));
    tbl.appendChild(tb); root.appendChild(el("div", { class: "panel" })).appendChild(tbl);
  }
  function openIssueEditor(id) {
    var isNew = !id, i = id ? (state.issues || []).filter(function (x) { return x.id === id; })[0] : { id: uid("is"), projectId: (state.projects[0] || {}).id, title: "", category: "", priority: "Moderate", status: "Open", ownerId: "", dueDate: todayISO(), description: "", _new: true };
    var body = el("div");
    body.innerHTML = "<div class='form-grid'><div class='form-row full'><label class='field-label inline'>Issue</label><input class='input' id='isTitle' value='" + esc(i.title) + "'></div><div class='form-row'><label class='field-label inline'>Project</label><select class='select' id='isProject'>" + state.projects.map(function (p) { return "<option value='" + p.id + "'" + (p.id === i.projectId ? " selected" : "") + ">" + esc(p.name) + "</option>"; }).join("") + "</select></div><div class='form-row'><label class='field-label inline'>Owner</label><select class='select' id='isOwner'><option value=''>Unassigned</option>" + state.resources.map(function (r) { return "<option value='" + r.id + "'" + (r.id === i.ownerId ? " selected" : "") + ">" + esc(r.name) + "</option>"; }).join("") + "</select></div><div class='form-row'><label class='field-label inline'>Priority</label><select class='select' id='isPriority'>" + ISSUE_PRIORITIES.map(function (x) { return "<option" + (x === i.priority ? " selected" : "") + ">" + x + "</option>"; }).join("") + "</select></div><div class='form-row'><label class='field-label inline'>Status</label><select class='select' id='isStatus'>" + ISSUE_STATUS.map(function (x) { return "<option" + (x === i.status ? " selected" : "") + ">" + x + "</option>"; }).join("") + "</select></div><div class='form-row'><label class='field-label inline'>Due</label><input class='input' type='date' id='isDue' value='" + (i.dueDate || "") + "'></div><div class='form-row'><label class='field-label inline'>Category</label><input class='input' id='isCat' value='" + esc(i.category || "") + "'></div><div class='form-row full'><label class='field-label inline'>Description</label><textarea class='textarea' id='isDesc'>" + esc(i.description || "") + "</textarea></div></div>";
    modal(isNew ? "New issue" : "Issue", body, [{ label: "Cancel", cls: "btn", fn: closeModal }, { label: "Save", cls: "btn primary", fn: function () { var title = $("#isTitle").value.trim(); if (!title) return toast("Issue title is required", "err"); mutate(function () { i.title = title; i.projectId = $("#isProject").value; i.ownerId = $("#isOwner").value; i.priority = $("#isPriority").value; i.status = $("#isStatus").value; i.dueDate = $("#isDue").value; i.category = $("#isCat").value; i.description = $("#isDesc").value; if (i._new) { delete i._new; state.issues.push(i); } recordAudit("Issue", i.id, isNew ? "Issue created" : "Issue saved", i.title); }); closeModal(); toast("Issue saved", "ok"); } }]);
  }
  VIEWS.decisions = function (root) {
    var head = pageHead("Decision Register", "Project decisions, impacts, and approval status.");
    if (canGovernRegisters()) head.querySelector(".head-actions").appendChild(mkBtn("+ Add decision", "btn primary sm", function () { openDecisionEditor(null); }));
    root.appendChild(head); renderDecisionsTable(root, state.decisions || []);
  };
  function renderDecisionsTable(root, rows) {
    var tbl = el("table", { class: "table" });
    tbl.innerHTML = "<thead><tr><th>Decision</th><th>Project</th><th>Status</th><th>Proposed</th><th>Approved</th></tr></thead>";
    var tb = el("tbody");
    rows.forEach(function (d) { var p = projectById(d.projectId); var tr = el("tr", { style: canGovernRegisters() ? "cursor:pointer" : "" }, "<td><strong>" + esc(d.title) + "</strong><div class='muted'>" + esc(d.impact || "") + "</div></td><td>" + esc(p ? p.name : "—") + "</td><td><span class='badge " + (d.status === "Approved" ? "ok" : d.status === "Rejected" ? "danger" : "warn") + "'>" + esc(d.status || "Pending") + "</span></td><td class='muted'>" + esc(d.proposedBy || "") + " " + fmtDate(d.proposedDate) + "</td><td class='muted'>" + esc(d.approvedBy || "") + " " + fmtDate(d.approvedDate) + "</td>"); if (canGovernRegisters()) tr.addEventListener("click", function () { openDecisionEditor(d.id); }); tb.appendChild(tr); });
    if (!rows.length) tb.appendChild(el("tr", null, "<td colspan='5' class='empty'>No decisions logged.</td>"));
    tbl.appendChild(tb); root.appendChild(el("div", { class: "panel" })).appendChild(tbl);
  }
  function openDecisionEditor(id) {
    if (!canGovernRegisters()) { toast("The decision register is read-only for your role", "err"); return; }
    var isNew = !id, d = id ? (state.decisions || []).filter(function (x) { return x.id === id; })[0] : { id: uid("de"), projectId: (state.projects[0] || {}).id, title: "", details: "", impact: "", status: "Pending", proposedBy: (currentUser() || {}).displayName || "", proposedDate: todayISO(), approvedBy: "", approvedDate: "", _new: true };
    var body = el("div");
    body.innerHTML = "<div class='form-grid'><div class='form-row full'><label class='field-label inline'>Decision</label><input class='input' id='deTitle' value='" + esc(d.title) + "'></div><div class='form-row'><label class='field-label inline'>Project</label><select class='select' id='deProject'>" + state.projects.map(function (p) { return "<option value='" + p.id + "'" + (p.id === d.projectId ? " selected" : "") + ">" + esc(p.name) + "</option>"; }).join("") + "</select></div><div class='form-row'><label class='field-label inline'>Status</label><select class='select' id='deStatus'>" + DECISION_STATUS.map(function (x) { return "<option" + (x === d.status ? " selected" : "") + ">" + x + "</option>"; }).join("") + "</select></div><div class='form-row'><label class='field-label inline'>Proposed by</label><input class='input' id='deBy' value='" + esc(d.proposedBy || "") + "'></div><div class='form-row'><label class='field-label inline'>Proposed date</label><input class='input' type='date' id='deDate' value='" + (d.proposedDate || "") + "'></div><div class='form-row'><label class='field-label inline'>Approved by</label><input class='input' id='deAppBy' value='" + esc(d.approvedBy || "") + "'></div><div class='form-row'><label class='field-label inline'>Approved date</label><input class='input' type='date' id='deAppDate' value='" + (d.approvedDate || "") + "'></div><div class='form-row full'><label class='field-label inline'>Details</label><textarea class='textarea' id='deDetails'>" + esc(d.details || "") + "</textarea></div><div class='form-row full'><label class='field-label inline'>Impact</label><textarea class='textarea' id='deImpact'>" + esc(d.impact || "") + "</textarea></div></div>";
    modal(isNew ? "New decision" : "Decision", body, [{ label: "Cancel", cls: "btn", fn: closeModal }, { label: "Save", cls: "btn primary", fn: function () { var title = $("#deTitle").value.trim(); if (!title) return toast("Decision title is required", "err"); mutate(function () { d.title = title; d.projectId = $("#deProject").value; d.status = $("#deStatus").value; d.proposedBy = $("#deBy").value; d.proposedDate = $("#deDate").value; d.approvedBy = $("#deAppBy").value; d.approvedDate = $("#deAppDate").value; d.details = $("#deDetails").value; d.impact = $("#deImpact").value; if (d._new) { delete d._new; state.decisions.push(d); } recordAudit("Decision", d.id, isNew ? "Decision created" : "Decision saved", d.title); }); closeModal(); toast("Decision saved", "ok"); } }]);
  }
  VIEWS.audit = function (root) {
    root.appendChild(pageHead("Audit Trail", "Local audit events for imports, project governance, and major work-item changes."));
    var tbl = el("table", { class: "table" });
    tbl.innerHTML = "<thead><tr><th>Time</th><th>Actor</th><th>Entity</th><th>Action</th><th>Detail</th></tr></thead>";
    var tb = el("tbody");
    (state.auditTrail || []).slice(0, 200).forEach(function (a) { tb.appendChild(el("tr", null, "<td class='muted'>" + new Date(a.ts).toLocaleString() + "</td><td>" + esc(a.actor || "") + "</td><td>" + esc(a.entity || "") + "</td><td>" + esc(a.action || "") + "</td><td class='muted'>" + esc(a.detail || "") + "</td>")); });
    if (!(state.auditTrail || []).length) tb.appendChild(el("tr", null, "<td colspan='5' class='empty'>No audit entries yet.</td>"));
    tbl.appendChild(tb); root.appendChild(el("div", { class: "panel" })).appendChild(tbl);
  };


  /* ---------- PM Specialist ---------- */
  VIEWS.pmspecialist = function (root) {
    var active = ui.pmSpecialistTab || "Ask";
    root.appendChild(pageHead("PM Specialist", "Procedure-aware PM assistance, vector-store controls, SharePoint freshness checks, and rules-of-credit management."));
    if (role() === "Viewer") root.appendChild(el("div", { class: "warn-banner mb" }, "Viewer role can review PM Specialist outputs but cannot import projects or change procedure records."));
    var tabs = ["Ask", "Vector Store", "SharePoint Check"];
    var tabbar = el("div", { class: "flex wrap mb" });
    tabs.forEach(function (t) { var b = el("button", { class: "btn sm" + (active === t ? " primary" : " ghost") }, t); b.addEventListener("click", function () { ui.pmSpecialistTab = t; render(); }); tabbar.appendChild(b); });
    root.appendChild(tabbar);
    if (active === "Ask") renderPmAsk(root);
    else if (active === "Vector Store") renderVectorStore(root);
    else renderSharePointCheck(root);
  };
  function pmCitationText(h) {
    if (!h) return "";
    if (typeof h.text === "string") return h.text;
    if (typeof h.content === "string") return h.content;
    if (Array.isArray(h.content)) return h.content.map(function (x) { return x.text || x.content || ""; }).join("\n");
    return h.snippet || h.quote || "";
  }
  function pmCitationLabel(h, i) {
    var name = h.filename || h.title || h.file_name || h.file_id || h.id || "Vector store result";
    return "Source " + (i + 1) + " - " + name;
  }
  function pmAnswerSummary(answer) {
    var text = String(answer || "").trim();
    if (!text) return "No PM Assistance response has been generated.";
    return text.split(/\n+/).filter(Boolean).slice(0, 2).join(" ");
  }
  function appendPmFormattedText(host, text) {
    var lines = String(text || "").split(/\r?\n/);
    var list = null;
    function closeList() { list = null; }
    lines.forEach(function (raw) {
      var line = raw.trim();
      if (!line) { closeList(); return; }
      var heading = /^#{1,4}\s+(.+)$/.exec(line);
      if (heading) { closeList(); host.appendChild(el("h3", null, esc(heading[1]))); return; }
      var bullet = /^(?:[-*]|\d+\.)\s+(.+)$/.exec(line);
      if (bullet) {
        if (!list) { list = el("ul"); host.appendChild(list); }
        list.appendChild(el("li", null, esc(bullet[1])));
        return;
      }
      closeList();
      host.appendChild(el("p", null, esc(line)));
    });
  }
  function pmCopyText(answer, hits) {
    var src = (hits || []).map(function (h, i) { return "[" + (i + 1) + "] " + pmCitationLabel(h, i) + (h.file_id ? " (" + h.file_id + ")" : ""); }).join("\n");
    return "Techniek PM Assistance\n\n" + String(answer || "").trim() + (src ? "\n\nSources\n" + src : "");
  }
  function renderPmBrief(answer, hits) {
    var wrap = el("div", { class: "pm-brief" });
    var head = el("div", { class: "pm-brief-head" });
    head.appendChild(el("div", null, "<div class='pm-eyebrow'>Techniek PM Assistance</div><h2>Procedure-backed PM brief</h2><p>" + esc(pmAnswerSummary(answer)) + "</p>"));
    var copy = el("button", { class: "btn sm primary" }, "Copy brief");
    copy.addEventListener("click", function () {
      var text = pmCopyText(answer, hits);
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { toast("PM Assistance brief copied", "ok"); }).catch(function () { toast("Copy failed; select the brief text manually", "err"); });
      else toast("Clipboard is unavailable; select the brief text manually", "err");
    });
    head.appendChild(copy);
    wrap.appendChild(head);
    var body = el("div", { class: "pm-brief-body" });
    appendPmFormattedText(body, answer || "No PM Assistance query has been run in this session.");
    wrap.appendChild(body);
    if ((hits || []).length) {
      var citeWrap = el("div", { class: "pm-citations" });
      citeWrap.appendChild(el("h3", null, "Sources"));
      hits.forEach(function (h, i) {
        var detail = el("details", { class: "pm-citation" });
        detail.appendChild(el("summary", null, esc(pmCitationLabel(h, i))));
        detail.appendChild(el("div", { class: "pm-citation-body" }, "<div class='muted'>" + esc(h.file_id || h.id || "") + "</div><p>" + esc(pmCitationText(h) || "No extract text returned by file search.") + "</p>"));
        citeWrap.appendChild(detail);
      });
      wrap.appendChild(citeWrap);
    }
    return wrap;
  }

  function pmFocusLabel(focus) {
    if (focus === "profitability") return "improve profitability / contribution margin";
    if (focus === "schedule") return "improve schedule performance";
    if (focus === "compliance") return "improve compliance posture";
    return "general PM support";
  }
  function buildProjectPromptContext(projectId, focus, question) {
    var p = projectById(projectId);
    if (!p) return String(question || "");
    var r = projectRollup(p), v = projectEVM(p);
    var openRisks = (state.risks || []).filter(function (rk) { return rk.projectId === p.id && rk.status !== "Closed"; }).slice(0, 5);
    var openActions = (state.actionItems || []).filter(function (a) { return a.projectId === p.id && a.status !== "Closed"; }).slice(0, 5);
    var cards = state.cards.filter(function (c) { return c.projectId === p.id; });
    return [
      "Project-specific PM Specialist request.",
      "Use the retrieved procedure/vector-store content as the governing basis. Treat the project facts below as user-provided context for applying those procedures.",
      "Focus: " + pmFocusLabel(focus),
      "Project: " + p.name + " (" + (p.unanetProjectCode || p.id) + ")",
      "Client: " + (p.client || "not specified"),
      "Billing type: " + projectBillingType(p),
      "Contract value/funded value: " + money(contractValue(p)),
      "Progress: " + pct(r.progress),
      "Contribution margin: " + pctRatio(r.contributionMargin) + "; multiplier: " + fmtMultiplier(projectMultiplier(r)),
      "CPI: " + num2(v.cpi) + "; SPI: " + num2(v.spi) + "; EAC: " + money(v.eac),
      "Open work items: " + cards.filter(function (c) { return !isDone(c); }).length + " of " + cards.length,
      "Open risks: " + openRisks.map(function (rk) { return rk.title; }).join(" | "),
      "Open action items: " + openActions.map(function (a) { return a.title; }).join(" | "),
      "Expected response alignment: answer the selected focus directly, apply only retrieved procedure/vector-store guidance to the project facts above, and state when the store does not support a recommendation.",
      "Question: " + String(question || "").trim()
    ].join("\n");
  }

  function renderPmAsk(root) {
    var grid = el("div", { class: "grid cols-2 pm-assist-grid" });
    var panel = el("div", { class: "panel panel-pad" });
    panel.appendChild(el("h2", null, "Ask PM Specialist"));
    panel.appendChild(el("p", { class: "muted" }, "Uses only the configured OpenAI vector store through the local proxy at " + esc(pmProxyBase()) + ". If the answer is not supported by retrieved store files, PM Specialist will say so instead of using general knowledge or local workspace data."));
    var contextGrid = el("div", { class: "form-grid" });
    contextGrid.innerHTML = "<div class='form-row'><label class='field-label inline'>Project context</label><select class='select' id='pmAskProject'><option value=''>No specific project</option>" + state.projects.map(function (p) { return "<option value='" + p.id + "'" + (ui.pmAskProjectId === p.id ? " selected" : "") + ">" + esc(p.name) + "</option>"; }).join("") + "</select></div>" +
      "<div class='form-row'><label class='field-label inline'>Question focus</label><select class='select' id='pmAskFocus'><option value='general'>General PM support</option><option value='profitability'>More profitable</option><option value='schedule'>Improve schedule</option><option value='compliance'>More compliant</option></select></div>";
    panel.appendChild(contextGrid);
    setTimeout(function () { var f = $("#pmAskFocus"); if (f && ui.pmAskFocus) f.value = ui.pmAskFocus; }, 0);
    var q = el("textarea", { class: "textarea pm-question", id: "pmQuestion", placeholder: "Ask for a procedure-backed recommendation, action plan, control check, or project-management draft..." });
    q.value = ui.pmQuestionDraft || "";
    q.addEventListener("input", function () { ui.pmQuestionDraft = q.value; });
    panel.appendChild(q);
    var row = el("div", { class: "flex wrap mt" });
    row.appendChild(mkBtn("Ask", "btn primary", async function () {
      var question = q.value.trim(); if (!question) return toast("Enter a PM Specialist question", "err");
      var projectId = $("#pmAskProject") ? $("#pmAskProject").value : "";
      var focus = $("#pmAskFocus") ? $("#pmAskFocus").value : "general";
      ui.pmQuestionDraft = question;
      ui.pmAskProjectId = projectId;
      ui.pmAskFocus = focus;
      var promptedQuestion = projectId ? buildProjectPromptContext(projectId, focus, question) : question;
      ui.pmWorking = true;
      ui.pmAnswer = "Searching the configured procedure store and preparing a procedure-backed answer...";
      ui.pmHits = [];
      render();
      try {
        var data = await pmProxyJson("/api/file-search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: promptedQuestion, vectorStoreId: pmVectorStoreId(), maxResults: 10 }) });
        ui.pmHits = data.results || [];
        ui.pmAnswer = ui.pmHits.length ? (data.outputText || data.answer || JSON.stringify(data, null, 2)) : "The answer is not available in the PM Specialist procedure store.";
        mutate(function () { state.ragQueries.push({ id: uid("rag"), ts: Date.now(), question: question, projectId: projectId, focus: focus, source: "OpenAI file_search", vectorStoreId: pmVectorStoreId() }); });
      } catch (e) {
        ui.pmAnswer = "PM Specialist could not answer because vector-store search is unavailable: " + (e.message || e);
        ui.pmHits = [];
      } finally {
        ui.pmWorking = false;
        render();
      }
    }));
    panel.appendChild(row); grid.appendChild(panel);
    var out = el("div", { class: "panel panel-pad pm-output-panel" });
    if (ui.pmWorking) out.appendChild(el("div", { class: "pm-working" }, "<div class='pm-working-head'><strong>PM Assistance is working</strong><span>Searching vector store, checking support, and formatting the brief.</span></div><div class='pm-progress'><span></span></div>"));
    out.appendChild(renderPmBrief(ui.pmAnswer || "No PM Assistance query has been run in this session.", ui.pmHits || []));
    grid.appendChild(out); root.appendChild(grid);
  }
  async function refreshVectorStoreFiles(silent) {
    var data = await pmProxyJson("/api/vector-store/files?all=1&limit=100&vectorStoreId=" + encodeURIComponent(pmVectorStoreId()));
    var files = data.data || data.files || [];
    ui.vectorStoreFileCount = data.count || files.length;
    ui.vectorStoreFileComplete = data.complete !== false;
    mutate(function () { state.vectorStoreFiles = files; });
    if (!silent) toast("Vector store file list refreshed: " + files.length + " file" + (files.length === 1 ? "" : "s"), "ok");
    return files;
  }
  function renderVectorStore(root) {
    var panel = el("div", { class: "panel panel-pad" });
    panel.appendChild(el("h2", null, "OpenAI vector store"));
    panel.appendChild(el("p", { class: "muted" }, secretWarning() + " File list/add/delete calls go through the local proxy."));
    var cfg = el("div", { class: "grid cols-3" });
    cfg.innerHTML = statCardHTML("Vector store", esc(pmVectorStoreId()), "configured id") + statCardHTML("Proxy", esc(pmProxyBase()), "local backend") + statCardHTML("Cached files", ui.vectorStoreFileCount || (state.vectorStoreFiles || []).length, (ui.vectorStoreFileComplete === false ? "partial refresh" : "full refresh"));
    panel.appendChild(cfg);
    var row = el("div", { class: "flex wrap mt" });
    row.appendChild(mkBtn("Refresh files", "btn primary", async function () { try { await refreshVectorStoreFiles(false); } catch (e) { toast(e.message, "err"); } }));
    row.appendChild(mkBtn("Attach by file ID", "btn", function () { attachVectorFileModal(); }));
    row.appendChild(mkBtn("Upload files", "btn", function () { uploadVectorFilePrompt(); }));
    panel.appendChild(row);
    var files = state.vectorStoreFiles || [];
    var table = el("table", { class: "table mt" });
    table.innerHTML = "<thead><tr><th>File name</th><th>OpenAI file ID</th><th>Status</th><th class='num'>Size / usage</th><th>Purpose</th><th>Last error</th><th></th></tr></thead>";
    var tb = el("tbody");
    files.forEach(function (f) {
      var tr = el("tr");
      tr.innerHTML = "<td><strong>" + esc(vectorStoreFileName(f) || "-") + "</strong><div class='muted'>" + esc(f.attributes && (f.attributes.title || f.attributes.source) || "") + "</div></td><td><code>" + esc(f.file_id || f.id || "") + "</code></td><td><span class='badge " + (f.status === "completed" ? "ok" : f.status === "failed" ? "danger" : "warn") + "'>" + esc(f.status || "unknown") + "</span></td><td class='num'>" + esc(f.bytes || f.usage_bytes || 0) + "</td><td class='muted'>" + esc(f.purpose || "") + "</td><td class='muted'>" + esc(f.last_error ? f.last_error.message || f.last_error.code : (f.file_metadata_error || "")) + "</td><td class='right'></td>";
      var del = el("button", { class: "btn sm danger" }, "Delete");
      del.addEventListener("click", async function () { if (!confirm("Delete vector-store file " + (f.id || f.file_id) + "?")) return; try { await pmProxyJson("/api/vector-store/files/" + encodeURIComponent(f.id || f.file_id) + "?vectorStoreId=" + encodeURIComponent(pmVectorStoreId()), { method: "DELETE" }); mutate(function () { state.vectorStoreFiles = (state.vectorStoreFiles || []).filter(function (x) { return (x.id || x.file_id) !== (f.id || f.file_id); }); }); toast("Vector store file deleted", "ok"); } catch (e) { toast(e.message, "err"); } });
      tr.querySelector("td.right").appendChild(del); tb.appendChild(tr);
    });
    if (!files.length) tb.appendChild(el("tr", null, "<td colspan='7' class='empty'>No vector-store files cached. Start the local proxy and refresh.</td>"));
    table.appendChild(tb);
    var scroll = el("div", { class: "vector-store-table-scroll table-wrap mt" });
    scroll.appendChild(table);
    panel.appendChild(scroll);
    root.appendChild(panel);
  }
  function attachVectorFileModal() {
    var body = el("div");
    body.innerHTML = "<label class='field-label'>OpenAI file ID</label><input id='vsFileId' class='input' placeholder='file-...' />" +
      "<label class='field-label mt'>Procedure title / version metadata</label><input id='vsTitle' class='input' placeholder='Procedure name or revision' />";
    modal("Attach existing OpenAI file", body, [{ label: "Cancel", cls: "btn", fn: closeModal }, { label: "Attach", cls: "btn primary", fn: async function () { var id = $("#vsFileId").value.trim(); if (!id) return toast("File ID required", "err"); try { await pmProxyJson("/api/vector-store/files", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ vectorStoreId: pmVectorStoreId(), file_id: id, attributes: { title: $("#vsTitle").value.trim(), source: "OpsBoard PM Specialist" } }) }); await refreshVectorStoreFiles(true); closeModal(); toast("File attached to vector store", "ok"); } catch (e) { toast(e.message, "err"); } } }], "sm");
  }
  async function uploadVectorFile(file) {
    var fd = new FormData();
    fd.append("file", file);
    fd.append("vectorStoreId", pmVectorStoreId());
    return fetch(pmProxyBase() + "/api/vector-store/upload", { method: "POST", body: fd }).then(async function (r) {
      var t = await r.text();
      var d = t ? JSON.parse(t) : {};
      if (!r.ok) throw new Error(d.error || r.statusText);
      return d;
    });
  }
  function uploadVectorFilePrompt() {
    var input = el("input", { type: "file", multiple: "multiple", accept: ".pdf,.doc,.docx,.txt,.md,.pptx,.json,.csv,.html,.js,.py" });
    input.addEventListener("change", async function () {
      var files = [].slice.call(input.files || []);
      if (!files.length) return;
      var ok = 0, failed = [];
      for (var i = 0; i < files.length; i++) {
        try { await uploadVectorFile(files[i]); ok++; }
        catch (e) { failed.push(files[i].name + ": " + (e.message || e)); }
      }
      try { await refreshVectorStoreFiles(true); } catch (e2) {}
      if (failed.length) toast(ok + " uploaded; " + failed.length + " failed", "err");
      else toast(ok + " file" + (ok === 1 ? "" : "s") + " uploaded and attached", "ok");
    });
    input.click();
  }
  function renderSharePointCheck(root) {
    var panel = el("div", { class: "panel panel-pad" });
    panel.appendChild(el("h2", null, "SharePoint procedure version check"));
    panel.appendChild(el("p", { class: "muted" }, "Phase 1 uses a manager-maintained procedure registry. Production SharePoint/Graph checks require enterprise auth and site/library configuration."));
    var row = el("div", { class: "flex wrap mt" });
    row.appendChild(mkBtn("Run version check", "btn primary", function () { mutate(refreshProcedureStatuses); toast("Procedure statuses refreshed", "ok"); }));
    row.appendChild(mkBtn("Add procedure", "btn", function () { procedureModal(); }));
    panel.appendChild(row);
    var table = el("table", { class: "table mt" });
    table.innerHTML = "<thead><tr><th>Procedure</th><th>SharePoint rev</th><th>Vector rev</th><th>Vector file</th><th>Status</th><th></th></tr></thead>";
    var tb = el("tbody");
    (state.sharePointProcedures || []).forEach(function (p) { var cls = p.status === "Current" ? "ok" : p.status === "Outdated" ? "danger" : "warn"; var tr = el("tr", null, "<td><strong>" + esc(p.title) + "</strong><div class='muted'>" + esc(p.sharePointUrl || p.notes || "") + "</div></td><td>" + esc(p.procedureVersion || "") + "</td><td>" + esc(p.vectorVersion || "") + "</td><td>" + esc(p.vectorFileId || "") + "</td><td><span class='badge " + cls + "'>" + esc(p.status || procedureVersionStatus(p)) + "</span></td><td class='right'></td>"); var edit = el("button", { class: "btn sm" }, "Edit"); edit.addEventListener("click", function () { procedureModal(p); }); tr.querySelector("td.right").appendChild(edit); tb.appendChild(tr); });
    table.appendChild(tb); panel.appendChild(table); root.appendChild(panel);
  }
  function procedureModal(existing) {
    if (!canEdit()) return toast("Viewer role is read-only", "err");
    var p = existing || { id: uid("sp"), title: "", sharePointUrl: "", procedureVersion: "", vectorFileId: "", vectorVersion: "", sourceHash: "", owner: "PMO", notes: "" };
    var body = el("div");
    body.innerHTML = ["title|Title", "sharePointUrl|SharePoint URL", "procedureVersion|SharePoint version", "vectorFileId|Vector file ID", "vectorVersion|Vector version", "sourceHash|Source hash", "owner|Owner", "notes|Notes"].map(function (x) { var a = x.split("|"); return "<label class='field-label'>" + a[1] + "</label><input class='input mb' id='sp_" + a[0] + "' value='" + esc(p[a[0]] || "") + "' />"; }).join("");
    modal(existing ? "Edit procedure" : "Add procedure", body, [{ label: "Cancel", cls: "btn", fn: closeModal }, { label: "Save", cls: "btn primary", fn: function () { mutate(function () { ["title", "sharePointUrl", "procedureVersion", "vectorFileId", "vectorVersion", "sourceHash", "owner", "notes"].forEach(function (k) { p[k] = $("#sp_" + k).value.trim(); }); p.status = procedureVersionStatus(p); p.lastChecked = todayISO(); if (!existing) state.sharePointProcedures.push(p); recordAudit("Procedure", p.id, existing ? "Procedure updated" : "Procedure added", p.title); }); closeModal(); toast("Procedure saved", "ok"); } }], "sm");
  }
  function renderDeliverableWbsWorkflow(root) {
    var p = projectById(ui.rulesProjectId) || state.projects[0];
    ui.rulesProjectId = p && p.id;
    var panel = el("div", { class: "panel panel-pad" });
    panel.appendChild(el("h2", null, "Deliverable → WBS → activities → credit"));
    panel.appendChild(el("p", { class: "muted" }, "A mature control flow starts with deliverables, decomposes them into WBS work packages, assigns activities to complete each work package, and earns physical percent complete only through objective rules of credit."));
    if (!p) { root.appendChild(panel); return; }
    var sel = el("select", { class: "select select-sm mb" }, state.projects.map(function (x) { return "<option value='" + x.id + "'" + (x.id === p.id ? " selected" : "") + ">" + esc(x.name) + "</option>"; }).join(""));
    sel.addEventListener("change", function () { ui.rulesProjectId = sel.value; render(); });
    panel.appendChild(sel);
    var cards = state.cards.filter(function (c) { return c.projectId === p.id; }).sort(function (a, b) { return String(a.outlineNumber || "").localeCompare(String(b.outlineNumber || ""), undefined, { numeric: true }); });
    var tbl = el("table", { class: "table table-dense" });
    tbl.innerHTML = "<thead><tr><th>Deliverable</th><th>WBS package</th><th class='num'>Activities</th><th>Credit method</th><th class='num'>Physical %</th></tr></thead>";
    var tb = el("tbody");
    cards.forEach(function (c) {
      var deliverables = (c.subcards || []).length ? c.subcards.map(function (s) { return s.title; }).join(" | ") : c.title;
      var rule = (ruleById(c.ruleOfCreditId) || {}).name || c.progressMode || "Manual";
      tb.appendChild(el("tr", null, "<td>" + esc(deliverables) + "</td><td><strong>" + esc(c.outlineNumber || "-") + "</strong> " + esc(c.title) + "<div class='muted'>" + esc(c.chargeTask || "") + "</div></td><td class='num'>" + ((c.sourceActivities || []).length || 1) + "</td><td>" + esc(rule) + "</td><td class='num'>" + pct(c.physicalProgress == null ? c.progress : c.physicalProgress) + "</td>"));
    });
    if (!cards.length) tb.appendChild(el("tr", null, "<td colspan='5' class='empty'>No WBS work items for this project.</td>"));
    tbl.appendChild(tb); panel.appendChild(tbl);
    root.appendChild(panel);
  }
  function renderRulesOfCredit(root) {
    renderDeliverableWbsWorkflow(root);
    var panel = el("div", { class: "panel panel-pad mt rules-credit-manager" });
    panel.appendChild(el("h2", null, "Rules of credit schemas"));
    panel.appendChild(el("p", { class: "muted" }, "Select a schema, review the math, and edit the step table used to calculate physical percent complete. Sort by project use to put the rules applied to the selected project first."));
    var p = projectById(ui.rulesProjectId) || state.projects[0];
    var counts = ruleUsageCounts(p && p.id);
    var validations = {}; rulesOfCreditValidation().forEach(function (v) { validations[v.id] = v; });
    var sortedRules = (state.rulesOfCredit || []).slice().sort(function (a, b) {
      if ((ui.ruleSort || "project-use") === "name") return a.name.localeCompare(b.name);
      if (ui.ruleSort === "source") return String(a.source || "").localeCompare(String(b.source || "")) || a.name.localeCompare(b.name);
      return (counts[b.id] || 0) - (counts[a.id] || 0) || a.name.localeCompare(b.name);
    });
    if (!sortedRules.length) {
      panel.appendChild(el("div", { class: "empty" }, "No rules of credit are defined yet."));
      root.appendChild(panel);
      return;
    }
    if (!ui.selectedRuleId || !ruleById(ui.selectedRuleId)) ui.selectedRuleId = sortedRules[0].id;
    var controls = el("div", { class: "filters mb" });
    controls.appendChild(el("span", { class: "muted" }, "Sort"));
    var sortSel = el("select", { class: "select select-sm" }, "<option value='project-use'" + ((ui.ruleSort || "project-use") === "project-use" ? " selected" : "") + ">Project use first</option><option value='name'" + (ui.ruleSort === "name" ? " selected" : "") + ">Name</option><option value='source'" + (ui.ruleSort === "source" ? " selected" : "") + ">Source</option>");
    sortSel.addEventListener("change", function () { ui.ruleSort = sortSel.value; render(); });
    controls.appendChild(sortSel);
    controls.appendChild(el("span", { class: "muted" }, "Schema"));
    var schemaSel = el("select", { class: "select select-sm", id: "ruleSchemaSelector" }, sortedRules.map(function (rule) { return "<option value='" + rule.id + "'" + (rule.id === ui.selectedRuleId ? " selected" : "") + ">" + esc(rule.name) + " (" + (counts[rule.id] || 0) + ")</option>"; }).join(""));
    schemaSel.addEventListener("change", function () { ui.selectedRuleId = schemaSel.value; render(); });
    controls.appendChild(schemaSel);
    if (canEdit()) controls.appendChild(mkBtn("+ New schema", "btn primary sm", function () { openRuleSchemaEditor(); }));
    panel.appendChild(controls);

    var selected = ruleById(ui.selectedRuleId) || sortedRules[0];
    var summary = el("table", { class: "table table-dense mb" });
    summary.innerHTML = "<thead><tr><th>Schema</th><th>Source</th><th class='num'>Used on project</th><th class='num'>Steps</th><th>QA</th><th class='right'>Actions</th></tr></thead>";
    var stb = el("tbody");
    sortedRules.forEach(function (rule) {
      var v = validations[rule.id] || { valid: false };
      var tr = el("tr", { class: rule.id === selected.id ? "selected-row" : "", style: "cursor:pointer" }, "<td><strong>" + esc(rule.name) + "</strong></td><td class='muted'>" + esc(rule.source || "Local") + "</td><td class='num'>" + (counts[rule.id] || 0) + "</td><td class='num'>" + ((rule.steps || []).length) + "</td><td><span class='badge " + (v.valid ? "ok" : "danger") + "'>" + (v.valid ? "QA pass" : "Review math") + "</span></td><td class='right'></td>");
      tr.addEventListener("click", function () { ui.selectedRuleId = rule.id; render(); });
      if (canEdit()) {
        tr.querySelector("td.right").appendChild(mkBtn("Edit", "btn sm", function (e) { if (e) e.stopPropagation(); openRuleSchemaEditor(rule); }));
        tr.querySelector("td.right").appendChild(mkBtn("Delete", "btn sm danger", function (e) { if (e) e.stopPropagation(); confirmModal("Delete rules-of-credit schema?", "'" + rule.name + "' will be removed and unassigned from work items using it.", function () { mutate(function () { deleteRuleOfCredit(rule.id); ui.selectedRuleId = ""; }); toast("Schema deleted", "ok"); }); }));
      }
      stb.appendChild(tr);
    });
    summary.appendChild(stb);
    panel.appendChild(summary);

    var v = validations[selected.id] || { valid: false, totalPct: 0, finalReportedOutPct: 0 };
    var detail = el("div", { class: "panel panel-pad" });
    detail.innerHTML = "<div class='flex wrap mb'><div style='flex:1'><h2 style='font-size:15px;margin:0'>" + esc(selected.name) + "</h2><div class='muted'>" + esc(selected.source || "Local schema") + "</div></div><span class='badge " + (v.valid ? "ok" : "danger") + "'>" + (v.valid ? "QA pass" : "Review math") + "</span></div>";
    var tbl = el("table", { class: "table table-dense" });
    tbl.innerHTML = "<thead><tr><th class='num'>Increment %</th><th class='num'>Reported out %</th><th>Completion evidence</th><th class='num'>Math check</th></tr></thead>";
    var tb = el("tbody");
    (selected.steps || []).forEach(function (s) { tb.appendChild(el("tr", null, "<td class='num'>" + pct1(s.incrementPct) + "</td><td class='num'><strong>" + pct1(s.reportedOutPct) + "</strong></td><td>" + esc(s.description || "") + "</td><td class='num'>" + (s.mathCheckPct == null ? "" : pct1(s.mathCheckPct)) + "</td>")); });
    tb.appendChild(el("tr", null, "<td class='num'><strong>" + pct1(v.totalPct) + "</strong></td><td class='num'><strong>" + pct1(v.finalReportedOutPct) + "</strong></td><td class='muted'>Totals must finish at 100% reported out with auditable evidence.</td><td></td>"));
    tbl.appendChild(tb);
    detail.appendChild(tbl);
    if (canEdit()) {
      var actions = el("div", { class: "flex wrap mt" });
      actions.appendChild(mkBtn("Edit step table", "btn primary sm", function () { openRuleSchemaEditor(selected); }));
      actions.appendChild(mkBtn("Delete schema", "btn sm danger", function () { confirmModal("Delete rules-of-credit schema?", "'" + selected.name + "' will be removed and unassigned from work items using it.", function () { mutate(function () { deleteRuleOfCredit(selected.id); ui.selectedRuleId = ""; }); toast("Schema deleted", "ok"); }); }));
      detail.appendChild(actions);
    }
    panel.appendChild(detail);
    root.appendChild(panel);
  }



  /* ---------- Rules of Credit ---------- */
  VIEWS.rulescredit = function (root) {
    root.appendChild(pageHead("Rules of Credit", "Progress schemas tied to task execution type, with manager-created schemas for future projects."));
    var actions = el("div", { class: "flex wrap mb" });
    actions.appendChild(mkBtn("+ New schema", "btn primary sm", function () { openRuleSchemaEditor(); }));
    actions.appendChild(mkBtn("Restore default schemas", "btn sm", function () {
      if (!canEdit()) return toast("Viewer role is read-only", "err");
      confirmModal("Restore default rules of credit?", "Adds any missing Techniek PMO standard schemas. Existing schemas are left untouched.", function () {
        mutate(function () {
          state.rulesOfCredit = state.rulesOfCredit || [];
          var have = {};
          state.rulesOfCredit.forEach(function (r) { have[r.id] = true; });
          var added = 0;
          buildDefaultRulesOfCredit().forEach(function (r) { if (!have[r.id]) { state.rulesOfCredit.push(r); added++; } });
          toast(added ? added + " default schema(s) restored" : "All default schemas already present", "ok");
        });
      });
    }));
    root.appendChild(actions);
    renderRulesOfCredit(root);
  };
  function openRuleSchemaEditor(existing) {
    if (!canEdit()) return toast("Viewer role is read-only", "err");
    var isEdit = !!existing;
    var body = el("div");
    var rows = isEdit ? (existing.steps || []).slice() : [{ incrementPct: 5, reportedOutPct: 5, mathCheckPct: 5, description: "Preparer assigned or work authorized" }];
    function rowHtml(s) {
      return "<tr class='roc-step-row'><td class='num'><input class='input sm roc-inc' type='number' step='0.1' min='0' max='100' value='" + esc(s.incrementPct || 0) + "'></td>" +
        "<td class='num'><input class='input sm roc-out' type='number' step='0.1' min='0' max='100' value='" + esc(s.reportedOutPct || 0) + "'></td>" +
        "<td class='num'><input class='input sm roc-check' type='number' step='0.1' min='0' max='100' value='" + esc(s.mathCheckPct == null ? s.reportedOutPct || 0 : s.mathCheckPct) + "'></td>" +
        "<td><input class='input sm roc-desc' value='" + esc(s.description || "") + "' placeholder='Objective evidence required for this credit step'></td>" +
        "<td class='right'><button type='button' class='btn sm danger roc-delete-row'>Delete</button></td></tr>";
    }
    body.innerHTML = "<label class='field-label'>Schema name</label><input class='input' id='rocName' placeholder='Project report prep schema' value='" + esc(isEdit ? existing.name : "") + "'>" +
      "<div class='hint mt'>Edit rules as rows. The final reported-out value should be 100%, and each row should describe objective evidence for earning that credit.</div>" +
      "<div class='table-wrap mt'><table class='table table-dense rules-editor-table'><thead><tr><th class='num'>Increment %</th><th class='num'>Reported out %</th><th class='num'>Math check %</th><th>Completion evidence</th><th></th></tr></thead><tbody id='rocTableBody'>" + rows.map(rowHtml).join("") + "</tbody></table></div>" +
      "<button type='button' class='btn sm mt' id='rocAddRow'>+ Add row</button>";
    function bindDeleteButtons() {
      body.querySelectorAll(".roc-delete-row").forEach(function (btn) {
        btn.onclick = function () {
          var rowsNow = body.querySelectorAll(".roc-step-row");
          if (rowsNow.length <= 1) return toast("At least one rule row is required", "err");
          btn.closest("tr").remove();
        };
      });
    }
    modal(isEdit ? "Edit rules-of-credit schema" : "New rules-of-credit schema", body, [{ label: "Cancel", cls: "btn", fn: closeModal }, { label: isEdit ? "Save" : "Create", cls: "btn primary", fn: function () {
      var name = $("#rocName").value.trim();
      if (!name) return toast("Schema name is required", "err");
      var steps = [].slice.call(body.querySelectorAll(".roc-step-row")).map(function (row, i) {
        return { step: i + 1, incrementPct: normHours(row.querySelector(".roc-inc").value), reportedOutPct: normHours(row.querySelector(".roc-out").value), mathCheckPct: normHours(row.querySelector(".roc-check").value), description: row.querySelector(".roc-desc").value.trim() };
      }).filter(function (s) { return s.description || s.incrementPct || s.reportedOutPct; });
      if (!steps.length) return toast("At least one schema row is required", "err");
      mutate(function () {
        var target = isEdit ? ruleById(existing.id) : { id: uid("roc"), source: "Manager-created" };
        target.name = name;
        target.steps = steps;
        target.totalPct = steps.reduce(function (a, s) { return a + normHours(s.incrementPct); }, 0);
        target.finalReportedOutPct = steps[steps.length - 1].reportedOutPct;
        if (!isEdit) state.rulesOfCredit.push(target);
        recordAudit("Rule of Credit", target.id, isEdit ? "Rule updated" : "Rule created", target.name);
      });
      closeModal(); toast(isEdit ? "Schema saved" : "Schema created", "ok");
    } }], "sm");
    bindDeleteButtons();
    var add = $("#rocAddRow");
    if (add) add.addEventListener("click", function () {
      $("#rocTableBody").insertAdjacentHTML("beforeend", rowHtml({ incrementPct: 0, reportedOutPct: 0, mathCheckPct: 0, description: "" }));
      bindDeleteButtons();
    });
  }


  /* ---------- Settings / Data ---------- */
  VIEWS.settings = function (root) {
    root.appendChild(pageHead("Settings & Data", "Local-first workspace controls. Export before clearing browser data."));

    root.appendChild(el("div", { class: "warn-banner mb" },
      "⚠ Prototype / local-first app. Do not use for CUI, export-controlled, classified, proprietary client, or sensitive employee data until enterprise authentication, access control, encryption, and security review are implemented. Data is stored in this browser via localStorage unless exported."));

    var grid = el("div", { class: "grid cols-2" });

    var dataPanel = el("div", { class: "panel panel-pad" });
    dataPanel.appendChild(el("h2", null, "Workspace data"));
    dataPanel.appendChild(el("p", { class: "muted" }, "Schema version " + esc(state.version) + " · last saved " + new Date(state.savedAt).toLocaleString()));
    var row = el("div", { class: "flex wrap mt" });
    row.appendChild(mkBtn("⬇ Export JSON", "btn", exportJSON));
    if (canEdit()) row.appendChild(mkBtn("⬆ Import JSON", "btn", importJSONPrompt));
    row.appendChild(mkBtn("⬇ Reports CSV", "btn", exportReportCSV));
    dataPanel.appendChild(row);
    var row2 = el("div", { class: "flex wrap mt" });
    if (!canEdit()) dataPanel.appendChild(el("div", { class: "hint mt" }, "Viewer role can export data for review; import, reset, and clear actions are disabled."));
    if (canEdit()) row2.appendChild(mkBtn("↻ Reset demo data", "btn", function () {
      confirmModal("Reset demo data?", "This replaces the current workspace with the fictional Techniek sample. Export first if you want a backup.", function () {
        snapshot(); state = demoWorkspace(); commit(); toast("Demo workspace restored", "ok");
      });
    }));
    if (canEdit()) row2.appendChild(mkBtn("🗑 Clear local data", "btn danger", function () {
      confirmModal("Clear all local data?", "This permanently removes the workspace from this browser. This cannot be undone except via a JSON backup.", function () {
        localStorage.removeItem(STORAGE_KEY); state = demoWorkspace(); undoStack.length = 0; redoStack.length = 0; commit(); toast("Local data cleared", "ok");
      });
    }));
    dataPanel.appendChild(row2);
    grid.appendChild(dataPanel);

    var prefPanel = el("div", { class: "panel panel-pad" });
    prefPanel.appendChild(el("h2", null, "Preferences"));
    var themeRow = el("div", { class: "form-row" });
    themeRow.innerHTML = "<label class='field-label inline'>Theme</label>";
    var themeSel = el("select", { class: "select" }, "<option value='light'>Light</option><option value='dark'>Dark</option>");
    themeSel.value = state.settings.theme;
    themeSel.addEventListener("change", function () { mutate(function () { state.settings.theme = themeSel.value; }); });
    themeRow.appendChild(themeSel);
    prefPanel.appendChild(themeRow);

    var roleRow = el("div", { class: "form-row mt" });
    roleRow.innerHTML = "<label class='field-label inline'>Simulated role</label>";
    var roleSel = el("select", { class: "select" }, ROLES.map(function (r) { return "<option" + (r === role() ? " selected" : "") + ">" + esc(r) + "</option>"; }).join(""));
    if (!canConfigureWorkspace()) roleSel.setAttribute("disabled", "disabled");
    roleSel.addEventListener("change", function () { if (!canConfigureWorkspace()) return; mutate(function () { state.settings.role = roleSel.value; }); });
    roleRow.appendChild(roleSel);
    prefPanel.appendChild(roleRow);
    if (!canConfigureWorkspace()) prefPanel.appendChild(el("div", { class: "hint" }, "Viewer role cannot change the simulated role or workspace policy settings."));

      var autoRow = el("div", { class: "form-row mt" });
      autoRow.innerHTML = "<label class='field-label inline'><input type='checkbox' id='autoKanbanCredit'" + (state.settings.autoProgressFromKanban ? " checked" : "") + (canConfigureWorkspace() ? "" : " disabled") + "> Auto-credit Kanban Stage progress when cards move between columns (Manual Physical % and Rules of Credit are never overwritten)</label>";
      if (canConfigureWorkspace()) autoRow.querySelector("input").addEventListener("change", function () { mutate(function () { state.settings.autoProgressFromKanban = $("#autoKanbanCredit").checked; }); });
      var wipRow = el("div", { class: "form-row mt" });
      wipRow.innerHTML = "<label class='field-label inline'>Kanban WIP policy</label><select class='select' id='wipPolicySel'" + (canConfigureWorkspace() ? "" : " disabled") + "><option value='hard'" + ((state.settings.wipPolicy || "hard") === "hard" ? " selected" : "") + ">Hard limit (block over-WIP pulls)</option><option value='soft'" + (state.settings.wipPolicy === "soft" ? " selected" : "") + ">Soft warning (allow over-WIP)</option></select>";
    if (canConfigureWorkspace()) wipRow.querySelector("select").addEventListener("change", function () { mutate(function () { state.settings.wipPolicy = $("#wipPolicySel").value === "soft" ? "soft" : "hard"; }); });
    prefPanel.appendChild(autoRow);
    prefPanel.appendChild(wipRow);
    prefPanel.appendChild(el("div", { class: "hint mt" }, "Hard WIP enforces Kanban pull limits. Manual Physical % and Rules of Credit never lose progress on a column move; only Kanban Stage mode auto-credits."));

    if (canFinance()) {
      var cmRow = el("div", { class: "form-row mt" });
      cmRow.innerHTML = "<label class='field-label inline'>Target contribution margin (%)</label>";
      var cmInput = el("input", { class: "input", type: "number", min: "0", max: "99.9", step: "0.1", value: pct1(targetContributionMarginRatio() * 100).replace("%", "") });
      cmInput.addEventListener("change", function () {
        var v = clamp(parseFloat(cmInput.value) || 0, 0, 99.9);
        cmInput.value = pct1(v).replace("%", "");
        mutate(function () { state.settings.targetContributionMarginPct = v; });
      });
      cmRow.appendChild(cmInput);
      prefPanel.appendChild(cmRow);
      prefPanel.appendChild(el("div", { class: "hint mt" }, "Projects view highlights CM green at/above target, yellow within 10 percentage points below, and red below that. " + pct1(DEFAULT_TARGET_CM_PCT) + " is the 3.0x multiplier benchmark."));
    }
    prefPanel.appendChild(el("div", { class: "hint mt" }, "Financial views (cost, margin, burn) are visible only to: " + FINANCIAL_ROLES.join(", ") + "."));
    grid.appendChild(prefPanel);


    var fabricPanel = el("div", { class: "panel panel-pad" });
    fabricPanel.appendChild(el("h2", null, "Microsoft Fabric data connector"));
    fabricPanel.appendChild(el("p", { class: "muted" }, "Access point for ERMAS and accounting data hosted in Microsoft Fabric. Store only the Fabric workspace, lakehouse, warehouse, semantic model, or report URL here; credentials remain in Microsoft Entra / Fabric."));
    var fabricRow = el("div", { class: "form-row" });
    fabricRow.innerHTML = "<label class='field-label inline'>Fabric ERMAS / Accounting data URL</label>";
    var fabricInput = el("input", { class: "input", placeholder: "https://app.fabric.microsoft.com/...", value: (state.integrationSettings || {}).fabricErmasAccountingUrl || "" });
    if (role() !== "Admin") fabricInput.setAttribute("disabled", "disabled");
    fabricInput.addEventListener("change", function () {
      mutate(function () {
        state.integrationSettings = state.integrationSettings || {};
        state.integrationSettings.fabricErmasAccountingUrl = fabricInput.value.trim();
      });
    });
    fabricRow.appendChild(fabricInput);
    fabricPanel.appendChild(fabricRow);
    var fabricActions = el("div", { class: "flex wrap mt" });
    var fabricUrl = ((state.integrationSettings || {}).fabricErmasAccountingUrl || "").trim();
    var fabricOpen = el("a", { class: "btn primary" + (fabricUrl ? "" : " disabled"), href: fabricUrl || "#", target: "_blank", rel: "noopener noreferrer" }, "Open Fabric data");
    if (!fabricUrl) {
      fabricOpen.setAttribute("aria-disabled", "true");
      fabricOpen.addEventListener("click", function (e) { e.preventDefault(); toast("Add the Microsoft Fabric ERMAS / Accounting URL first", "err"); });
    }
    fabricActions.appendChild(fabricOpen);
    fabricActions.appendChild(el("span", { class: "hint" }, role() === "Admin" ? "Admins can edit this link; access is still controlled by Microsoft Fabric permissions." : "Only Admins can edit this link; Fabric permissions control access."));
    fabricPanel.appendChild(fabricActions);
    grid.appendChild(fabricPanel);

    if (role() === "Admin") {
      var apiPanel = el("div", { class: "panel panel-pad" });
      apiPanel.appendChild(el("h2", null, "Backend API configuration"));
      apiPanel.appendChild(el("p", { class: "muted" }, "Backend-ready connector settings. OpenAI keys are server-side only; use server/.env.local for the local proxy."));
      var epRow = el("div", { class: "form-row" });
      epRow.innerHTML = "<label class='field-label inline'>API endpoint</label>";
      var ep = el("input", { class: "input", placeholder: "https://api.example.com/opsboard", value: state.settings.apiEndpoint || "" });
      ep.addEventListener("change", function () { mutate(function () { state.settings.apiEndpoint = ep.value.trim(); }); });
      epRow.appendChild(ep);
      apiPanel.appendChild(epRow);
      var pmRow = el("div", { class: "form-row mt" });
      pmRow.innerHTML = "<label class='field-label inline'>PM Specialist proxy</label>";
      var pmEp = el("input", { class: "input", placeholder: PM_SPECIALIST_PROXY_DEFAULT, value: state.settings.pmSpecialistEndpoint || PM_SPECIALIST_PROXY_DEFAULT });
      pmEp.addEventListener("change", function () { mutate(function () { state.settings.pmSpecialistEndpoint = pmEp.value.trim() || PM_SPECIALIST_PROXY_DEFAULT; }); });
      pmRow.appendChild(pmEp);
      apiPanel.appendChild(pmRow);
      var vsRow = el("div", { class: "form-row mt" });
      vsRow.innerHTML = "<label class='field-label inline'>OpenAI vector store ID</label>";
      var vs = el("input", { class: "input", value: state.settings.openAiVectorStoreId || OPENAI_VECTOR_STORE_ID });
      vs.addEventListener("change", function () { mutate(function () { state.settings.openAiVectorStoreId = vs.value.trim() || OPENAI_VECTOR_STORE_ID; }); });
      vsRow.appendChild(vs);
      apiPanel.appendChild(vsRow);
      apiPanel.appendChild(el("div", { class: "hint mt" }, secretWarning()));
      grid.appendChild(apiPanel);
    }

    root.appendChild(grid);

    // Account & access
    var acctPanel = el("div", { class: "panel panel-pad mt" });
    var cu = currentUser();
    acctPanel.appendChild(el("h2", null, "Account & access"));
    acctPanel.appendChild(el("p", { class: "muted" },
      "Signed in as " + (cu ? cu.displayName + " (" + cu.role + ")" : "guest") + ". Each profile keeps its own boards and workspace data in this browser."));
    var acctRow = el("div", { class: "flex wrap mt" });
    acctRow.appendChild(mkBtn("🔌 Sign out", "btn", function () { logout(); }));
    acctRow.appendChild(mkBtn("👤 Switch / add profile", "btn", function () { renderAuthGate(cu && cu.id); }));
    if (cu) acctRow.appendChild(mkBtn(cu.hasPass ? "🔑 Change passphrase" : "🔑 Set passphrase", "btn", function () { changePassphrase(cu); }));
    acctPanel.appendChild(acctRow);
    // User roster
    if (accounts.users.length > 1) {
      var ut = el("table", { class: "table mt" });
      ut.innerHTML = "<thead><tr><th>Profile</th><th>Role</th><th>Secured</th><th></th></tr></thead>";
      var utb = el("tbody");
      accounts.users.forEach(function (u) {
        var tr = el("tr");
        tr.innerHTML = "<td><strong>" + esc(u.displayName) + "</strong>" + (u.id === accounts.currentUserId ? " <span class='badge ok'>you</span>" : "") + "</td><td class='muted'>" + esc(u.role) + "</td><td>" + (u.hasPass ? "🔒 passphrase" : "—") + "</td><td class='right'></td>";
        if (u.id !== accounts.currentUserId) {
          var del = el("button", { class: "btn sm danger" }, "Delete");
          del.addEventListener("click", function () { deleteUser(u); });
          tr.querySelector("td.right").appendChild(del);
        }
        utb.appendChild(tr);
      });
      ut.appendChild(utb); acctPanel.appendChild(ut);
    }
    acctPanel.appendChild(el("div", { class: "warn-banner mt" },
      "Local profiles are a convenience gate, not enterprise security. Enterprise SSO (OIDC/SAML) requires a backend and is tracked in the improvement backlog."));
    root.appendChild(acctPanel);

    // Import & Plan a Board from a file
    var planPanel = el("div", { class: "panel panel-pad mt" });
    planPanel.appendChild(el("h2", null, "Import & plan a board from a file"));
    planPanel.appendChild(el("p", { class: "muted" },
      "Upload a project file - Techniek OpsBoard extracts the PM fields and builds a ready-to-run board. Supports CSV / TSV (task lists), JSON (task arrays or full workspace exports), and Markdown / text (briefs with headings and bullet/checkbox tasks). Files are parsed entirely in your browser; nothing is uploaded to a server."));
    var planRow = el("div", { class: "flex wrap mt" });
    if (canEdit()) planRow.appendChild(mkBtn("📄 Upload & plan board", "btn primary", function () { importAndPlanPrompt(); }));
    planRow.appendChild(mkBtn("⬇ Download CSV template", "btn", downloadCsvTemplate));
    planPanel.appendChild(planRow);
    if (!canEdit()) planPanel.appendChild(el("div", { class: "warn-banner mt" }, "Viewer role is read-only — board import is disabled."));
    root.appendChild(planPanel);

    // Scale / performance testing for large boards (edit roles only).
    if (canEdit()) {
      var scalePanel = el("div", { class: "panel panel-pad mt" });
      scalePanel.appendChild(el("h2", null, "Scale & performance"));
      scalePanel.appendChild(el("p", { class: "muted" }, "Boards stay responsive at high card counts via windowed column rendering, collapsible columns, and compact density. Generate a synthetic load to see it in action."));
      var scaleRow = el("div", { class: "flex wrap mt" });
      scaleRow.appendChild(mkBtn("➕ Add 200 demo cards", "btn", function () { generateLoadCards(200); }));
      scaleRow.appendChild(mkBtn("🧹 Remove generated cards", "btn", removeLoadCards));
      scalePanel.appendChild(scaleRow);
      root.appendChild(scalePanel);
    }

    var statsPanel = el("div", { class: "panel panel-pad mt" });
    statsPanel.appendChild(el("h2", null, "Workspace summary"));
    statsPanel.innerHTML += "<div class='grid cols-4'>" +
      statCardHTML("Boards", state.boards.length, "") +
      statCardHTML("Projects", state.projects.length, "") +
      statCardHTML("Cards", state.cards.length, "") +
      statCardHTML("Resources", state.resources.length, "") + "</div>";
    root.appendChild(statsPanel);
  };

  /* ---------- Help ---------- */
  VIEWS.help = function (root) {
    root.appendChild(pageHead("Help", "Quick reference for Techniek OpsBoard Pro V2."));
    var grid = el("div", { class: "grid cols-2" });

    var kb = el("div", { class: "panel panel-pad" });
    kb.innerHTML = "<h2>Keyboard shortcuts</h2>" +
      "<table class='table'><tbody>" +
      row2cell("<span class='kbd'>N</span>", "New card") +
      row2cell("<span class='kbd'>/</span>", "Focus search") +
      row2cell("<span class='kbd'>Esc</span>", "Close dialog / search") +
      row2cell("<span class='kbd'>Ctrl/⌘ + Z</span>", "Undo") +
      row2cell("<span class='kbd'>Ctrl/⌘ + Shift + Z</span>", "Redo") +
      row2cell("<span class='kbd'>?</span>", "Open this help") +
      "</tbody></table>";
    grid.appendChild(kb);

    var feat = el("div", { class: "panel panel-pad" });
    feat.innerHTML = "<h2>What's inside</h2>" +
      "<ul class='muted' style='line-height:1.9;padding-left:18px'>" +
      "<li><strong>Multi-user profiles</strong> with local sign-in/out, isolated workspaces, optional passphrase, and an enterprise-SSO entry point</li>" +
      "<li>Drag-and-drop Kanban with editable, reorderable columns and WIP limits</li>" +
      "<li><strong>Scales to 200+ cards</strong>: windowed columns, collapse, compact density, board filter, and <strong>per-stage filters</strong></li>" +
      "<li>Full card detail: assignee, priority, type, labels, dates, effort, checklist, dependencies, activity</li>" +
      "<li><strong>Gantt &amp; critical path</strong> over dated work and dependencies</li>" +
      "<li><strong>Risk register</strong> (PMBOK): probability × impact matrix, response strategy, ownership</li>" +
      "<li><strong>Project administration & integrated change control</strong>: add/edit/delete projects; raise change orders that adjust budget, schedule, and scope on approval</li>" +
      "<li>Resource utilization with a 4-week forecast</li>" +
      "<li>Project <strong>and program</strong> rollups + <strong>Earned Value Management</strong> (CPI, SPI, EAC, VAC) in the manager report</li>" +
      "<li><strong>Live report sync</strong> — stage position drives % complete, so moving a card updates EV, rollups, billing, and resources</li>" +
      "<li>Manager report (full financials) and client report (financials hidden)</li>" +
      "<li><strong>Import &amp; plan a board from a file</strong> (CSV / JSON / Markdown)</li>" +
      "<li>Role-based visibility, dark mode, undo/redo, JSON/CSV import &amp; export</li>" +
      "</ul>";
    grid.appendChild(feat);
    root.appendChild(grid);

    root.appendChild(el("div", { class: "flex mt", style: "justify-content:space-between" },
      "<span class='warn-banner' style='flex:1'>Local-first prototype. Sensitive data should not be entered until enterprise authentication and security review are complete.</span>"));
    root.appendChild(el("div", { class: "faint mt", style: "font-size:12px" }, "Techniek OpsBoard Pro V2 - version " + APP_VERSION + " - schema " + SCHEMA_VERSION));
  };

  /* ----------------------------------------------------------------------- *
   * Reusable render helpers
   * ----------------------------------------------------------------------- */
  function pageHead(title, sub) {
    var h = el("div", { class: "page-head" });
    h.innerHTML = "<div><h1>" + esc(title) + "</h1><p>" + esc(sub) + "</p></div><div class='spacer'></div><div class='head-actions'></div>";
    return h;
  }
  function statCard(label, value, sub, cls) {
    return el("div", { class: "stat" },
      "<div class='stat-label'>" + esc(label) + "</div><div class='stat-value " + (cls || "") + "'>" + esc(value) + "</div>" + (sub ? "<div class='stat-sub'>" + esc(sub) + "</div>" : ""));
  }
  function statCardHTML(label, value, sub) {
    return "<div class='stat'><div class='stat-label'>" + esc(label) + "</div><div class='stat-value'>" + esc(value) + "</div>" + (sub ? "<div class='stat-sub'>" + esc(sub) + "</div>" : "") + "</div>";
  }
  function row2cell(a, b) { return "<tr><td style='width:160px'>" + a + "</td><td class='muted'>" + esc(b) + "</td></tr>"; }
  function mkBtn(label, cls, fn) { var b = el("button", { class: cls }, label); b.addEventListener("click", fn); return b; }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function columnName(c) {
    var b = state.boards.filter(function (x) { return x.id === c.boardId; })[0];
    if (!b) return "";
    var col = b.columns.filter(function (x) { return x.id === c.columnId; })[0];
    return col ? col.name : "";
  }

  /* ---------- Charts (inline SVG) ---------- */
  function stageBarChart(b) {
    var data = b.columns.map(function (col) {
      return { name: col.name, n: boardCards(b.id).filter(function (c) { return c.columnId === col.id; }).length };
    });
    var max = Math.max(1, Math.max.apply(null, data.map(function (d) { return d.n; })));
    var w = 460, h = 200, pad = 28, bw = (w - pad * 2) / data.length;
    var svg = '<svg viewBox="0 0 ' + w + " " + h + '" width="100%" role="img" aria-label="Cards per stage">';
    data.forEach(function (d, i) {
      var bh = (d.n / max) * (h - pad * 2);
      var x = pad + i * bw + 6;
      var y = h - pad - bh;
      svg += '<rect x="' + x + '" y="' + y + '" width="' + (bw - 12) + '" height="' + bh + '" rx="5" fill="var(--brand)"></rect>';
      svg += '<text x="' + (x + (bw - 12) / 2) + '" y="' + (y - 6) + '" text-anchor="middle" font-size="12" fill="var(--text)">' + d.n + "</text>";
      svg += '<text x="' + (x + (bw - 12) / 2) + '" y="' + (h - 8) + '" text-anchor="middle" font-size="10" fill="var(--text-faint)">' + esc(d.name.slice(0, 8)) + "</text>";
    });
    svg += "</svg>";
    var div = el("div"); div.innerHTML = svg; return div;
  }
  function lineChart(history) {
    var data = history.slice(-6);
    var w = 460, h = 200, pad = 30;
    var max = Math.max(1, Math.max.apply(null, data.map(function (d) { return d.total; })));
    var stepX = (w - pad * 2) / Math.max(1, data.length - 1);
    function x(i) { return pad + i * stepX; }
    function y(v) { return h - pad - (v / max) * (h - pad * 2); }
    var pts = data.map(function (d, i) { return x(i) + "," + y(d.completed); }).join(" ");
    var area = "M" + x(0) + "," + (h - pad) + " L" + pts.split(" ").join(" L") + " L" + x(data.length - 1) + "," + (h - pad) + " Z";
    var svg = '<svg viewBox="0 0 ' + w + " " + h + '" width="100%" role="img" aria-label="Completion trend">';
    svg += '<line x1="' + pad + '" y1="' + (h - pad) + '" x2="' + (w - pad) + '" y2="' + (h - pad) + '" stroke="var(--border)"></line>';
    svg += '<path d="' + area + '" fill="var(--brand-soft)" opacity="0.7"></path>';
    svg += '<polyline points="' + pts + '" fill="none" stroke="var(--brand)" stroke-width="2.5"></polyline>';
    data.forEach(function (d, i) {
      svg += '<circle cx="' + x(i) + '" cy="' + y(d.completed) + '" r="3.5" fill="var(--brand)"></circle>';
      svg += '<text x="' + x(i) + '" y="' + (h - 10) + '" text-anchor="middle" font-size="10" fill="var(--text-faint)">' + fmtDate(d.week) + "</text>";
    });
    svg += "</svg>";
    var div = el("div"); div.innerHTML = svg;
    div.appendChild(el("div", { class: "chart-legend" }, "<span><span class='tag-dot' style='background:var(--brand)'></span> Cards completed of " + data[data.length - 1].total + "</span>"));
    return div;
  }
  function moneyShort(n) {
    if (n == null || !isFinite(n)) return "—";
    var abs = Math.abs(n);
    if (abs >= 1000000) return "$" + num2(n / 1000000) + "M";
    if (abs >= 1000) return "$" + Math.round(n / 1000) + "k";
    return money(n);
  }
  function fvEacChart(rows, visible, timeline) {
    var data = rows || [];
    var w = 760, h = 300, padL = 58, padR = 20, padT = 22, padB = 42;
    var vals = [];
    data.forEach(function (r) {
      if (visible.fv) vals.push(r.fundedValue);
      if (visible.target) vals.push(r.targetCostBudget);
      if (visible.bill && r.billEAC != null) vals.push(r.billEAC);
      if (visible.cost) vals.push(r.costEAC);
    });
    var max = Math.max(1, Math.max.apply(null, vals.concat([1])) * 1.1);
    var innerW = w - padL - padR;
    // Prefer a real calendar x-axis spanning the project's baseline start→finish
    // (from the Kanban card baselines). Fall back to even index spacing.
    var t0 = timeline && timeline.start ? Date.parse(timeline.start) : NaN;
    var t1 = timeline && timeline.end ? Date.parse(timeline.end) : NaN;
    var useTime = isFinite(t0) && isFinite(t1) && t1 > t0;
    var stepX = innerW / Math.max(1, data.length - 1);
    function x(i) {
      if (useTime) {
        var t = Date.parse(data[i].date);
        var f = isFinite(t) ? (t - t0) / (t1 - t0) : 0;
        return padL + Math.max(0, Math.min(1, f)) * innerW;
      }
      return padL + i * stepX;
    }
    function y(v) { return h - padB - ((v || 0) / max) * (h - padT - padB); }
    function stepPath(field) {
      if (!data.length) return "";
      var d = "M" + x(0) + "," + y(data[0][field]);
      for (var i = 1; i < data.length; i++) d += " H" + x(i) + " V" + y(data[i][field]);
      return d;
    }
    function pointSeries(field, color) {
      return data.map(function (r, i) {
        if (r[field] == null) return "";
        var title = r.date + "\n" + r.event + "\n" + field + ": " + money(r[field]);
        return '<circle cx="' + x(i) + '" cy="' + y(r[field]) + '" r="4" fill="' + color + '"><title>' + esc(title) + "</title></circle>";
      }).join("");
    }
    function stepMarkers(field, color) {
      return data.map(function (r, i) {
        var title = r.date + "\n" + r.event + "\n" + field + ": " + money(r[field]);
        return '<circle cx="' + x(i) + '" cy="' + y(r[field]) + '" r="3" fill="' + color + '"><title>' + esc(title) + "</title></circle>";
      }).join("");
    }
    var svg = '<svg viewBox="0 0 ' + w + " " + h + '" width="100%" role="img" aria-label="FV and EAC history">';
    for (var g = 0; g <= 4; g++) {
      var gy = padT + g * (h - padT - padB) / 4, val = max * (1 - g / 4);
      svg += '<line x1="' + padL + '" y1="' + gy + '" x2="' + (w - padR) + '" y2="' + gy + '" stroke="var(--border)"></line>';
      svg += '<text x="8" y="' + (gy + 4) + '" font-size="10" fill="var(--text-faint)">' + moneyShort(val) + "</text>";
    }
    if (visible.fv) svg += '<path d="' + stepPath("fundedValue") + '" fill="none" stroke="#0f766e" stroke-width="2.5"><title>Funded Value step history</title></path>' + stepMarkers("fundedValue", "#0f766e");
    if (visible.target) svg += '<path d="' + stepPath("targetCostBudget") + '" fill="none" stroke="#1d4ed8" stroke-width="2.5"><title>Target Cost Budget step history</title></path>' + stepMarkers("targetCostBudget", "#1d4ed8");
    if (visible.bill) svg += pointSeries("billEAC", "#16a34a");
    if (visible.cost) svg += pointSeries("costEAC", "#818cf8");
    var n = data.length;
    var maxLabels = Math.max(2, Math.floor(innerW / 82));
    if (useTime) {
      // Even calendar ticks across the whole project timeline (start → finish).
      var ticks = Math.max(2, Math.min(maxLabels, 8));
      for (var k = 0; k < ticks; k++) {
        var f = k / (ticks - 1);
        var xx = padL + f * innerW;
        var tickIso = new Date(t0 + f * (t1 - t0)).toISOString().slice(0, 10);
        var anchorK = k === 0 ? "start" : k === ticks - 1 ? "end" : "middle";
        svg += '<line x1="' + xx + '" y1="' + padT + '" x2="' + xx + '" y2="' + (h - padB) + '" stroke="var(--border)" stroke-dasharray="2 4" opacity="0.5"></line>';
        svg += '<text x="' + xx + '" y="' + (h - 12) + '" text-anchor="' + anchorK + '" font-size="9" fill="var(--text-faint)">' + esc(fmtDate(tickIso)) + "</text>";
      }
    } else {
      // No usable schedule: thin per-event labels so they stay legible.
      var every = Math.max(1, Math.ceil((n - 1) / (maxLabels - 1)));
      var labelIdx = [];
      for (var li = 0; li < n; li += every) labelIdx.push(li);
      if (n > 1 && labelIdx[labelIdx.length - 1] !== n - 1) {
        if ((n - 1) - labelIdx[labelIdx.length - 1] < every) labelIdx[labelIdx.length - 1] = n - 1;
        else labelIdx.push(n - 1);
      }
      labelIdx.forEach(function (i) {
        var anchor = i === 0 ? "start" : i === n - 1 ? "end" : "middle";
        svg += '<text x="' + x(i) + '" y="' + (h - 12) + '" text-anchor="' + anchor + '" font-size="9" fill="var(--text-faint)">' + esc(fmtDate(data[i].date)) + "</text>";
      });
    }
    svg += "</svg>";
    var div = el("div");
    div.innerHTML = svg;
    div.appendChild(el("div", { class: "chart-legend" },
      (visible.target ? "<span><span class='tag-dot' style='background:#1d4ed8'></span> Target Cost Budget</span>" : "") +
      (visible.bill ? "<span><span class='tag-dot' style='background:#16a34a'></span> Bill EAC</span>" : "") +
      (visible.cost ? "<span><span class='tag-dot' style='background:#818cf8'></span> Cost EAC</span>" : "") +
      (visible.fv ? "<span><span class='tag-dot' style='background:#0f766e'></span> Funded Value</span>" : "")));
    return div;
  }
  function renderProjectFinancialHistory(p) {
    var rows = projectFinancialHistory(p);
    var timeline = projectScheduleTimeline(p);
    var wrap = el("div", { class: "fv-eac-history" });
    if (!rows.length) { wrap.appendChild(el("div", { class: "empty" }, "No financial history yet.")); return wrap; }
    var isFP = projectBillingType(p) === "FP";
    var visible = { fv: !isFP, bill: !isFP, target: true, cost: true };
    var tableFields = { date: true, event: true, fundedValue: true, targetCostBudget: true, billEAC: true, costEAC: true, billingType: false };
    var chartHost = el("div", { class: "panel-pad" });
    var tableHost = el("div", { class: "panel-pad" });
    function check(label, key, checked) {
      var id = uid("f");
      return "<label class='chip label' for='" + id + "'><input id='" + id + "' type='checkbox' data-fveac='" + key + "'" + (checked ? " checked" : "") + "> " + esc(label) + "</label>";
    }
    function renderChart() {
      chartHost.innerHTML = "<h2 style='font-size:14px'>FV & EAC History</h2>" +
        "<div class='hint'>Plotted across the project's baseline schedule (start → finish from the Kanban card baselines). FV and Target Cost Budget are step histories from baseline/change-control events; Bill EAC and Cost EAC accrue on each activity's baseline finish.</div>" +
        "<div class='flex wrap mt'>" +
        check("Funded Value", "fv", visible.fv) + check("Bill EAC", "bill", visible.bill) + check("Target Cost Budget", "target", visible.target) + check("Cost EAC", "cost", visible.cost) +
        "</div>";
      chartHost.appendChild(fvEacChart(rows, visible, timeline));
    }
    function renderTable() {
      var labels = {
        date: "Modified Date", event: "Audit Event", fundedValue: "Funded Value",
        targetCostBudget: "Target Cost Budget", billEAC: "Bill EAC", costEAC: "Cost EAC", billingType: "Billing Type",
      };
      tableHost.innerHTML = "<h2 style='font-size:14px'>Dataset</h2><div class='flex wrap'>" +
        Object.keys(labels).map(function (k) { return "<label class='chip label'><input type='checkbox' data-fveac-table='" + k + "'" + (tableFields[k] ? " checked" : "") + "> " + esc(labels[k]) + "</label>"; }).join("") +
        "</div>";
      var cols = Object.keys(labels).filter(function (k) { return tableFields[k]; });
      var tbl = el("table", { class: "table mt" });
      tbl.innerHTML = "<thead><tr>" + cols.map(function (c) { return "<th" + (c === "event" || c === "date" || c === "billingType" ? "" : " class='num'") + ">" + esc(labels[c]) + "</th>"; }).join("") + "</tr></thead>";
      var tb = el("tbody");
      rows.forEach(function (r) {
        tb.appendChild(el("tr", null, cols.map(function (c) {
          var v = r[c];
          if (c === "date") v = fmtDate(v);
          else if (c !== "event" && c !== "billingType") v = v == null ? "—" : money(v);
          return "<td" + (c === "event" || c === "date" || c === "billingType" ? "" : " class='num'") + ">" + esc(v) + "</td>";
        }).join("")));
      });
      tbl.appendChild(tb);
      tableHost.appendChild(tbl);
    }
    wrap.appendChild(chartHost);
    wrap.appendChild(tableHost);
    renderChart();
    renderTable();
    wrap.addEventListener("change", function (e) {
      if (e.target.dataset.fveac) { visible[e.target.dataset.fveac] = e.target.checked; renderChart(); }
      if (e.target.dataset.fveacTable) { tableFields[e.target.dataset.fveacTable] = e.target.checked; renderTable(); }
    });
    return wrap;
  }
  function openProjectFinancialHistory(projectId) {
    if (!canFinance()) { toast("FV/EAC history is limited to manager roles", "err"); return; }
    var p = projectById(projectId);
    if (!p) return;
    var body = el("div");
    body.appendChild(renderProjectFinancialHistory(p));
    modal("FV & EAC History · " + p.name, body, [{ label: "Close", cls: "btn primary", fn: closeModal }]);
  }

  /* ----------------------------------------------------------------------- *
   * Drag & drop
   * ----------------------------------------------------------------------- */
  var dragCardId = null;
  function setupCardDnD(node, cardId) {
    node.addEventListener("dragstart", function (e) {
      dragCardId = cardId;
      node.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      try { e.dataTransfer.setData("text/plain", cardId); } catch (x) {}
    });
    node.addEventListener("dragend", function () { node.classList.remove("dragging"); dragCardId = null; });
  }
  function setupColumnDnD(body, colId) {
    var column = body.parentNode;
    body.addEventListener("dragover", function (e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      column.classList.add("drop-target");
    });
    body.addEventListener("dragleave", function (e) {
      if (!body.contains(e.relatedTarget)) column.classList.remove("drop-target");
    });
    body.addEventListener("drop", function (e) {
      e.preventDefault();
      column.classList.remove("drop-target");
      var id = dragCardId || e.dataTransfer.getData("text/plain");
      if (!id) return;
      var afterEl = cardAfterPoint(body, e.clientY);
      moveCard(id, colId, afterEl ? afterEl.dataset.card : null);
    });
  }
  function cardAfterPoint(body, y) {
    var cards = [].slice.call(body.querySelectorAll(".card:not(.dragging)"));
    var closest = null, closestOffset = -Infinity;
    cards.forEach(function (c) {
      var box = c.getBoundingClientRect();
      var offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closestOffset) { closestOffset = offset; closest = c; }
    });
    return closest;
  }

  function isClosingColumn(board, colId) {
    var col = (board.columns || []).filter(function (x) { return x.id === colId; })[0];
    if (!col) return false;
    return /done|accepted|approved|closed/i.test(col.name) || colId === board.columns[board.columns.length - 1].id;
  }
  function isTask3ActivityCode(code) { return /^E(10[2-9]0|1100|1110)$/i.test(String(code || "")); }
  function isTask3GateClosed(projectId) {
    return state.cards.filter(function (x) { return x.projectId === projectId && cardWbsCode(x) === "E1010"; }).some(isDone);
  }
  function dependencyCards(c) {
    var out = [];
    (c.deps || []).forEach(function (id) { var d = cardById(id); if (d) out.push(d); });
    (c.dependencyWbsCodes || []).forEach(function (code) {
      state.cards.filter(function (x) { return x.projectId === c.projectId && cardWbsCode(x).toUpperCase() === String(code || "").toUpperCase(); }).forEach(function (d) {
        if (!out.some(function (x) { return x.id === d.id; })) out.push(d);
      });
    });
    return out;
  }
  function hasEditableDependencyGate(c) {
    return !!(c && ((c.dependencyMode && c.dependencyMode !== "None") || (c.deps || []).length || (c.dependencyWbsCodes || []).length));
  }
  function dependencyBlockState(c) {
    var deps = dependencyCards(c);
    var mode = c.dependencyMode || "None";
    var open = /Blocks until closed/i.test(mode) ? deps.filter(function (d) { return !isDone(d); }) : [];
    return { deps: deps, open: open };
  }
  function dependencyBlockLabel(c) {
    var st = dependencyBlockState(c);
    return st.open.map(function (d) { return cardWbsCode(d) || d.title; }).join(", ");
  }
  function isTask3Blocked(c) {
    if (!c) return false;
    if (dependencyBlockState(c).open.length) return true;
    return isTask3ActivityCode(cardWbsCode(c)) && !hasEditableDependencyGate(c) && !isTask3GateClosed(c.projectId);
  }
  function cardMoveValidationMessage(c, targetColId) {
    var b = state.boards.filter(function (x) { return x.id === c.boardId; })[0] || activeBoard();
    var target = (b.columns || []).filter(function (x) { return x.id === targetColId; })[0] || {};
    var code = cardWbsCode(c);
    if (c.projectId && projectWbsElements(c.projectId).length) {
      if (!code) return "WBS / Schedule ID is required.";
      if (isLegacyWbsCode(code)) return "Legacy numeric WBS codes cannot be used as visible WBS / Schedule IDs.";
      if (!wbsByCode(c.projectId, code)) return "WBS / Schedule ID " + code + " is not in this project's WBS.";
      if (c.scheduleActivityId && code !== c.scheduleActivityId) return "Schedule activity cards must use the same WBS Code and Schedule Activity ID.";
    }
    var depState = dependencyBlockState(c);
    if (depState.open.length && /ready|in progress|review|approved|closed/i.test(target.name)) return "This card is blocked until dependency work item(s) close: " + dependencyBlockLabel(c) + ".";
    if (isTask3ActivityCode(code) && !hasEditableDependencyGate(c) && /ready|in progress|review|approved|closed/i.test(target.name) && !isTask3GateClosed(c.projectId)) return "Task 3 execution is blocked until E1010 is Approved / Closed.";
    if (isClosingColumn(b, targetColId) && c.projectId && projectWbsElements(c.projectId).length) {
      if (c.billingMilestone && !c.acceptanceEvidence && !c.completionEvidence) return "Billing milestone cards require acceptance or completion evidence before closure.";
      if ((!c.definitionOfDone || !c.evidenceRequired) || (!c.acceptanceEvidence && !c.completionEvidence)) return "Closed cards require definition of done, required evidence, and completion or acceptance evidence.";
    }
    // Kanban pull-system WIP: hard policy blocks a move that would exceed the target stage limit.
    if (c.columnId !== targetColId && (target.wip || 0) > 0) {
      var inTarget = boardCards(b.id).filter(function (x) { return x.columnId === targetColId && x.id !== c.id; }).length;
      if (inTarget + 1 > target.wip) {
        var policy = (state.settings && state.settings.wipPolicy) || "hard";
        if (policy === "hard") {
          return "WIP limit reached on " + (target.name || "stage") + " (" + inTarget + "/" + target.wip + "). Finish or pull work out before starting more (Kanban pull system).";
        }
      }
    }
    return "";
  }

  function moveCard(cardId, colId, beforeCardId) {
    var c = cardById(cardId);
    if (!c) return;
    var b = state.boards.filter(function (x) { return x.id === c.boardId; })[0] || activeBoard();
    var gate = cardMoveValidationMessage(c, colId);
    if (gate) { toast(gate, "err"); return false; }
    var changedCol = c.columnId !== colId;
    // Soft WIP: allow the move but surface the over-limit condition.
    if (changedCol) {
      var targetCol = (b.columns || []).filter(function (x) { return x.id === colId; })[0];
      if (targetCol && (targetCol.wip || 0) > 0) {
        var inTarget = boardCards(b.id).filter(function (x) { return x.columnId === colId && x.id !== cardId; }).length;
        if (inTarget + 1 > targetCol.wip && ((state.settings && state.settings.wipPolicy) || "hard") === "soft") {
          toast("WIP soft warning: " + targetCol.name + " will be " + (inTarget + 1) + "/" + targetCol.wip, "warn");
        }
      }
    }
    mutate(function () {
      c.columnId = colId;
      // Reorder: assign sequential order among cards in this column.
      var siblings = boardCards(b.id).filter(function (x) { return x.columnId === colId && x.id !== cardId; })
        .sort(function (a, d) { return a.order - d.order; });
      var insertAt = beforeCardId ? siblings.map(function (s) { return s.id; }).indexOf(beforeCardId) : siblings.length;
      if (insertAt < 0) insertAt = siblings.length;
      siblings.splice(insertAt, 0, c);
      siblings.forEach(function (s, i) { s.order = i; });
      // Stage drives percent-complete ONLY for Kanban Stage mode (and when the
      // global auto-credit setting is on). Manual Physical % and Rules of Credit
      // retain their governed progress — otherwise a drag silently corrupts EV.
      if (changedCol) {
        var nm = (b.columns.filter(function (x) { return x.id === colId; })[0] || {}).name;
        var last = b.columns[b.columns.length - 1];
        var mode = c.progressMode || "Kanban Stage";
        var autoOk = !!(state.settings && state.settings.autoProgressFromKanban);
        if (autoOk && mode === "Kanban Stage") {
          c.progress = stageProgress(b, colId);
          c.physicalProgress = c.progress;
          logActivity(c, "Moved to " + nm + (colId === last.id ? " (completed)" : " (" + c.progress + "%)"));
        } else {
          logActivity(c, "Moved to " + nm + " (progress retained by " + mode + ")");
        }
      }
    });
  }
  // Percent-complete implied by a card's stage position: first column 0%, last 100%.
  function stageProgress(b, colId) {
    var idx = b.columns.map(function (x) { return x.id; }).indexOf(colId);
    var n = b.columns.length;
    if (idx < 0) return 0;
    if (n <= 1) return idx === 0 ? 100 : 0;
    return Math.round((idx / (n - 1)) * 100);
  }
  function logActivity(c, text) {
    c.activity = c.activity || [];
    c.activity.unshift({ text: text, ts: Date.now() });
  }

  /* ----------------------------------------------------------------------- *
   * Column operations
   * ----------------------------------------------------------------------- */
  function addColumn() {
    mutate(function () { activeBoard().columns.push({ id: uid("col"), name: "New Column", wip: 0 }); });
  }
  function columnMenu(b, col) {
    var idx = b.columns.indexOf(col);
    var body = el("div");
    body.innerHTML =
      "<div class='form-row'><label class='field-label inline'>Column name</label><input class='input' id='cmName' value='" + esc(col.name) + "'></div>" +
      "<div class='form-row mt'><label class='field-label inline'>WIP limit (0 = none)</label><input class='input' id='cmWip' type='number' min='0' value='" + (col.wip || 0) + "'></div>";
    var foot = [
      { label: "Move ◀", cls: "btn sm", fn: function () { if (idx > 0) mutate(function () { b.columns.splice(idx - 1, 0, b.columns.splice(idx, 1)[0]); }); closeModal(); } },
      { label: "Move ▶", cls: "btn sm", fn: function () { if (idx < b.columns.length - 1) mutate(function () { b.columns.splice(idx + 1, 0, b.columns.splice(idx, 1)[0]); }); closeModal(); } },
      { label: "Delete", cls: "btn sm danger", fn: function () { deleteColumn(b, col); } },
      { label: "Save", cls: "btn sm primary", fn: function () {
        var name = $("#cmName").value.trim() || "Untitled";
        var wip = parseInt($("#cmWip").value, 10) || 0;
        mutate(function () { col.name = name; col.wip = wip; }); closeModal();
      } },
    ];
    modal("Column settings", body, foot, "sm");
  }
  function deleteColumn(b, col) {
    var cards = boardCards(b.id).filter(function (c) { return c.columnId === col.id; });
    if (b.columns.length <= 1) { toast("A board needs at least one column", "err"); return; }
    closeModal();
    confirmModal("Delete column '" + col.name + "'?", cards.length ? cards.length + " card(s) will move to the previous column." : "This column is empty.", function () {
      mutate(function () {
        var idx = b.columns.indexOf(col);
        var target = b.columns[idx - 1] || b.columns[idx + 1];
        cards.forEach(function (c) { c.columnId = target.id; });
        b.columns.splice(idx, 1);
      });
      toast("Column deleted");
    });
  }

  /* ----------------------------------------------------------------------- *
   * Card create / edit
   * ----------------------------------------------------------------------- */
  function quickAddCard(colId) {
    var b = activeBoard();
    mutate(function () {
      state.cards.push({
        id: uid("c"), boardId: b.id, columnId: colId, projectId: null, title: "New card",
        desc: "", assigneeId: null, priority: "medium", type: "Task", labels: [], due: null, startDate: null,
        estimateHours: 0, loggedHours: 0, progress: stageProgress(b, colId), milestone: false, deps: [], dependencyMode: "None", dependencyWbsCodes: [], dependencyNote: "", resourceAssignments: [], checklist: [], comments: [],
        activity: [{ text: "Card created", ts: Date.now() }], createdAt: Date.now(),
        order: boardCards(b.id).filter(function (c) { return c.columnId === colId; }).length,
      });
    });
  }

  // Common on-card role suggestions (free text still allowed) — NN: recognition
  // over recall, while preserving user control/freedom.
  var CARD_ROLE_SUGGESTIONS = ["Responsible", "Project Manager", "Technical lead", "Preparer", "Reviewer", "Approver", "Support", "Discipline support", "Project controls", "Records", "Owner", "Tool"];

  // Searchable resource combobox: filters the FULL resource register by name,
  // role, department, type, or company as the user types, with keyboard support.
  // Replaces the weak native datalist so allocation targets are discoverable.
  function resourcePicker(currentId, onSelect) {
    var wrap = el("div", { class: "res-combo" });
    var input = el("input", { class: "input sm res-combo-input", type: "search", placeholder: "Search name, role, dept…", autocomplete: "off", role: "combobox", "aria-expanded": "false", "aria-autocomplete": "list" });
    var cur = resourceById(currentId);
    if (cur) input.value = cur.name;
    input.dataset.resourceId = currentId || "";
    var menu = el("div", { class: "res-combo-menu", role: "listbox", hidden: "hidden" });
    var activeIdx = -1, current = [];
    function matches(q) {
      q = String(q || "").trim().toLowerCase();
      return (state.resources || []).filter(function (r) {
        if (!r || !r.name) return false;
        if (!q) return true;
        return (r.name + " " + (r.role || "") + " " + (r.dept || "") + " " + (r.type || "") + " " + (r.company || "")).toLowerCase().indexOf(q) !== -1;
      }).slice(0, 40);
    }
    function draw(list) {
      current = list; activeIdx = -1;
      if (!list.length) { menu.innerHTML = "<div class='res-combo-empty'>No matching resource. Add one in the Resources register.</div>"; menu.hidden = false; input.setAttribute("aria-expanded", "true"); return; }
      menu.innerHTML = list.map(function (r, i) {
        var sub = [r.role, r.dept, r.type].filter(Boolean).join(" · ");
        return "<div class='res-combo-opt' role='option' data-idx='" + i + "'><span class='avatar' style='background:" + avatarColor(r.name) + "'>" + esc(initials(r.name)) + "</span><span><span class='rc-name'>" + esc(r.name) + "</span><br><span class='rc-sub'>" + esc(sub) + "</span></span></div>";
      }).join("");
      menu.hidden = false; input.setAttribute("aria-expanded", "true");
    }
    function pick(r) {
      input.value = r.name; input.dataset.resourceId = r.id;
      menu.hidden = true; input.setAttribute("aria-expanded", "false");
      if (onSelect) onSelect(r.id);
    }
    function highlight() {
      [].slice.call(menu.querySelectorAll(".res-combo-opt")).forEach(function (o, i) { o.classList.toggle("active", i === activeIdx); });
      var act = menu.querySelector(".res-combo-opt.active"); if (act) act.scrollIntoView({ block: "nearest" });
    }
    input.addEventListener("focus", function () { draw(matches(input.value)); });
    input.addEventListener("input", function () { input.dataset.resourceId = ""; if (onSelect) onSelect(""); draw(matches(input.value)); });
    input.addEventListener("keydown", function (e) {
      if (menu.hidden && (e.key === "ArrowDown" || e.key === "ArrowUp")) { draw(matches(input.value)); return; }
      if (e.key === "ArrowDown") { e.preventDefault(); activeIdx = Math.min(current.length - 1, activeIdx + 1); highlight(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); activeIdx = Math.max(0, activeIdx - 1); highlight(); }
      else if (e.key === "Enter") { if (!menu.hidden && current[activeIdx]) { e.preventDefault(); pick(current[activeIdx]); } }
      else if (e.key === "Escape") { menu.hidden = true; input.setAttribute("aria-expanded", "false"); }
    });
    menu.addEventListener("mousedown", function (e) {
      var opt = e.target.closest && e.target.closest(".res-combo-opt"); if (!opt) return;
      e.preventDefault(); var r = current[parseInt(opt.dataset.idx, 10)]; if (r) pick(r);
    });
    document.addEventListener("click", function docClose(e) {
      if (!wrap.contains(e.target)) { menu.hidden = true; input.setAttribute("aria-expanded", "false"); }
      if (!document.body.contains(wrap)) document.removeEventListener("click", docClose);
    });
    wrap.appendChild(input); wrap.appendChild(menu);
    wrap._getResourceId = function () { return input.dataset.resourceId || ""; };
    wrap._focus = function () { input.focus(); };
    return wrap;
  }

  // Unified team & allocation editor. Row 1 is the Responsible (lead) — its
  // resource becomes the card's primary assignee. Shows a live allocation total
  // with status feedback (NN: visibility of system status, error prevention).
  function buildTeamEditor(c) {
    var rows = cardAssignments(c).map(function (a) { return { resourceId: a.resourceId, allocationPct: a.allocationPct, role: a.role }; });
    if (!rows.length) rows.push({ resourceId: c.assigneeId || "", allocationPct: 100, role: "Responsible" });
    var wrap = el("div", { class: "mt team-editor" });
    wrap.appendChild(el("label", { class: "field-label inline" }, "Team & allocation"));
    wrap.appendChild(el("div", { class: "hint team-editor-hint" }, "The first person is Responsible for the card and becomes its primary assignee. Search the resource register by name, role, or department; allocation % drives utilization, card cost, EAC, and reports. Up to three resources."));
    var rolesList = el("datalist", { id: "cardRoleOptions" });
    rolesList.innerHTML = CARD_ROLE_SUGGESTIONS.map(function (r) { return "<option value='" + esc(r) + "'>"; }).join("");
    wrap.appendChild(rolesList);
    var list = el("div", { class: "team-rows" });
    wrap.appendChild(list);
    var total = el("div", { class: "team-total" });
    total.innerHTML = "<span class='tt-bar'><span class='tt-fill'></span></span><span class='tt-label'></span>";
    wrap.appendChild(total);
    var addBtn = el("button", { class: "btn sm team-add", type: "button" }, "+ Add team member");
    wrap.appendChild(addBtn);

    function totalPct() { return rows.reduce(function (a, r) { return a + (r.resourceId ? (parseFloat(r.allocationPct) || 0) : 0); }, 0); }
    function renderTotal() {
      var t = Math.round(totalPct());
      var cls = t === 100 ? "ok" : t > 100 ? "over" : "warn";
      total.className = "team-total " + cls;
      total.querySelector(".tt-fill").style.width = clamp(t, 0, 100) + "%";
      total.querySelector(".tt-label").textContent = "Allocated " + t + "%" + (t === 100 ? " · balanced" : t > 100 ? " · over-allocated" : " · under 100%");
    }
    function updateAddBtn() { addBtn.style.display = rows.length >= 3 ? "none" : ""; }
    function makeRow(row, idx) {
      var rowEl = el("div", { class: "team-row" + (idx === 0 ? " lead" : "") });
      rowEl.appendChild(el("div", { class: "team-row-badge" }, idx === 0 ? "Responsible (lead)" : "Team member " + idx));
      var picker = resourcePicker(row.resourceId, function (rid) { row.resourceId = rid; renderTotal(); });
      rowEl.appendChild(picker);
      var pctCell = el("div", { class: "team-pct-cell" });
      var pct = el("input", { class: "input sm", type: "number", min: "0", max: "100", step: "5", value: String(row.allocationPct != null ? row.allocationPct : (idx ? 0 : 100)), "aria-label": "Allocation percent" });
      pct.addEventListener("input", function () { row.allocationPct = clamp(parseFloat(pct.value) || 0, 0, 100); renderTotal(); });
      pctCell.appendChild(pct);
      rowEl.appendChild(pctCell);
      var roleCell = el("div", { class: "team-role-cell" });
      var role = el("input", { class: "input sm", list: "cardRoleOptions", value: row.role || (idx ? "Support" : "Responsible"), placeholder: "Role on card", "aria-label": "Role on card" });
      role.value = row.role || (idx ? "Support" : "Responsible");
      role.addEventListener("input", function () { row.role = role.value; });
      roleCell.appendChild(role);
      rowEl.appendChild(roleCell);
      var rm = el("button", { class: "team-remove", type: "button", title: "Remove from team", "aria-label": "Remove from team" }, "✕");
      if (rows.length <= 1) rm.disabled = true;
      rm.addEventListener("click", function () { if (rows.length <= 1) return; rows.splice(idx, 1); renderRows(); });
      rowEl.appendChild(rm);
      return rowEl;
    }
    function renderRows() {
      list.innerHTML = "";
      rows.forEach(function (row, idx) { list.appendChild(makeRow(row, idx)); });
      renderTotal(); updateAddBtn();
    }
    addBtn.addEventListener("click", function () {
      if (rows.length >= 3) return;
      rows.push({ resourceId: "", allocationPct: 0, role: "Support" });
      renderRows();
      var pickers = list.querySelectorAll(".res-combo-input");
      if (pickers.length) pickers[pickers.length - 1].focus();
    });
    renderRows();
    wrap._getRows = function () {
      return rows.map(function (r) {
        return { resourceId: r.resourceId || "", allocationPct: clamp(parseFloat(r.allocationPct) || 0, 0, 100), role: (r.role || "").trim() };
      }).filter(function (r) { return r.resourceId && resourceById(r.resourceId); }).slice(0, 3);
    };
    return wrap;
  }

  function openCardEditor(cardId) {
    if (!canEdit() && cardId) return openCardReadonly(cardId);
    if (!canEdit()) { toast("Viewer role is read-only", "err"); return; }
    var b = activeBoard();
    var c = cardId ? cardById(cardId) : {
      id: uid("c"), boardId: b.id, columnId: b.columns[0].id, projectId: null, title: "", desc: "",
      assigneeId: null, priority: "medium", type: "Task", labels: [], due: null, startDate: null,
      estimateHours: 0, loggedHours: 0, progress: 0, milestone: false, deps: [], dependencyMode: "None", dependencyWbsCodes: [], dependencyNote: "", resourceAssignments: [], checklist: [], comments: [],
      activity: [], createdAt: Date.now(), order: 999, _new: true,
    };
    var projects = state.projects.filter(function (p) { return p.boardId === b.id; });
    var allLabels = Object.keys(LABEL_COLORS);
    var fin = canFinance();

    var body = el("div");
    body.innerHTML =
      "<div class='form-grid'>" +
      "<div class='form-row full'><label class='field-label inline'>Title</label><input class='input' id='fTitle' value='" + esc(c.title) + "' placeholder='Card title'></div>" +
      "<div class='form-row full'><label class='field-label inline'>Description</label><textarea class='textarea' id='fDesc' placeholder='Details, scope, acceptance criteria…'>" + esc(c.desc) + "</textarea></div>" +
      "<div class='form-row'><label class='field-label inline'>Stage</label><select class='select' id='fCol'>" + b.columns.map(function (col) { return "<option value='" + col.id + "'" + (col.id === c.columnId ? " selected" : "") + ">" + esc(col.name) + "</option>"; }).join("") + "</select></div>" +
      "<div class='form-row'><label class='field-label inline'>Priority</label><select class='select' id='fPrio'>" + PRIORITIES.map(function (p) { return "<option value='" + p + "'" + (p === c.priority ? " selected" : "") + ">" + cap(p) + "</option>"; }).join("") + "</select></div>" +
      "<div class='form-row'><label class='field-label inline'>Type</label><select class='select' id='fType'>" + CARD_TYPES.map(function (t) { return "<option" + (t === c.type ? " selected" : "") + ">" + esc(t) + "</option>"; }).join("") + "</select></div>" +
      "<div class='form-row'><label class='field-label inline'>Project</label><select class='select' id='fProject'><option value=''>None</option>" + projects.map(function (p) { return "<option value='" + p.id + "'" + (p.id === c.projectId ? " selected" : "") + ">" + esc(p.name) + "</option>"; }).join("") + "</select></div>" +
      "<div class='form-row'><label class='field-label inline'>WBS / Schedule ID</label><input class='input' id='fWbsCode' value='" + esc(cardWbsCode(c)) + "' placeholder='C1020'></div>" +
      "<div class='form-row'><label class='field-label inline'>Parent WBS</label><input class='input' id='fParentWbs' value='" + esc(c.parentWbsCode || "") + "' placeholder='TASK-1'></div>" +
      "<div class='form-row full'><label class='field-label inline'>Schedule title</label><input class='input' id='fScheduleTitle' value='" + esc(c.scheduleTitle || "") + "'></div>" +
      "<div class='form-row'><label class='field-label inline'>Deliverable</label><input class='input' id='fDeliverable' value='" + esc(c.deliverable || "") + "'></div>" +
      "<div class='form-row'><label class='field-label inline'>Billing milestone</label><input class='input' id='fBillingMilestone' value='" + esc(c.billingMilestone || "") + "'></div>" +
      "<div class='form-row'><label class='field-label inline'>Start date</label><input class='input' type='date' id='fStart' value='" + (c.startDate || "") + "'></div>" +
      "<div class='form-row'><label class='field-label inline'>Finish date</label><input class='input' type='date' id='fDue' value='" + (c.due || "") + "'></div>" +
      "<div class='form-row'><label class='field-label inline'>BL start</label><input class='input' type='date' id='fBaselineStart' value='" + (c.baselineStart || "") + "'></div>" +
      "<div class='form-row'><label class='field-label inline'>BL finish</label><input class='input' type='date' id='fBaselineFinish' value='" + (c.baselineFinish || "") + "'></div>" +
      "<div class='form-row'><label class='field-label inline'>Estimate (h)</label><input class='input' type='number' min='0' step='0.25' id='fEst' value='" + (c.estimateHours || 0) + "'></div>" +
      "<div class='form-row'><label class='field-label inline'>Logged (h)</label><input class='input' type='number' min='0' step='0.25' id='fLogged' value='" + (c.loggedHours || 0) + "'></div>" +
      "<div class='form-row'><label class='field-label inline'>Progress %</label><input class='input' type='number' min='0' max='100' step='1' id='fProgress' value='" + (c.progress || 0) + "'></div>" +
      "<div class='form-row'><label class='field-label inline'>Progress method</label><select class='select' id='fProgressMode'>" + PROGRESS_MODES.map(function (m) { return "<option" + (m === (c.progressMode || "Kanban Stage") ? " selected" : "") + ">" + esc(m) + "</option>"; }).join("") + "</select></div>" +
      "<div class='form-row'><label class='field-label inline'>Rule of credit</label><select class='select' id='fRule'><option value=''>None</option>" + (state.rulesOfCredit || []).map(function (r) { return "<option value='" + r.id + "'" + (r.id === c.ruleOfCreditId ? " selected" : "") + ">" + esc(r.name) + "</option>"; }).join("") + "</select></div>" +
      "<div class='form-row'><label class='field-label inline'><input type='checkbox' id='fMilestone'" + (c.milestone ? " checked" : "") + "> Milestone</label></div>" +
      "<div class='form-row full'><label class='field-label inline'>Labels</label><div id='fLabels' class='flex wrap'>" +
        allLabels.map(function (l) { var on = c.labels.indexOf(l) !== -1; return "<button type='button' class='chip label' data-label='" + l + "' style='cursor:pointer;border:1px solid " + (on ? LABEL_COLORS[l] : "var(--border)") + ";" + (on ? "background:" + LABEL_COLORS[l] + "22" : "") + "'><span class='tag-dot' style='background:" + LABEL_COLORS[l] + "'></span> " + l + "</button>"; }).join("") +
      "</div></div>" +
      "<div class='form-row full'><label class='field-label inline'>Source basis</label><textarea class='textarea' id='fSourceBasis'>" + esc(c.sourceBasis || "") + "</textarea></div>" +
      "<div class='form-row full'><label class='field-label inline'>Entry criteria</label><textarea class='textarea' id='fEntryCriteria'>" + esc(c.entryCriteria || "") + "</textarea></div>" +
      "<div class='form-row full'><label class='field-label inline'>Definition of done</label><textarea class='textarea' id='fDefinitionOfDone'>" + esc(c.definitionOfDone || "") + "</textarea></div>" +
      "<div class='form-row full'><label class='field-label inline'>Evidence required</label><textarea class='textarea' id='fEvidenceRequired'>" + esc(c.evidenceRequired || "") + "</textarea></div>" +
      "<div class='form-row full'><label class='field-label inline'>Completion / acceptance evidence</label><textarea class='textarea' id='fCompletionEvidence'>" + esc(c.completionEvidence || c.acceptanceEvidence || "") + "</textarea></div>" +
      "<div class='form-row full'><label class='field-label inline'>Risk / blocker</label><textarea class='textarea' id='fRiskOrBlocker'>" + esc(c.riskOrBlocker || "") + "</textarea></div>" +
      "</div>";

    var ruleEditBtn = el("button", { class: "btn sm ghost", type: "button" }, "Edit selected rule");
    ruleEditBtn.addEventListener("click", function () {
      var rule = ruleById((body.querySelector("#fRule") || {}).value || "");
      if (!rule) return toast("Select a rules-of-credit schema first", "err");
      closeModal();
      openRuleSchemaEditor(rule);
    });
    var ruleRow = body.querySelector("#fRule");
    if (ruleRow && ruleRow.parentElement) ruleRow.parentElement.appendChild(ruleEditBtn);

    var teamEditor = buildTeamEditor(c);
    body.appendChild(teamEditor);

    var peerCards = state.cards.filter(function (x) { return x.id !== c.id && (c.projectId ? x.projectId === c.projectId : x.boardId === c.boardId); });
    var depWrap = el("div", { class: "mt dependency-editor" });
    depWrap.innerHTML = "<label class='field-label inline'>Dependency / blocker logic</label><div class='hint'>Use blockers when another activity must close before this card can move into execution or closeout stages.</div>" +
      "<div class='form-grid'><div class='form-row'><label class='field-label inline'>Logic</label><select class='select' id='fDependencyMode'>" +
      ["None", "Finish-to-start", "Blocks until closed", "Informational"].map(function (m) { return "<option" + (m === (c.dependencyMode || "None") ? " selected" : "") + ">" + esc(m) + "</option>"; }).join("") + "</select></div>" +
      "<div class='form-row'><label class='field-label inline'>Dependency WBS codes</label><input class='input' id='fDependencyCodes' value='" + esc((c.dependencyWbsCodes || []).join(", ")) + "' placeholder='E1010, C1020'></div>" +
      "<div class='form-row full'><label class='field-label inline'>Linked work items</label><select class='select dependency-multiselect' id='fDeps' multiple size='5'>" + peerCards.map(function (pc) { return "<option value='" + pc.id + "'" + ((c.deps || []).indexOf(pc.id) !== -1 ? " selected" : "") + ">" + esc((cardWbsCode(pc) ? cardWbsCode(pc) + " - " : "") + pc.title) + "</option>"; }).join("") + "</select></div>" +
      "<div class='form-row full'><label class='field-label inline'>Dependency note</label><textarea class='textarea' id='fDependencyNote'>" + esc(c.dependencyNote || "") + "</textarea></div></div>";
    body.appendChild(depWrap);

    // Checklist
    var ckWrap = el("div", { class: "mt" });
    ckWrap.innerHTML = "<label class='field-label inline'>Checklist</label>";
    var ckList = el("div", { id: "fChecklist" });
    (c.checklist || []).forEach(function (item) { ckList.appendChild(checklistRow(item)); });
    ckWrap.appendChild(ckList);
    var addCk = el("button", { class: "btn sm mt", type: "button" }, "+ Add checklist item");
    addCk.addEventListener("click", function () { ckList.appendChild(checklistRow({ id: uid("ck"), text: "", done: false })); });
    ckWrap.appendChild(addCk);
    body.appendChild(ckWrap);

    if ((c.subcards || []).length) {
      var subWrap = el("div", { class: "mt" });
      subWrap.innerHTML = "<label class='field-label inline'>Subcards / payment milestones</label><div class='table-wrap'><table class='table table-dense'><thead><tr><th>Milestone</th><th class='num'>Amount</th><th class='num'>Progress</th><th>Status / evidence</th></tr></thead><tbody>" + c.subcards.map(function (s) { return "<tr><td>" + esc(s.title) + "</td><td class='num'>" + money(s.amount || 0) + "</td><td class='num'>" + pct(s.progress || 0) + "</td><td class='muted'>" + esc(s.status || s.evidenceRequired || "") + "</td></tr>"; }).join("") + "</tbody></table></div>";
      body.appendChild(subWrap);
    }
    if ((c.sourceActivities || []).length) {
      var srcWrap = el("div", { class: "mt" });
      srcWrap.innerHTML = "<label class='field-label inline'>Source activities</label><div class='hint'>" + c.sourceActivities.length + " detailed workbook activity rows are retained for traceability under this milestone-level card.</div>";
      body.appendChild(srcWrap);
    }

    // Activity (existing)
    if (c.activity && c.activity.length) {
      var actWrap = el("div", { class: "mt" });
      actWrap.innerHTML = "<label class='field-label inline'>Activity</label>";
      var ul = el("ul", { class: "activity-list" });
      c.activity.slice(0, 8).forEach(function (a) {
        ul.appendChild(el("li", null, esc(a.text) + " <span class='ts'>· " + new Date(a.ts).toLocaleString() + "</span>"));
      });
      actWrap.appendChild(ul);
      body.appendChild(actWrap);
    }

    // label toggle handlers
    body.querySelectorAll("[data-label]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var l = btn.dataset.label;
        var on = btn.getAttribute("data-on") === "1";
        on = !on;
        btn.setAttribute("data-on", on ? "1" : "0");
        btn.style.border = "1px solid " + (on ? LABEL_COLORS[l] : "var(--border)");
        btn.style.background = on ? LABEL_COLORS[l] + "22" : "";
      });
      btn.setAttribute("data-on", c.labels.indexOf(btn.dataset.label) !== -1 ? "1" : "0");
    });

    var estInput = body.querySelector("#fEst"), loggedInput = body.querySelector("#fLogged"), progressInput = body.querySelector("#fProgress");
    function fmtHoursInput(n) {
      n = roundHours(n);
      return String(Math.round(n) === n ? Math.round(n) : n);
    }
    function syncEffortInputs(changedField) {
      var v = effortFieldState(estInput.value, loggedInput.value, progressInput.value, changedField);
      if (changedField !== "estimate") estInput.value = fmtHoursInput(v.estimateHours);
      if (changedField !== "logged") loggedInput.value = fmtHoursInput(v.loggedHours);
      if (changedField !== "progress") progressInput.value = String(v.progress);
    }
    estInput.addEventListener("input", function () { syncEffortInputs("estimate"); });
    loggedInput.addEventListener("input", function () { syncEffortInputs("logged"); });
    progressInput.addEventListener("input", function () { syncEffortInputs("progress"); });
    syncEffortInputs("logged");

    var foot = [];
    if (!c._new) foot.push({ label: "Delete", cls: "btn danger", side: "left", fn: function () {
      closeModal();
      confirmModal("Delete card?", "'" + c.title + "' will be removed. You can undo this.", function () {
        mutate(function () { state.cards = state.cards.filter(function (x) { return x.id !== c.id; }); });
        toast("Card deleted");
      });
    } });
    foot.push({ label: "Cancel", cls: "btn", fn: closeModal });
    foot.push({ label: c._new ? "Create card" : "Save", cls: "btn primary", fn: function () {
      var title = $("#fTitle").value.trim();
      if (!title) { toast("Title is required", "err"); return; }
      var labels = [].slice.call(body.querySelectorAll("[data-label]")).filter(function (b2) { return b2.getAttribute("data-on") === "1"; }).map(function (b2) { return b2.dataset.label; });
      var checklist = [].slice.call(ckList.querySelectorAll(".checklist-item")).map(function (rowEl) {
        return { id: rowEl.dataset.ck, text: rowEl.querySelector("input[type=text]").value, done: rowEl.querySelector("input[type=checkbox]").checked };
      }).filter(function (x) { return x.text.trim(); });
      var resourceAssignments = teamEditor._getRows();
      var selectedDeps = $("#fDeps") ? [].slice.call($("#fDeps").selectedOptions || []).map(function (o) { return o.value; }) : [];
      var dependencyCodes = ($("#fDependencyCodes") ? $("#fDependencyCodes").value : "").split(/[;,\s]+/).map(function (x) { return x.trim().toUpperCase(); }).filter(Boolean);
      var wasNew = !!c._new;
      mutate(function () {
        c.title = title;
        c.desc = $("#fDesc").value;
        c.columnId = $("#fCol").value;
        c.resourceAssignments = resourceAssignments;
        c.assigneeId = resourceAssignments.length ? resourceAssignments[0].resourceId : null;
        normalizeResourceAssignmentsForCard(c);
        c.priority = $("#fPrio").value;
        c.type = $("#fType").value;
        c.projectId = $("#fProject").value || null;
        c.wbsCode = $("#fWbsCode").value.trim().toUpperCase();
        c.scheduleActivityId = isScheduleActivityCode(c.wbsCode) ? c.wbsCode : ($("#fWbsCode").value.trim().toUpperCase());
        c.parentWbsCode = $("#fParentWbs").value.trim().toUpperCase();
        c.scheduleTitle = $("#fScheduleTitle").value.trim();
        c.deliverable = $("#fDeliverable").value.trim();
        c.billingMilestone = $("#fBillingMilestone").value.trim();
        c.sourceBasis = $("#fSourceBasis").value.trim();
        c.entryCriteria = $("#fEntryCriteria").value.trim();
        c.definitionOfDone = $("#fDefinitionOfDone").value.trim();
        c.evidenceRequired = $("#fEvidenceRequired").value.trim();
        c.completionEvidence = $("#fCompletionEvidence").value.trim();
        c.acceptanceEvidence = c.completionEvidence || c.acceptanceEvidence || "";
        c.riskOrBlocker = $("#fRiskOrBlocker").value.trim();
        c.deps = selectedDeps;
        c.dependencyMode = $("#fDependencyMode") ? $("#fDependencyMode").value : "None";
        c.dependencyWbsCodes = dependencyCodes;
        c.dependencyNote = $("#fDependencyNote") ? $("#fDependencyNote").value.trim() : "";
        c.startDate = $("#fStart").value || null;
        c.due = $("#fDue").value || null;
        c.baselineStart = $("#fBaselineStart").value || null;
        c.baselineFinish = $("#fBaselineFinish").value || null;
        syncProjectScheduleFromCards(c.projectId);
        var effort = effortFieldState($("#fEst").value, $("#fLogged").value, $("#fProgress").value, "logged");
        c.estimateHours = effort.estimateHours;
        c.loggedHours = effort.loggedHours;
        c.progress = effort.progress;
        c.physicalProgress = effort.progress;
        c.progressMode = $("#fProgressMode").value;
        c.ruleOfCreditId = $("#fRule").value || "";
        c.milestone = $("#fMilestone").checked;
        c.labels = labels;
        c.checklist = checklist;
        var gate = cardMoveValidationMessage(c, c.columnId);
        if (gate) throw new Error(gate);
        if (wasNew) { delete c._new; logActivity(c, "Card created"); state.cards.push(c); }
        else logActivity(c, "Card updated");
      });
      closeModal();
      toast(wasNew ? "Card created" : "Card saved", "ok");
    } });

    modal((c._new ? "New card" : "Edit card") + (c.type ? " · " + c.type : ""), body, foot, "card-edit");
    setTimeout(function () { var t = $("#fTitle"); if (t) t.focus(); }, 30);
  }

  function checklistRow(item) {
    var row = el("div", { class: "checklist-item" + (item.done ? " done" : ""), dataset: { ck: item.id } });
    var cb = el("input", { type: "checkbox" }); cb.checked = item.done;
    cb.addEventListener("change", function () { row.classList.toggle("done", cb.checked); });
    var tx = el("input", { type: "text", value: item.text, placeholder: "Checklist item" });
    tx.value = item.text;
    var del = el("button", { class: "btn sm ghost", type: "button" }, "✕");
    del.addEventListener("click", function () { row.remove(); });
    row.appendChild(cb); row.appendChild(tx); row.appendChild(del);
    return row;
  }

  function openCardReadonly(cardId) {
    var c = cardById(cardId);
    if (!c) return;
    var team = cardAssignments(c);
    var lead = team[0] ? resourceById(team[0].resourceId) : null;
    var body = el("div");
    body.innerHTML =
      "<p class='muted'>" + esc(c.desc || "No description.") + "</p>" +
      "<div class='grid cols-2 mt'>" +
      statCardHTML("Stage", columnName(c), "") +
      statCardHTML("Responsible", lead ? lead.name : "Unassigned", lead && team[0].role ? team[0].role + " · " + Math.round(team[0].allocationPct || 0) + "%" : "") +
      statCardHTML("Priority", cap(c.priority), c.type) +
      statCardHTML("Schedule", fmtDate(cardStart(c)) + " - " + fmtDate(cardFinish(c)), (cardDurationDays(c) || "—") + " days") +
      statCardHTML("Finish", fmtDate(c.due), c.progress + "% complete") + "</div>";
    var teamWrap = el("div", { class: "mt" });
    teamWrap.innerHTML = "<label class='field-label inline'>Team & allocation</label>" + cardTeamHTML(c);
    body.appendChild(teamWrap);
    modal("Card details", body, [{ label: "Close", cls: "btn primary", fn: closeModal }]);
  }

  /* ----------------------------------------------------------------------- *
   * Modal infrastructure
   * ----------------------------------------------------------------------- */
  function modal(title, bodyNode, footButtons, size) {
    var host = $("#modalHost");
    host.innerHTML = "";
    host.hidden = false;
    host.classList.add("open");
    var m = el("div", { class: "modal" + (size ? " " + size : "") });
    var head = el("div", { class: "modal-head" }, "<h3>" + esc(title) + "</h3>");
    var x = el("button", { class: "btn ghost", "aria-label": "Close" }, "✕");
    x.addEventListener("click", closeModal);
    head.appendChild(x);
    var body = el("div", { class: "modal-body" });
    body.appendChild(bodyNode);
    var foot = el("div", { class: "modal-foot" });
    var leftButtons = (footButtons || []).filter(function (b) { return b.side === "left"; });
    var rightButtons = (footButtons || []).filter(function (b) { return b.side !== "left"; });
    leftButtons.forEach(function (b) { foot.appendChild(mkBtn(b.label, b.cls, b.fn)); });
    foot.appendChild(el("div", { class: "spacer" }));
    rightButtons.forEach(function (b) { foot.appendChild(mkBtn(b.label, b.cls, b.fn)); });
    m.appendChild(head); m.appendChild(body); m.appendChild(foot);
    host.appendChild(m);
    host.onclick = function (e) { if (e.target === host) closeModal(); };
  }
  function closeModal() { var h = $("#modalHost"); h.hidden = true; h.classList.remove("open"); h.innerHTML = ""; h.onclick = null; }
  function confirmModal(title, msg, onYes) {
    modal(title, el("p", { class: "muted" }, esc(msg)), [
      { label: "Cancel", cls: "btn", fn: closeModal },
      { label: "Confirm", cls: "btn primary", fn: function () { closeModal(); onYes(); } },
    ], "sm");
  }

  /* ----------------------------------------------------------------------- *
   * Search
   * ----------------------------------------------------------------------- */
  function runSearch(q) {
    var box = $("#searchResults");
    q = (q || "").trim().toLowerCase();
    if (!q) { box.hidden = true; box.innerHTML = ""; return; }
    var groups = [];
    var cards = state.cards.filter(function (c) { return c.title.toLowerCase().indexOf(q) !== -1; }).slice(0, 6);
    var projects = state.projects.filter(function (p) { return p.name.toLowerCase().indexOf(q) !== -1 || p.client.toLowerCase().indexOf(q) !== -1; }).slice(0, 4);
    var people = state.resources.filter(function (r) { return r.name.toLowerCase().indexOf(q) !== -1; }).slice(0, 4);
    if (cards.length) groups.push({ label: "Cards", items: cards.map(function (c) { return { title: c.title, sub: columnName(c), act: function () { switchToCardBoard(c); openCardEditor(c.id); } }; }) });
    if (projects.length) groups.push({ label: "Projects", items: projects.map(function (p) { return { title: p.name, sub: p.client, act: function () { openProject(p.id); } }; }) });
    if (people.length) groups.push({ label: "People", items: people.map(function (r) { return { title: r.name, sub: r.role, act: function () { go("resources"); } }; }) });
    if (!groups.length) { box.hidden = false; box.innerHTML = "<div class='sr-item muted'>No results for “" + esc(q) + "”</div>"; return; }
    box.innerHTML = "";
    groups.forEach(function (g) {
      box.appendChild(el("div", { class: "sr-group" }, esc(g.label)));
      g.items.forEach(function (it) {
        var item = el("div", { class: "sr-item" }, "<div><div>" + esc(it.title) + "</div><div class='sr-sub'>" + esc(it.sub) + "</div></div>");
        item.addEventListener("click", function () { box.hidden = true; $("#search").value = ""; it.act(); });
        box.appendChild(item);
      });
    });
    box.hidden = false;
  }
  function switchToCardBoard(c) { if (state.activeBoardId !== c.boardId) { state.activeBoardId = c.boardId; save(); } ui.view = "board"; render(); }
  function openProject(pid2) {
    var p = projectById(pid2);
    if (!p) return;
    state.activeBoardId = p.boardId;
    save();
    go("board");
    toast("Opened board for " + p.name);
  }

  /* ----------------------------------------------------------------------- *
   * Import / export
   * ----------------------------------------------------------------------- */
  function download(filename, text, mime) {
    var blob = new Blob([text], { type: mime || "text/plain;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = el("a", { href: url, download: filename });
    document.body.appendChild(a); a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
  }
  // Trigger a download from a stored data: URL (used for uploaded documents).
  function downloadDataUrl(filename, dataUrl) {
    var a = el("a", { href: dataUrl, download: filename });
    document.body.appendChild(a); a.click();
    setTimeout(function () { document.body.removeChild(a); }, 100);
  }
  function exportJSON() { download("techniek-opsboard-" + todayISO() + ".json", JSON.stringify(state, null, 2), "application/json"); toast("Workspace exported", "ok"); }
  function importJSONPrompt() {
    var input = el("input", { type: "file", accept: "application/json" });
    input.addEventListener("change", function () {
      var file = input.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var parsed = JSON.parse(reader.result);
          if (!parsed.boards || !parsed.cards) throw new Error("Invalid workspace file");
          confirmModal("Import workspace?", "This replaces your current local workspace. You can undo afterwards.", function () {
            snapshot(); state = migrate(parsed); commit(); toast("Workspace imported", "ok");
          });
        } catch (e) { toast("Import failed: " + e.message, "err"); }
      };
      reader.readAsText(file);
    });
    input.click();
  }
  function csvCell(v) {
    v = String(v == null ? "" : v);
    return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  }
  function exportReportCSV() {
    var fin = canFinance();
    var rows = [["Project", "Client", "Cards", "Done", "Overdue", "Progress %"].concat(
      fin ? ["Budget", "Earned Revenue", "Committed", "Direct Labor", "Variance", "Contribution Margin %", "Multiplier", "Budget Burn %",
             "BAC", "PV", "EV", "AC", "CV", "SV ($)", "CPI", "SPI", "EAC"] : [])];
    state.projects.forEach(function (p) {
      var r = projectRollup(p);
      var base = [p.name, p.client, r.cards, r.done, r.overdue, r.progress];
      if (fin) {
        var v = projectEVM(p);
        var mult = projectMultiplier(r);
        base = base.concat([
          r.budget, p.billable ? Math.round(r.earnedRevenue) : "", Math.round(r.committed), Math.round(r.spent), Math.round(r.variance),
          p.billable && r.contributionMargin != null ? num2(r.contributionMargin * 100) : "", p.billable && mult != null ? num2(mult) : "", Math.round(r.burn * 100),
          Math.round(v.bac), Math.round(v.pv), Math.round(v.ev), Math.round(v.ac),
          Math.round(v.cv), Math.round(v.sv), num2(v.cpi), num2(v.spi), Math.round(v.eac),
        ]);
      }
      rows.push(base);
    });
    if (fin) {
      var pe = programEVM();
      var pt = portfolioTotals();
      var pm = portfolioMultiplier(pt);
      rows.push(["PROGRAM (all projects)", state.projects.length + " projects", pt.projectCards, pt.projectDone, pt.overdue, "",
        Math.round(pt.budget), Math.round(pt.earnedRevenue), Math.round(pt.committed), Math.round(pt.spent), Math.round(pt.budget - pt.committed),
        pt.contributionMargin != null ? num2(pt.contributionMargin * 100) : "", pm != null ? num2(pm) : "", pt.budget ? Math.round(pt.spent / pt.budget * 100) : 0,
        Math.round(pe.bac), Math.round(pe.pv), Math.round(pe.ev), Math.round(pe.ac),
        Math.round(pe.cv), Math.round(pe.sv), num2(pe.cpi), num2(pe.spi), Math.round(pe.eac)]);
    }
    download("opsboard-report-" + todayISO() + ".csv", rows.map(function (r) { return r.map(csvCell).join(","); }).join("\n"), "text/csv");
    toast("Report CSV exported", "ok");
  }
  function exportJiraCSV() {
    var rows = [["Summary", "Issue Type", "Status", "Priority", "Assignee", "Due Date", "Labels", "Original Estimate", "Description"]];
    state.cards.forEach(function (c) {
      var r = resourceById(c.assigneeId);
      rows.push([c.title, c.type, columnName(c), cap(c.priority), r ? r.name : "", c.due || "", (c.labels || []).join(" "), (c.estimateHours || 0) + "h", c.desc || ""]);
    });
    download("opsboard-jira-" + todayISO() + ".csv", rows.map(function (r) { return r.map(csvCell).join(","); }).join("\n"), "text/csv");
    toast("Jira CSV exported", "ok");
  }
  function resourceRosterNames(resourceId) {
    return state.boards.filter(function (b) { return (b.rosterIds || []).indexOf(resourceId) !== -1; }).map(function (b) { return b.name; });
  }
  function exportResourcesCSV() {
    if (!canManageResources()) { toast("Resource export is manager-only", "err"); return; }
    var rows = [["ID", "Name", "Type", "Role", "Department", "Company", "Capacity Hours", "Cost Rate", "Bill Rate", "Unit", "Status", "Board Rosters", "Notes"]];
    state.resources.forEach(function (r) {
      normalizeResource(r);
      rows.push([r.id, r.name, r.type, r.role, r.dept, r.company, r.capacityHrs, r.costRate, r.billRate, r.unit, r.status, resourceRosterNames(r.id).join("; "), r.notes || ""]);
    });
    download("opsboard-resources-" + todayISO() + ".csv", rows.map(function (r) { return r.map(csvCell).join(","); }).join("\n"), "text/csv");
    toast("Resources exported", "ok");
  }
  function resourceCsvTemplate() {
    return [
      ["ID", "Name", "Type", "Role", "Department", "Company", "Capacity Hours", "Cost Rate", "Bill Rate", "Unit", "Status", "Board Rosters", "Notes"],
      ["", "Example Subcontractor", "Subcontractor", "Survey Crew", "Subcontractor", "Example Survey LLC", "30", "135", "190", "hour", "Preferred", "Engineering Delivery; Proposals & BD", "External crew capacity"],
      ["", "Example Software License", "Tool / Software", "Analysis Tool", "Software", "Vendor", "80", "25", "0", "use", "Active", "Engineering Delivery", "Per-use license"],
    ].map(function (r) { return r.map(csvCell).join(","); }).join("\n");
  }
  function importResourcesPrompt() {
    if (!canManageResources()) { toast("Resource import is manager-only", "err"); return; }
    var input = el("input", { type: "file", accept: ".csv,.tsv,text/csv,text/tab-separated-values" });
    input.addEventListener("change", function () {
      var file = input.files && input.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var count = importResourcesFromText(String(reader.result || ""), file.name);
          toast(count + " resource row" + (count === 1 ? "" : "s") + " imported", "ok");
        } catch (err) {
          toast(err.message || "Resource import failed", "err");
        }
      };
      reader.readAsText(file);
    });
    input.click();
  }
  function normHeader(s) { return String(s || "").toLowerCase().replace(/[^a-z0-9]/g, ""); }
  function field(row, idx, names) {
    for (var i = 0; i < names.length; i++) {
      var j = idx[normHeader(names[i])];
      if (j != null && row[j] != null && String(row[j]).trim() !== "") return String(row[j]).trim();
    }
    return "";
  }
  function importResourcesFromText(text, filename) {
    var delim = /\.tsv$/i.test(filename || "") || text.indexOf("\t") !== -1 && text.indexOf(",") === -1 ? "\t" : ",";
    var rows = parseDelimited(text, delim).filter(function (r) { return r.some(function (c) { return String(c || "").trim(); }); });
    if (rows.length < 2) throw new Error("Resource file needs a header row and at least one resource row.");
    var headers = rows[0], idx = {};
    headers.forEach(function (h, i) { idx[normHeader(h)] = i; });
    var byId = {}, byName = {};
    state.resources.forEach(function (r) { byId[r.id] = r; byName[r.name.toLowerCase()] = r; });
    var imported = 0;
    mutate(function () {
      rows.slice(1).forEach(function (row) {
        var id = field(row, idx, ["id", "resource id"]);
        var name = field(row, idx, ["name", "resource"]);
        if (!name) return;
        var existing = id && byId[id] ? byId[id] : byName[name.toLowerCase()];
        var r = existing || { id: id || uid("r") };
        r.name = name;
        r.type = field(row, idx, ["type", "resource type"]) || r.type || "Employee";
        r.role = field(row, idx, ["role", "use", "role / use"]) || r.role || "Contributor";
        r.dept = field(row, idx, ["department", "dept"]) || r.dept || "Imported";
        r.company = field(row, idx, ["company", "vendor", "supplier"]) || r.company || (r.type === "Employee" ? "Techniek" : "");
        r.capacityHrs = normHours(field(row, idx, ["capacity hours", "capacity", "weekly capacity"]) || r.capacityHrs);
        r.costRate = normHours(field(row, idx, ["cost rate", "cost"]) || r.costRate);
        r.billRate = normHours(field(row, idx, ["bill rate", "bill"]) || r.billRate);
        r.unit = field(row, idx, ["unit", "rate unit"]) || r.unit || "hour";
        r.status = field(row, idx, ["status"]) || r.status || "Active";
        r.notes = field(row, idx, ["notes", "comment"]) || r.notes || "";
        normalizeResource(r);
        if (!existing) { state.resources.push(r); byId[r.id] = r; byName[r.name.toLowerCase()] = r; }
        var rosterText = field(row, idx, ["board rosters", "boards", "rosters"]);
        if (rosterText) {
          rosterText.split(/[;|]/).map(function (x) { return x.trim().toLowerCase(); }).filter(Boolean).forEach(function (boardName) {
            var b = state.boards.filter(function (x) { return x.name.toLowerCase() === boardName; })[0];
            if (b && b.rosterIds.indexOf(r.id) === -1) b.rosterIds.push(r.id);
          });
        }
        imported++;
      });
    });
    return imported;
  }
  function addResourceInline() {
    if (!canManageResources()) return;
    mutate(function () {
      state.resources.push(normalizeResource({ id: uid("r"), name: "New resource", role: "Contributor", dept: "Unassigned", capacityHrs: 40, costRate: 70, billRate: 120, type: "Employee", company: "Techniek", unit: "hour", status: "Active", notes: "" }));
    });
    toast("Resource added", "ok");
  }
  function deleteResourcePrompt(id) {
    if (!canManageResources()) return;
    var r = resourceById(id);
    if (!r) return;
    var assigned = state.cards.filter(function (c) { return c.assigneeId === id || (c.resourceAssignments || []).some(function (a) { return a.resourceId === id; }); }).length;
    confirmModal("Delete resource?", "Remove " + r.name + " from the resource register" + (assigned ? " and unassign " + assigned + " card(s)" : "") + ". You can undo this.", function () {
      mutate(function () {
        state.cards.forEach(function (c) {
          if (c.assigneeId === id) c.assigneeId = null;
          c.resourceAssignments = (c.resourceAssignments || []).filter(function (a) { return a.resourceId !== id; });
          normalizeResourceAssignmentsForCard(c);
        });
        state.boards.forEach(function (b) { b.rosterIds = (b.rosterIds || []).filter(function (rid) { return rid !== id; }); });
        state.resources = state.resources.filter(function (x) { return x.id !== id; });
      });
      toast("Resource deleted", "ok");
    });
  }

  /* ----------------------------------------------------------------------- *
   * File intake → extract PM info → plan a board
   * ----------------------------------------------------------------------- */
  function downloadCsvTemplate() {
    var rows = [
      ["Title", "Stage", "Type", "Priority", "Assignee", "Due", "Estimate", "Labels", "Description"],
      ["Site survey & access plan", "Backlog", "Task", "high", "Jordan Lee", "2026-07-10", "16", "Safety", "Confirm permits and access windows"],
      ["Draft control philosophy", "In Progress", "Feature", "medium", "Sam Carter", "2026-07-18", "24", "Documentation", "Author control narrative"],
      ["Client design review", "Review", "Milestone", "critical", "Jordan Lee", "2026-07-25", "8", "Client", "Gate review with stakeholder sign-off"],
    ];
    download("opsboard-wbs-template.csv", rows.map(function (r) { return r.map(csvCell).join(","); }).join("\n"), "text/csv");
    toast("Template downloaded", "ok");
  }

  // Minimal RFC-4180-ish CSV/TSV parser (handles quotes, commas, newlines).
  function parseDelimited(text, delim) {
    var rows = [], row = [], field = "", i = 0, inQ = false;
    while (i < text.length) {
      var ch = text[i];
      if (inQ) {
        if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
        else field += ch;
      } else {
        if (ch === '"') inQ = true;
        else if (ch === delim) { row.push(field); field = ""; }
        else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
        else if (ch === "\r") { /* skip */ }
        else field += ch;
      }
      i++;
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (c) { return String(c).trim() !== ""; }); });
  }

  var FIELD_ALIASES = {
    title: ["title", "summary", "name", "task", "deliverable", "work item", "subject"],
    stage: ["stage", "status", "column", "state", "phase", "swimlane"],
    type: ["type", "issue type", "category", "kind"],
    priority: ["priority", "severity", "urgency"],
    assignee: ["assignee", "owner", "responsible", "assigned to", "resource"],
    due: ["due", "due date", "end", "end date", "finish", "target", "deadline"],
    start: ["start", "start date", "begin"],
    estimate: ["estimate", "estimate hours", "original estimate", "effort", "hours", "story points"],
    labels: ["labels", "label", "tags", "tag"],
    desc: ["description", "details", "notes", "desc"],
    progress: ["progress", "percent", "% complete", "complete"],
  };
  function matchField(header) {
    var h = String(header || "").trim().toLowerCase();
    for (var key in FIELD_ALIASES) {
      if (FIELD_ALIASES[key].indexOf(h) !== -1) return key;
    }
    return null;
  }
  function normPriority(v) {
    var s = String(v || "").trim().toLowerCase();
    if (/crit|block|p0|urgent|highest/.test(s)) return "critical";
    if (/high|p1|major/.test(s)) return "high";
    if (/low|p3|minor|trivial/.test(s)) return "low";
    return "medium";
  }
  function normEstimate(v) {
    var m = String(v || "").match(/[\d.]+/);
    return m ? parseFloat(m[0]) : 0;
  }
  function normDate(v) {
    var s = String(v || "").trim();
    if (!s) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    var d = new Date(s);
    if (!isNaN(d)) return d.toISOString().slice(0, 10);
    return null;
  }

  function parseCesP6Csv(text, filename) {
    var delim = /\.tsv$/i.test(filename || "") || ((text.split("\n")[0] || "").indexOf("\t") !== -1) ? "\t" : ",";
    var rows = parseDelimited(text, delim);
    var out = { filename: filename || "ces-p6.csv", tasks: [], errors: [], warnings: [] };
    if (rows.length < 2) { out.errors.push("CSV requires a header row and at least one task row."); return out; }
    var idx = {}; rows[0].forEach(function (h, i) { idx[normHeader(h)] = i; });
    rows.slice(1).forEach(function (row, rowIndex) {
      var title = field(row, idx, ["Task Name", "Name", "Title", "Activity Name", "Summary"]);
      var outline = field(row, idx, ["Outline Number", "WBS", "WBS Code", "Activity ID", "ID"]);
      if (!title && !outline) return;
      if (!title) { out.errors.push("Row " + (rowIndex + 2) + " is missing a task name."); return; }
      var parentOutline = field(row, idx, ["Parent Outline", "Parent WBS", "Parent", "Summary Task"]);
      if (!parentOutline && outline && outline.indexOf(".") !== -1) parentOutline = outline.split(".").slice(0, -1).join(".");
      out.tasks.push({
        row: rowIndex + 2,
        outlineNumber: outline || String(out.tasks.length + 1),
        parentOutline: parentOutline || "",
        title: title,
        chargeTask: field(row, idx, ["Charge Task", "ERMAS Charge Task", "Task Code", "Unanet Task", "Unanet Task Code"]),
        assignee: field(row, idx, ["Assigned To", "Assignee", "Owner", "Resource"]),
        start: normDate(field(row, idx, ["Start", "Start Date", "ERMAS Start"])),
        finish: normDate(field(row, idx, ["Finish", "End", "Due", "Due Date", "ERMAS Finish"])),
        estimateHours: normEstimate(field(row, idx, ["Estimate", "Estimate Hours", "Budget Hours", "Hours", "Duration"])),
        progress: normProgress(field(row, idx, ["% Complete", "Progress", "Physical % Complete"])),
        physicalProgress: normProgress(field(row, idx, ["Physical % Complete", "Physical Complete", "Progress"])),
        ermasBudget: normHours(field(row, idx, ["ERMAS Budget", "Budget", "Task Budget", "Target Cost Budget"])),
        ermasActuals: normHours(field(row, idx, ["ERMAS Actuals", "Actuals", "Consumed"])),
        ermasStart: normDate(field(row, idx, ["ERMAS Start", "Baseline Start"])),
        ermasFinish: normDate(field(row, idx, ["ERMAS Finish", "ERMAS End", "Baseline Finish"])),
      });
    });
    var seen = {};
    out.tasks.forEach(function (t) {
      if (seen[t.outlineNumber]) out.warnings.push("Duplicate outline " + t.outlineNumber + " at row " + t.row + ".");
      seen[t.outlineNumber] = true;
      if (t.parentOutline && !seen[t.parentOutline] && !out.tasks.some(function (x) { return x.outlineNumber === t.parentOutline; })) out.warnings.push("Parent outline " + t.parentOutline + " was not found for " + t.title + ".");
    });
    return out;
  }
  function findOrCreateResourceByName(name) {
    name = String(name || "").trim();
    if (!name) return null;
    var r = state.resources.filter(function (x) { return x.name.toLowerCase() === name.toLowerCase(); })[0];
    if (r) return r;
    r = normalizeResource({ id: uid("r"), name: name, role: "Imported Resource", dept: "Imported", capacityHrs: 40, costRate: 70, billRate: 120, type: "Employee", company: "Techniek", unit: "hour", status: "Active", notes: "Created by WBS import" });
    state.resources.push(r);
    return r;
  }
  function importWbsTasks(projectId, parsed) {
    var p = projectById(projectId);
    if (!p) throw new Error("Project not found.");
    parsed = parsed && parsed.tasks ? parsed : parseCesP6Csv(String(parsed || ""), "wbs.csv");
    if (parsed.errors && parsed.errors.length) throw new Error(parsed.errors.join(" "));
    var b = state.boards.filter(function (x) { return x.id === p.boardId; })[0] || activeBoard();
    var col = b.columns[0];
    var importId = uid("imp");
    var byOutline = {};
    mutate(function () {
      parsed.tasks.forEach(function (t, i) {
        var res = findOrCreateResourceByName(t.assignee);
        var c = normalizeWorkItem({
          id: uid("c"), boardId: b.id, columnId: col.id, projectId: p.id, title: t.title, desc: "Imported from " + (parsed.filename || "CES/P6 CSV"),
          assigneeId: res ? res.id : null, priority: "medium", type: t.parentOutline ? "Task" : "Milestone", labels: ["WBS"],
          due: t.finish || null, startDate: t.start || null, estimateHours: t.estimateHours || 0, loggedHours: 0, progress: t.progress || 0,
          milestone: !t.parentOutline, deps: [], checklist: [], comments: [], activity: [{ text: "Imported from CES/P6 WBS", ts: Date.now() }], createdAt: Date.now(), order: state.cards.length + i,
          outlineNumber: t.outlineNumber, parentId: null, chargeTask: t.chargeTask || (p.unanetProjectCode + "." + t.outlineNumber), physicalProgress: t.physicalProgress,
          ermasBudget: t.ermasBudget || null, ermasActuals: t.ermasActuals || null, ermasStart: t.ermasStart || t.start || null, ermasFinish: t.ermasFinish || t.finish || null, importId: importId,
        });
        state.cards.push(c);
        byOutline[t.outlineNumber] = c;
        if (res && b.rosterIds.indexOf(res.id) === -1) b.rosterIds.push(res.id);
      });
      parsed.tasks.forEach(function (t) {
        var c = byOutline[t.outlineNumber];
        if (c && t.parentOutline && byOutline[t.parentOutline]) c.parentId = byOutline[t.parentOutline].id;
      });
      state.imports.push({ id: importId, type: "CES/P6 WBS", filename: parsed.filename || "wbs.csv", projectId: p.id, importedAt: Date.now(), count: parsed.tasks.length, warnings: parsed.warnings || [] });
      recordAudit("Import", importId, "CES/P6 WBS import", parsed.tasks.length + " work item(s) imported to " + p.name);
      syncProjectScheduleFromCards(p.id);
    });
    return importId;
  }
  function exportProjectPackage(projectId) {
    var p = projectById(projectId);
    if (!p) return null;
    return {
      exportedAt: new Date().toISOString(), schema: SCHEMA_VERSION, product: PRODUCT_NAME,
      project: p,
      projectPlans: p.projectPlans || [],
      program: (state.programs || []).filter(function (pg) { return pg.id === p.programId; })[0] || null,
      portfolio: (state.portfolios || []).filter(function (pf) { return pf.id === p.portfolioId; })[0] || null,
      workItems: state.cards.filter(function (c) { return c.projectId === p.id; }),
      wbsElements: projectWbsElements(p.id),
      resources: state.resources,
      engagements: (state.resourceEngagements || []).filter(function (e) { return e.projectId === p.id; }),
      risks: (state.risks || []).filter(function (r) { return r.projectId === p.id; }),
      actionItems: (state.actionItems || []).filter(function (i) { return i.projectId === p.id; }),
      changes: (state.changeOrders || []).filter(function (c) { return c.projectId === p.id; }),
      financialHistory: projectFinancialHistory(p),
      auditTrail: (state.auditTrail || []).filter(function (a) { return !a.entityId || a.entityId === p.id || a.detail.indexOf(p.name) !== -1; }),
    };
  }

  // Returns { tasks:[{title,stage,type,priority,assignee,due,start,estimate,labels,desc,progress}], stages:[...] }
  function extractTasks(text, filename) {
    var ext = (filename.split(".").pop() || "").toLowerCase();
    var tasks = [];
    if (ext === "json" || (/^\s*[\[{]/.test(text))) {
      var data = JSON.parse(text);
      if (data && data.boards && data.cards) return { workspace: data }; // full export
      var arr = Array.isArray(data) ? data : (data.tasks || data.cards || data.items || []);
      arr.forEach(function (o) {
        tasks.push({
          title: o.title || o.summary || o.name || "Untitled",
          stage: o.stage || o.status || o.column || "",
          type: o.type || "Task", priority: normPriority(o.priority),
          assignee: o.assignee || o.owner || "", due: normDate(o.due || o.dueDate || o.end),
          start: normDate(o.start || o.startDate), estimate: normEstimate(o.estimate || o.estimateHours || o.effort),
          labels: Array.isArray(o.labels) ? o.labels : (o.labels ? String(o.labels).split(/[,;]/) : []),
          desc: o.desc || o.description || "", progress: parseInt(o.progress, 10) || 0,
        });
      });
    } else if (ext === "csv" || ext === "tsv" || /,|\t/.test(text.split("\n")[0] || "")) {
      var delim = ext === "tsv" || (text.split("\n")[0] || "").indexOf("\t") !== -1 ? "\t" : ",";
      var rows = parseDelimited(text, delim);
      if (!rows.length) return { tasks: [] };
      var headers = rows[0].map(matchField);
      rows.slice(1).forEach(function (r) {
        var o = {};
        headers.forEach(function (key, idx) { if (key) o[key] = r[idx]; });
        if (!o.title) return;
        tasks.push({
          title: o.title, stage: o.stage || "", type: o.type || "Task", priority: normPriority(o.priority),
          assignee: o.assignee || "", due: normDate(o.due), start: normDate(o.start),
          estimate: normEstimate(o.estimate), labels: o.labels ? String(o.labels).split(/[,;]/).map(function (x) { return x.trim(); }).filter(Boolean) : [],
          desc: o.desc || "", progress: parseInt(o.progress, 10) || 0,
        });
      });
    } else {
      // Markdown / plain text: headings (#, ##) become stages; bullets / checkboxes become tasks.
      var lines = text.split("\n");
      var curStage = "Backlog";
      lines.forEach(function (line) {
        var h = line.match(/^\s{0,3}(#{1,6})\s+(.*)$/);
        if (h) { curStage = h[2].trim().replace(/[:#]+$/, ""); return; }
        var b = line.match(/^\s*[-*+]\s+(?:\[( |x|X)\]\s+)?(.*)$/);
        if (b && b[2].trim()) {
          var done = b[1] && b[1].toLowerCase() === "x";
          tasks.push({ title: b[2].trim().replace(/\s*\(.*\)$/, ""), stage: curStage, type: "Task", priority: "medium",
            assignee: "", due: null, start: null, estimate: 0, labels: [], desc: "", progress: done ? 100 : 0 });
        }
      });
    }
    var stages = [];
    tasks.forEach(function (t) { if (t.stage && stages.indexOf(t.stage) === -1) stages.push(t.stage); });
    return { tasks: tasks, stages: stages };
  }

  function importAndPlanPrompt() {
    if (!canEdit()) { toast("Viewer role is read-only", "err"); return; }
    var input = el("input", { type: "file", accept: ".csv,.tsv,.json,.md,.txt,text/*,application/json" });
    input.addEventListener("change", function () {
      var file = input.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var result = extractTasks(String(reader.result), file.name);
          if (result.workspace) {
            confirmModal("Import full workspace?", "This file is a complete OpsBoard export. Importing replaces your current local workspace (undoable).", function () {
              snapshot(); state = migrate(result.workspace); commit(); toast("Workspace imported", "ok");
            });
            return;
          }
          if (!result.tasks.length) { toast("No tasks found in that file", "err"); return; }
          planBoardWizard(result, file.name);
        } catch (e) { toast("Could not parse file: " + e.message, "err"); }
      };
      reader.readAsText(file);
    });
    input.click();
  }

  function planBoardWizard(result, filename) {
    var tasks = result.tasks;
    var defaultStages = result.stages.length ? result.stages : ["Backlog", "Ready", "In Progress", "Review", "Done"];
    var suggestedName = filename.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").replace(/\b\w/g, function (m) { return m.toUpperCase(); }).slice(0, 40);
    var withDates = tasks.filter(function (t) { return t.due; }).length;
    var withAssignee = tasks.filter(function (t) { return t.assignee; }).length;
    var body = el("div");
    body.innerHTML =
      "<p class='muted'>Extracted <strong>" + tasks.length + " tasks</strong> from <strong>" + esc(filename) + "</strong>. " +
      withDates + " have due dates, " + withAssignee + " name an assignee, across " + defaultStages.length + " stage" + (defaultStages.length > 1 ? "s" : "") + ".</p>" +
      "<div class='form-row mt'><label class='field-label inline'>Board name</label><input class='input' id='planName' value='" + esc(suggestedName || "Imported Board") + "'></div>" +
      "<div class='form-row mt'><label class='field-label inline'>Columns (comma-separated)</label><input class='input' id='planStages' value='" + esc(defaultStages.join(", ")) + "'></div>" +
      "<div class='form-row mt'><label class='field-label inline'><input type='checkbox' id='planRoster' checked> Create resources for named assignees</label></div>";
    var preview = el("div", { class: "panel mt", style: "max-height:240px;overflow:auto" });
    var pt = el("table", { class: "table" });
    pt.innerHTML = "<thead><tr><th>Task</th><th>Stage</th><th>Priority</th><th>Assignee</th><th>Due</th></tr></thead>";
    var ptb = el("tbody");
    tasks.slice(0, 30).forEach(function (t) {
      ptb.appendChild(el("tr", null, "<td>" + esc(t.title) + "</td><td class='muted'>" + esc(t.stage || defaultStages[0]) + "</td><td>" + cap(t.priority) + "</td><td class='muted'>" + esc(t.assignee || "—") + "</td><td class='muted'>" + (t.due ? fmtDate(t.due) : "—") + "</td>"));
    });
    if (tasks.length > 30) ptb.appendChild(el("tr", null, "<td colspan='5' class='faint'>…and " + (tasks.length - 30) + " more</td>"));
    pt.appendChild(ptb); preview.appendChild(pt); body.appendChild(preview);

    modal("Plan a board from " + esc(filename), body, [
      { label: "Cancel", cls: "btn", fn: closeModal },
      { label: "Create board", cls: "btn primary", fn: function () {
        var name = $("#planName").value.trim() || "Imported Board";
        var stageNames = $("#planStages").value.split(",").map(function (s) { return s.trim(); }).filter(Boolean);
        if (!stageNames.length) stageNames = defaultStages;
        var makeRoster = $("#planRoster").checked;
        buildBoardFromTasks(name, stageNames, tasks, makeRoster);
        closeModal();
      } },
    ]);
  }

  function buildBoardFromTasks(name, stageNames, tasks, makeRoster) {
    mutate(function () {
      var columns = stageNames.map(function (s) { return { id: uid("col"), name: s, wip: 0 }; });
      var colByName = {};
      columns.forEach(function (c) { colByName[c.name.toLowerCase()] = c; });
      var board = { id: uid("b"), name: name, type: "imported", columns: columns, rosterIds: [] };

      // Resolve assignees → resources (reuse existing by name, else create).
      var resByName = {};
      state.resources.forEach(function (r) { resByName[r.name.toLowerCase()] = r; });
      function resolveAssignee(nm) {
        if (!nm) return null;
        var key = nm.trim().toLowerCase();
        if (resByName[key]) return resByName[key];
        if (!makeRoster) return null;
        var nr = { id: uid("r"), name: nm.trim(), role: "Contributor", dept: "Imported", capacityHrs: 36, costRate: 70, billRate: 120 };
        state.resources.push(nr); resByName[key] = nr;
        return nr;
      }

      var order = 0;
      tasks.forEach(function (t) {
        var col = (t.stage && colByName[t.stage.toLowerCase()]) || columns[0];
        var r = resolveAssignee(t.assignee);
        if (r && board.rosterIds.indexOf(r.id) === -1) board.rosterIds.push(r.id);
        var isLast = col === columns[columns.length - 1];
        state.cards.push({
          id: uid("c"), boardId: board.id, columnId: col.id, projectId: null,
          title: t.title, desc: t.desc || "", assigneeId: r ? r.id : null,
          priority: t.priority || "medium", type: t.type || "Task", labels: t.labels || [],
          due: t.due || null, startDate: t.start || null, estimateHours: t.estimate || 0, loggedHours: 0,
          progress: t.progress != null ? t.progress : (isLast ? 100 : 0),
          milestone: /milestone/i.test(t.type || ""), deps: [], checklist: [], comments: [],
          activity: [{ text: "Imported from file", ts: Date.now() }], createdAt: Date.now(), order: order++,
        });
      });
      if (!board.rosterIds.length) board.rosterIds = state.resources.slice(0, 5).map(function (r) { return r.id; });
      state.boards.push(board);
      state.activeBoardId = board.id;
    });
    ui.view = "board";
    render();
    toast("Board “" + name + "” created with " + tasks.length + " cards", "ok");
  }

  /* ---------- Scale testing ---------- */
  function generateLoadCards(n) {
    if (!canEdit()) { toast("Viewer role is read-only", "err"); return; }
    var b = activeBoard();
    var verbs = ["Review", "Draft", "Inspect", "Validate", "Calibrate", "Wire", "Test", "Document", "Procure", "Assemble", "Schedule", "Audit"];
    var nouns = ["actuator", "harness", "controller", "bracket", "sensor", "panel", "gearbox", "manifold", "enclosure", "relay", "fixture", "report"];
    mutate(function () {
      for (var i = 0; i < n; i++) {
        var col = b.columns[i % b.columns.length];
        var r = b.rosterIds[i % Math.max(1, b.rosterIds.length)];
        var due = new Date(); due.setDate(due.getDate() + (i % 40) - 10);
        state.cards.push({
          id: uid("c"), boardId: b.id, columnId: col.id, projectId: null,
          title: verbs[i % verbs.length] + " " + nouns[(i * 7) % nouns.length] + " #" + (i + 1),
          desc: "", assigneeId: r || null, priority: PRIORITIES[i % PRIORITIES.length], type: "Task",
          labels: [], due: due.toISOString().slice(0, 10), startDate: null,
          estimateHours: (i % 8) * 4, loggedHours: 0, progress: (i % 5) * 20, milestone: false,
          deps: [], checklist: [], comments: [], activity: [], createdAt: Date.now(), order: 1000 + i, _gen: true,
        });
      }
    });
    toast(n + " demo cards added to " + b.name, "ok");
  }
  function removeLoadCards() {
    if (!canEdit()) { toast("Viewer role is read-only", "err"); return; }
    var before = state.cards.length;
    mutate(function () { state.cards = state.cards.filter(function (c) { return !c._gen; }); });
    toast((before - state.cards.length) + " generated cards removed", "ok");
  }

  /* ----------------------------------------------------------------------- *
   * Toasts
   * ----------------------------------------------------------------------- */
  function toast(msg, kind) {
    var t = el("div", { class: "toast " + (kind || "") }, esc(msg));
    $("#toasts").appendChild(t);
    setTimeout(function () { t.style.opacity = "0"; t.style.transition = "opacity .3s"; }, 2200);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 2600);
  }

  /* ----------------------------------------------------------------------- *
   * Global events & init
   * ----------------------------------------------------------------------- */
  function bindGlobal() {
    $("#boardSelect").addEventListener("change", function () { state.activeBoardId = this.value; ui.filterAssignee = ""; save(); render(); });
    $("#roleSelect").addEventListener("change", function () {
      if (!canConfigureWorkspace()) { toast("Viewer role cannot change the simulated role", "err"); return; }
      mutate(function () { state.settings.role = $("#roleSelect").value; });
    });
    $("#themeBtn").addEventListener("click", function () { mutate(function () { state.settings.theme = state.settings.theme === "dark" ? "light" : "dark"; }); });
    $("#newCardBtn").addEventListener("click", function () { go("board"); openCardEditor(null); });
    $("#undoBtn").addEventListener("click", undo);
    $("#redoBtn").addEventListener("click", redo);
    $("#menuToggle").addEventListener("click", function () { ui.navOpen = !ui.navOpen; $("#app").classList.toggle("nav-open", ui.navOpen); });

    var search = $("#search");
    search.addEventListener("input", function () { runSearch(this.value); });
    search.addEventListener("blur", function () { setTimeout(function () { $("#searchResults").hidden = true; }, 160); });

    // Delegated link clicks (open card / project) inside views
    $("#view").addEventListener("click", function (e) {
      var oc = e.target.closest("[data-open-card]");
      if (oc) { var c = cardById(oc.dataset.openCard); if (c) { switchToCardBoard(c); openCardEditor(c.id); } return; }
      var op = e.target.closest("[data-open-project]");
      if (op) { openProject(op.dataset.openProject); return; }
    });

    document.addEventListener("keydown", function (e) {
      var typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) || document.activeElement.isContentEditable;
      var mod = e.ctrlKey || e.metaKey;
      if (mod && (e.key === "z" || e.key === "Z")) { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
      if (mod && (e.key === "y")) { e.preventDefault(); redo(); return; }
      if (typing) {
        if (e.key === "Escape") { document.activeElement.blur(); $("#searchResults").hidden = true; }
        return;
      }
      if (e.key === "Escape") { if (!$("#modalHost").hidden) closeModal(); $("#searchResults").hidden = true; }
      else if (e.key === "/") { e.preventDefault(); $("#search").focus(); }
      else if (e.key === "n" || e.key === "N") { if (showNewCardButtonForView("board", "")) { go("board"); openCardEditor(null); } }
      else if (e.key === "?") { go("help"); }
    });

    window.addEventListener("beforeprint", function () { /* hook for future */ });
  }

  function init() {
    accounts = loadAccounts();
    bindGlobal();
    // First launch: migrate any legacy single-user workspace into a default profile
    // so existing local data is preserved under a signed-in user.
    if (!accounts.users.length) {
      var legacy = localStorage.getItem(STORAGE_KEY);
      var u = { id: uid("u"), displayName: "Local Admin", role: "Admin", hasPass: false, salt: randSalt(), hash: null, createdAt: Date.now() };
      accounts.users.push(u); accounts.currentUserId = u.id; saveAccounts();
      if (legacy) { try { localStorage.setItem(wsKey(u.id), legacy); } catch (e) {} }
      markUnlocked(u.id);
    }
    var cu = currentUser();
    if (!cu || needsUnlock(cu)) { renderAuthGate(cu && cu.id); return; }
    enterApp(cu.id);
  }

  // Small public API for programmatic integration and testing (no DOM side effects).
  var publicApi = {
    version: APP_VERSION,
    schema: SCHEMA_VERSION,
    // Parse a project file's text into normalized PM tasks. See README "Import & plan".
    parseFile: function (text, filename) { return extractTasks(String(text), filename || "input.csv"); },
    parseCesP6Csv: function (text, filename) { return parseCesP6Csv(String(text), filename || "ces-p6.csv"); },
    // QA harness surface — drives the REAL calculation/mutation code paths so the
    // test suite exercises production logic, not a reimplementation.
    _qa: {
      resetDemo: function () { state = demoWorkspace(); accounts = accounts || loadAccounts(); return true; },
      state: function () { return state; },
      projectById: projectById, resourceById: resourceById, boardCards: boardCards,
      isDone: isDone, cardCost: cardCost, cardCommitted: cardCommitted,
      projectRollup: function (pid) { return projectRollup(projectById(pid)); },
      projectEVM: function (pid) { return projectEVM(projectById(pid)); },
      projectFinancialHistory: function (pid) { return projectFinancialHistory(projectById(pid)); },
      projectMultiplier: function (pid) { return projectMultiplier(projectRollup(projectById(pid))); },
      effortFieldState: effortFieldState,
      contributionMarginFromMultiplier: contributionMarginFromMultiplier,
      multiplierFromContributionMargin: multiplierFromContributionMargin,
      targetContributionMarginRatio: targetContributionMarginRatio,
      contributionMarginStatusClass: contributionMarginStatusClass,
      setTargetContributionMarginPct: function (v) { state.settings.targetContributionMarginPct = clamp(parseFloat(v) || 0, 0, 99.9); save(); },
      setApiConfig: function (endpoint, key) { state.settings.apiEndpoint = endpoint || ""; state.settings.apiKey = key && !/^sk-/.test(String(key)) ? key : ""; save(); },
      setFabricConnectorUrl: function (url) { state.integrationSettings = state.integrationSettings || {}; state.integrationSettings.fabricErmasAccountingUrl = url || ""; save(); return state.integrationSettings.fabricErmasAccountingUrl; },
      fabricConnectorUrl: function () { return (state.integrationSettings || {}).fabricErmasAccountingUrl || ""; },
      setPmSpecialistConfig: function (endpoint, vectorStoreId) { state.settings.pmSpecialistEndpoint = endpoint || PM_SPECIALIST_PROXY_DEFAULT; state.settings.openAiVectorStoreId = vectorStoreId || OPENAI_VECTOR_STORE_ID; save(); },
      pmSpecialistConfig: function () { return { endpoint: pmProxyBase(), vectorStoreId: pmVectorStoreId(), secretHandling: secretWarning() }; },
      rulesOfCreditValidation: rulesOfCreditValidation,
      applyRuleOfCredit: applyRuleOfCredit,
      procedureVersionStatus: procedureVersionStatus,
      refreshProcedureStatuses: refreshProcedureStatuses,
      localPmSearch: localPmSearch,
      pmSpecialistTabs: function () { return ["Ask", "Vector Store", "SharePoint Check"]; },
      pmSpecialistStoreOnly: function () { return true; },
      buildProjectPromptContext: buildProjectPromptContext,
      projectMetricRows: projectMetricRows,
      selectedMetricRows: selectedMetricRows,
      workflowSummaryRows: workflowSummaryRows,
      boardWipSummary: boardWipSummary,
      insights: insights,
      showNewCardButtonForView: showNewCardButtonForView,
      attachChangeOrderFileRaw: function (coId, att) { var co = (state.changeOrders || []).filter(function (x) { return x.id === coId; })[0]; var n = addChangeOrderAttachment(co, att); save(); return n; },
      pmAnswerSummary: pmAnswerSummary,
      pmProgressSupported: function () { return true; },
      vectorStoreAllFilesSupported: function () { return true; },
      pmCitationLabel: pmCitationLabel,
      pmCopyText: pmCopyText,
      vectorStoreFileName: vectorStoreFileName,
      ruleUsageCounts: ruleUsageCounts,
      addRuleOfCreditRaw: function (rule) { rule.id = rule.id || uid("roc"); state.rulesOfCredit.push(rule); save(); return rule.id; },
      updateRuleOfCreditRaw: function (id, patch) { var r = ruleById(id); if (!r) return false; Object.keys(patch || {}).forEach(function (k) { r[k] = patch[k]; }); save(); return true; },
      deleteRuleOfCreditRaw: function (id) { var out = deleteRuleOfCredit(id); save(); return out; },
      sortedRuleIdsForProject: function (pid) { var c = ruleUsageCounts(pid); return (state.rulesOfCredit || []).slice().sort(function (a, b) { return (c[b.id] || 0) - (c[a.id] || 0) || a.name.localeCompare(b.name); }).map(function (r) { return r.id; }); },
      projectResourceRows: projectResourceRows,
      cardAssignments: function (cardId) { return cardAssignments(cardById(cardId)); },
      cardResourceShare: function (cardId, rid) { return cardResourceShare(cardById(cardId), rid); },
      assignmentSummary: function (cardId) { return assignmentSummary(cardById(cardId)); },
      cardTeamHTML: function (cardId) { return cardTeamHTML(cardById(cardId)); },
      contractValue: function (pid) { return contractValue(projectById(pid)); },
      navIds: function () { return NAV.map(function (n) { return n.id; }); },
      projectWbsElements: projectWbsElements,
      wbsByCode: wbsByCode,
      cardWbsCode: cardWbsCode,
      isLegacyWbsCode: isLegacyWbsCode,
      isTask3Blocked: isTask3Blocked,
      dependencyCards: function (cardId) { return dependencyCards(cardById(cardId)); },
      dependencyBlockLabel: function (cardId) { return dependencyBlockLabel(cardById(cardId)); },
      cardMoveValidationMessage: function (cardOrId, colId) {
        var c = typeof cardOrId === "string" ? cardById(cardOrId) : cardOrId;
        return cardMoveValidationMessage(c, colId);
      },
      addWbsElementRaw: function (pid, w) { w.projectId = pid; state.wbsElements.push(normalizeWbsElement(w)); save(); return w.wbsCode; },
      deleteWbsElementRaw: function (pid, code) { var before = state.wbsElements.length; state.wbsElements = state.wbsElements.filter(function (w) { return !(w.projectId === pid && w.wbsCode === code); }); state.cards = state.cards.filter(function (c) { return !(c.projectId === pid && cardWbsCode(c) === code); }); save(); return before - state.wbsElements.length; },
      parseWbsCsv: parseWbsCsv,
      actionItemsForProject: function (pid) { return (state.actionItems || []).filter(function (a) { return a.projectId === pid; }); },
      reportPdfAvailable: function () { return true; },
      setAutoProgressFromKanban: function (v) { state.settings.autoProgressFromKanban = !!v; save(); },
      cleanGeneratedResourcePlaceholders: function () { return cleanGeneratedResourcePlaceholders(state); },
      deleteActionItemRaw: function (id) { var before = (state.actionItems || []).length; state.actionItems = (state.actionItems || []).filter(function (a) { return a.id !== id; }); save(); return before - state.actionItems.length; },
      addProjectPlanRaw: function (pid, plan) { var p = projectById(pid); p.projectPlans = p.projectPlans || []; plan.id = plan.id || uid("plan"); plan.uploadedAt = plan.uploadedAt || new Date().toISOString(); plan.status = plan.status || "Current"; p.projectPlans.push(plan); save(); return plan.id; },
      deleteProjectPlanRaw: function (pid, planId) { var p = projectById(pid); var before = (p.projectPlans || []).length; p.projectPlans = (p.projectPlans || []).filter(function (pl) { return pl.id !== planId; }); save(); return before - p.projectPlans.length; },
      changeOrdersForProject: function (pid) { return (state.changeOrders || []).filter(function (co) { return !pid || co.projectId === pid; }); },
      orgUnitOptions: function () { return ORG_UNITS.slice(); },
      projectOrgUnit: function (pid) { var p = projectById(pid); return p && p.orgUnit; },
      setProjectOrgUnitRaw: function (pid, org) { var p = projectById(pid); if (!p || ORG_UNITS.indexOf(org) === -1) return false; p.orgUnit = org; save(); return true; },
      fmtDate: fmtDate,
      selectedRuleId: function () { return ui.selectedRuleId || ""; },
      projectKanbanLayoutLabel: function (pid) { var p = projectById(pid); return p ? "Project Kanban · " + (p.unanetProjectCode || p.name) : ""; },
      programEVM: programEVM,
      resourceUtil: function (rid) { return resourceUtil(resourceById(rid)); },
      isInternalProject: function (pid) { return isInternalProject(projectById(pid)); },
      internalProjectClass: function (pid) { return internalProjectClass(projectById(pid)); },
      internalProjectMetrics: function (pid) { return internalProjectMetrics(projectById(pid)); },
      normalizeRisk: normalizeRisk,
      riskScore: riskScore,
      riskResidualScore: riskResidualScore,
      exportRiskRegisterCSV: exportRiskRegisterCSV,
      cardRemainingWeeks: function (cardId) { return cardRemainingWeeks(cardById(cardId)); },
      canManageResourcesFor: function (r) { return RESOURCE_MANAGE_ROLES.indexOf(r) !== -1; },
      canGovernRegistersFor: function (r) { return READONLY_ROLES.indexOf(r) === -1 && REGISTER_GOVERN_ROLES.indexOf(r) !== -1; },
      importResourcesFromText: importResourcesFromText,
      resourceCsvTemplate: resourceCsvTemplate,
      parseCesP6Csv: function (text, filename) { return parseCesP6Csv(String(text), filename || "ces-p6.csv"); },
      importWbsTasks: importWbsTasks,
      exportProjectPackage: exportProjectPackage,
      resourceEngagementRollup: resourceEngagementRollup,
      taskVarianceFlags: function (cardId) { return taskVarianceFlags(cardById(cardId)); },
      taskVarianceClass: function (cardId, field) { return taskVarianceClass(cardById(cardId), field); },
      cardBudget: function (cardId) { return cardBudget(cardById(cardId)); },
      cardConsumed: function (cardId) { return cardConsumed(cardById(cardId)); },
      cardRemaining: function (cardId) { return cardRemaining(cardById(cardId)); },
      portfolioTotals: portfolioTotals,
      criticalPath: function (boardId) { return criticalPath(boardCards(boardId)); },
      lastColumnId: function (boardId) { var b = state.boards.filter(function (x) { return x.id === boardId; })[0]; return b.columns[b.columns.length - 1].id; },
      columnIds: function (boardId) { var b = state.boards.filter(function (x) { return x.id === boardId; })[0]; return b.columns.map(function (c) { return c.id; }); },
      stageProgress: function (boardId, colId) { var b = state.boards.filter(function (x) { return x.id === boardId; })[0]; return stageProgress(b, colId); },
      // Change control + project admin
      changeOrders: function () { return state.changeOrders; },
      coBudgetImpact: coBudgetImpact, coScheduleImpact: coScheduleImpact,
      addProjectRaw: function (o) { o.id = o.id || uid("p"); o.baseline = { budget: o.budget, endDate: o.endDate }; state.projects.push(o); save(); return o.id; },
      deleteProjectRaw: function (id) { state.changeOrders = (state.changeOrders || []).filter(function (co) { return co.projectId !== id; }); state.cards.forEach(function (c) { if (c.projectId === id) c.projectId = null; }); state.projects = state.projects.filter(function (x) { return x.id !== id; }); save(); },
      createCORaw: function (co) { co.id = co.id || uid("co"); co.applied = false; co.createdCardIds = []; if (co.scopeItems == null) co.scopeItems = []; state.changeOrders.push(co); save(); return co.id; },
      setCOStatusRaw: function (coId, status) { var co = state.changeOrders.filter(function (x) { return x.id === coId; })[0]; co.status = status; reconcileChangeOrder(co); save(); return co; },
      coById: function (id) { return state.changeOrders.filter(function (x) { return x.id === id; })[0]; },
      cardsForProject: function (pid) { return state.cards.filter(function (c) { return c.projectId === pid; }); },
      rescheduleCardRaw: function (cardId, deltaDays) { var c = rescheduleCard(cardId, deltaDays); save(); return c; },
      moveCardRaw: function (cardId, colId) { var c = cardById(cardId); var b = state.boards.filter(function (x) { return x.id === c.boardId; })[0]; var prevActive = state.activeBoardId; state.activeBoardId = c.boardId; moveCard(cardId, colId, null); state.activeBoardId = prevActive; },
      addCardRaw: function (card) { state.cards.push(card); save(); },
      setEstimate: function (cardId, est) { var c = cardById(cardId); c.estimateHours = est; save(); },
      historyTail: function () { return state.history[state.history.length - 1]; },
      canFinanceFor: function (r) { return FINANCIAL_ROLES.indexOf(r) !== -1; },
      canEditFor: function (r) { return READONLY_ROLES.indexOf(r) === -1; },
      canConfigureWorkspaceFor: function (r) { return READONLY_ROLES.indexOf(r) === -1; },
      workspaceTabsFor: function (r) {
        var tabs = ["Summary", "WBS List", "Kanban", "Gantt", "Resources"];
        if (FINANCIAL_ROLES.indexOf(r) !== -1) tabs.push("Financials");
        tabs.push("Risk Register", "Action Items", "Changes");
        if (FINANCIAL_ROLES.indexOf(r) !== -1) tabs.push("FV/EAC");
        tabs.push("Attachments", "Reports");
        return tabs;
      },
      filterMetricsForRoleFor: function (rows, r) {
        if (FINANCIAL_ROLES.indexOf(r) !== -1) return rows;
        return rows.filter(function (row) {
          if (row.group === "Financial") return false;
          if (row.group === "Executive") return row.metric === "Progress";
          if (row.group === "EVM") return row.metric === "CPI" || row.metric === "SPI";
          return true;
        });
      },
      metricGroupOptionsFor: function (pid, r) {
        var p = projectById(pid);
        var base = FINANCIAL_ROLES.indexOf(r) !== -1 ? ["Executive", "Financial", "EVM", "P6 Source", "All"] : ["EVM", "P6 Source", "All"];
        return p && (p.evmOverride || p.financialOverride || (p.sourceSystem && p.sourceSystem !== "Local")) ? ["Schedule Controls"].concat(base) : base;
      },
      uid: uid,
    },
  };
  window.TechniekOpsBoard = publicApi;

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
