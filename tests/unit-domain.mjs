/**
 * @fileoverview Unit tests for pure domain modules (EVM and CPM).
 * Verified in CI and local `npm test` gate.
 */
import assert from "node:assert/strict";
import {
  computeProjectEVM,
  computeProgramEVM,
  computeMultiplier,
  computeContributionMargin,
  computeMultiplierFromContributionMargin,
} from "../src/domain/evm.js";
import {
  computeCriticalPath,
  topologicalSort,
  taskDurationDays,
} from "../src/domain/cpm.js";

console.log("Running domain unit tests...");

// --- Suite 1: EVM Domain Tests ---
{
  // Test 1: Basic EVM calculations
  const evm = computeProjectEVM({
    bac: 10000,
    progress: 50,
    spent: 4000,
  });
  assert.equal(evm.bac, 10000, "BAC matches");
  assert.equal(evm.ev, 5000, "EV is 50% of 10000");
  assert.equal(evm.ac, 4000, "AC matches spent");
  assert.equal(evm.cpi, 1.25, "CPI is 5000/4000 = 1.25");
  assert.equal(evm.cv, 1000, "CV is EV - AC = 1000");
  assert.equal(evm.eac, 8000, "EAC is BAC / CPI = 8000");
  console.log("✔ EVM: Basic calculations pass");

  // Test 2: Time-phased Planned Value (PV)
  const now = new Date("2026-06-15T00:00:00Z");
  const evmSchedule = computeProjectEVM({
    bac: 20000,
    progress: 25,
    spent: 6000,
    startDate: "2026-06-01T00:00:00Z",
    endDate: "2026-07-01T00:00:00Z",
    asOfDate: now,
  });
  // Approx 14/30 elapsed ~ 0.466
  assert.ok(evmSchedule.pv > 9000 && evmSchedule.pv < 10000, "PV reflects time-phased straight-line progress");
  assert.ok(evmSchedule.spi < 1.0, "Behind schedule SPI < 1.0");
  console.log("✔ EVM: Schedule time-phasing pass");

  // Test 3: External schedule override (e.g. Primavera P6)
  const evmOverride = computeProjectEVM({
    bac: 50000,
    progress: 20,
    spent: 10000,
    evmOverride: {
      bac: 50000,
      ev: 25000,
      ac: 20000,
      pv: 30000,
      sourceFile: "project.xer",
      p6EstimateAtCompletion: 45000,
    },
  });
  assert.equal(evmOverride.ev, 25000, "Override EV respected");
  assert.equal(evmOverride.ac, 20000, "Override AC respected");
  assert.equal(evmOverride.cpi, 1.25, "Override CPI calculated");
  assert.equal(evmOverride.sourceFile, "project.xer", "Override sourceFile preserved");
  console.log("✔ EVM: P6 Override pass");

  // Test 4: Program-level PMI aggregate rollup
  const projA = computeProjectEVM({ bac: 10000, progress: 100, spent: 5000 }); // EV=10000, AC=5000
  const projB = computeProjectEVM({ bac: 10000, progress: 10, spent: 5000 });  // EV=1000, AC=5000
  const program = computeProgramEVM([projA, projB]);
  // Total EV = 11000, Total AC = 10000 -> Aggregate CPI = 1.10
  assert.equal(program.bac, 20000, "Program BAC = 20000");
  assert.equal(program.ev, 11000, "Program EV = 11000");
  assert.equal(program.ac, 10000, "Program AC = 10000");
  assert.equal(program.cpi, 1.1, "Program CPI is aggregate 11000/10000 = 1.10 (not mean of 2.0 and 0.2)");
  console.log("✔ EVM: Program aggregate rollup pass");

  // Test 5: Multiplier & Contribution Margin formulas
  const mult = computeMultiplier(25000, 10000);
  assert.equal(mult, 2.5, "Multiplier is 25000/10000 = 2.5");
  const cm = computeContributionMargin(mult);
  assert.equal(cm, 0.6, "Contribution margin is 1 - (1 / 2.5) = 0.60");
  const roundtripMult = computeMultiplierFromContributionMargin(cm);
  assert.equal(roundtripMult, 2.5, "Roundtrip multiplier from margin equals 2.5");
  console.log("✔ EVM: Commercial multiplier & margin conversions pass");
}

// --- Suite 2: CPM Domain Tests ---
{
  // Test 6: Task duration in workdays
  assert.equal(taskDurationDays({ estimateHours: 16 }), 2, "16 hours = 2 workdays");
  assert.equal(taskDurationDays({ estimateHours: 0 }), 1, "0 hours clamps to min 1 workday");
  console.log("✔ CPM: Task workday duration pass");

  // Test 7: Linear critical path (A -> B -> C)
  const linearCards = [
    { id: "A", estimateHours: 8, deps: [] },      // 1 day
    { id: "B", estimateHours: 16, deps: ["A"] },  // 2 days
    { id: "C", estimateHours: 24, deps: ["B"] },  // 3 days
  ];
  const linearCp = computeCriticalPath(linearCards);
  assert.equal(linearCp.lengthDays, 6, "Total path is 1 + 2 + 3 = 6 days");
  assert.ok(linearCp.set["A"] && linearCp.set["B"] && linearCp.set["C"], "All nodes on linear path are critical");
  console.log("✔ CPM: Linear critical path pass");

  // Test 8: Branching critical path
  // Start -> Branch1 (5 days) -> End
  // Start -> Branch2 (10 days) -> End
  const branchCards = [
    { id: "start", estimateHours: 8, deps: [] },
    { id: "b1", estimateHours: 40, deps: ["start"] }, // 5 days
    { id: "b2", estimateHours: 80, deps: ["start"] }, // 10 days
    { id: "end", estimateHours: 8, deps: ["b1", "b2"] },
  ];
  const branchCp = computeCriticalPath(branchCards);
  assert.equal(branchCp.lengthDays, 12, "Critical path chooses longest branch (1 + 10 + 1 = 12 days)");
  assert.ok(branchCp.set["start"], "start is on critical path");
  assert.ok(branchCp.set["b2"], "b2 (10 days) is on critical path");
  assert.ok(!branchCp.set["b1"], "b1 (5 days) is NOT on critical path");
  assert.ok(branchCp.set["end"], "end is on critical path");
  console.log("✔ CPM: Branching critical path pass");

  // Test 9: Cycle guard in Critical Path
  const cyclicCards = [
    { id: "x", estimateHours: 8, deps: ["y"] },
    { id: "y", estimateHours: 8, deps: ["x"] },
  ];
  const cyclicCp = computeCriticalPath(cyclicCards);
  assert.ok(cyclicCp.lengthDays > 0, "Cyclic graph does not infinite-loop or throw");
  console.log("✔ CPM: Cyclic dependency guard pass");

  // Test 10: Topological Sort
  const topoOk = topologicalSort(linearCards);
  assert.equal(topoOk.hasCycle, false, "Linear graph has no cycle");
  assert.deepEqual(topoOk.sorted, ["A", "B", "C"], "Topological ordering correct");

  const topoCycle = topologicalSort(cyclicCards);
  assert.equal(topoCycle.hasCycle, true, "Cyclic graph detected");
  console.log("✔ CPM: Topological sort and cycle detection pass");
}

console.log("\nALL DOMAIN UNIT TESTS PASSED (10/10)!");
