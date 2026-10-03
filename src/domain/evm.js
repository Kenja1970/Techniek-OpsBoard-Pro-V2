/**
 * @fileoverview Pure Earned Value Management (EVM) and Financial Performance Domain Logic.
 * Standards: PMI / PMBOK 7th Edition, ISO 21508:2018 (Earned Value Management).
 *
 * Constraints:
 * - Pure calculations only: zero DOM, zero storage, zero framework dependencies.
 * - Under 300 lines per file (AGENTS.md §2).
 */

/**
 * Clamp a number within [min, max].
 * @param {number} val
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(val, min, max) {
  if (isNaN(val)) return min;
  return Math.max(min, Math.min(max, val));
}

/**
 * Round a number to 2 decimal places.
 * @param {number} n
 * @returns {number}
 */
export function round2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Compute project-level Earned Value metrics.
 *
 * @param {Object} params
 * @param {number} params.bac - Budget at Completion (baseline planned cost)
 * @param {number} params.progress - Physical progress percentage (0 - 100)
 * @param {number} params.spent - Actual Cost (AC) of work performed
 * @param {string|Date} [params.startDate] - Scheduled start date
 * @param {string|Date} [params.endDate] - Scheduled finish date
 * @param {string|Date} [params.asOfDate] - Status / reporting date (defaults to today)
 * @param {Object} [params.evmOverride] - External schedule sync overrides (e.g. Primavera P6)
 * @returns {Object} EVM metrics package
 */
export function computeProjectEVM(params) {
  const { bac = 0, progress = 0, spent = 0, startDate, endDate, asOfDate, evmOverride } = params;

  if (evmOverride) {
    const o = evmOverride;
    const cpiOverride = o.ac > 0 ? o.ev / o.ac : (o.cpi || 1);
    const spiOverride = o.pv > 0 ? o.ev / o.pv : (o.spi || 1);
    return {
      bac: o.bac || 0,
      ev: o.ev || 0,
      ac: o.ac || 0,
      pv: o.pv || 0,
      cpi: cpiOverride,
      spi: spiOverride,
      cv: (o.ev || 0) - (o.ac || 0),
      sv: (o.ev || 0) - (o.pv || 0),
      eac: cpiOverride > 0 ? (o.bac || 0) / cpiOverride : (o.bac || 0),
      sourceFile: o.sourceFile || "",
      p6EstimateAtCompletion: o.p6EstimateAtCompletion || null,
    };
  }

  const ev = bac * (clamp(progress, 0, 100) / 100);
  const ac = Math.max(0, spent);
  let pv = ev;

  if (startDate && endDate) {
    const s = new Date(startDate).getTime();
    const e = new Date(endDate).getTime();
    if (e > s) {
      const now = asOfDate ? new Date(asOfDate).getTime() : Date.now();
      const elapsed = clamp((now - s) / (e - s), 0, 1);
      pv = bac * elapsed;
    }
  }

  const cpi = ac > 0 ? ev / ac : 1;
  const spi = pv > 0 ? ev / pv : 1;
  const cv = ev - ac;
  const sv = ev - pv;
  const eac = cpi > 0 ? bac / cpi : bac;

  return {
    bac,
    ev,
    ac,
    pv,
    cpi,
    spi,
    cv,
    sv,
    eac,
  };
}

/**
 * Compute portfolio / program roll-up EVM.
 * Indices use aggregate sums (ΣEV / ΣAC, ΣEV / ΣPV) per PMI standards,
 * rather than an arithmetic mean of per-project indices.
 *
 * @param {Array<Object>} projectEVMList - List of individual project EVM records
 * @returns {Object} Program aggregate EVM
 */
export function computeProgramEVM(projectEVMList = []) {
  const totals = { bac: 0, pv: 0, ev: 0, ac: 0 };
  for (const v of projectEVMList) {
    totals.bac += v.bac || 0;
    totals.pv += v.pv || 0;
    totals.ev += v.ev || 0;
    totals.ac += v.ac || 0;
  }

  const cpi = totals.ac > 0 ? totals.ev / totals.ac : 1;
  const spi = totals.pv > 0 ? totals.ev / totals.pv : 1;
  const cv = totals.ev - totals.ac;
  const sv = totals.ev - totals.pv;
  const eac = cpi > 0 ? totals.bac / cpi : totals.bac;

  return {
    bac: totals.bac,
    pv: totals.pv,
    ev: totals.ev,
    ac: totals.ac,
    cpi,
    spi,
    cv,
    sv,
    eac,
    projects: projectEVMList.length,
  };
}

/**
 * Calculate billing multiplier from revenue and spent cost.
 * @param {number} earnedRevenue
 * @param {number} billableSpent
 * @returns {number|null}
 */
export function computeMultiplier(earnedRevenue, billableSpent) {
  return earnedRevenue > 0 && billableSpent > 0 ? earnedRevenue / billableSpent : null;
}

/**
 * Calculate contribution margin ratio from multiplier.
 * Formula: 1 - (1 / multiplier)
 * @param {number} multiplier
 * @returns {number|null}
 */
export function computeContributionMargin(multiplier) {
  return multiplier > 0 && isFinite(multiplier) ? 1 - (1 / multiplier) : null;
}

/**
 * Calculate required multiplier from a target contribution margin.
 * Formula: 1 / (1 - cm)
 * @param {number} cm - Contribution margin ratio (e.g. 0.40 for 40%)
 * @returns {number|null}
 */
export function computeMultiplierFromContributionMargin(cm) {
  return cm != null && isFinite(cm) && cm < 1 ? 1 / (1 - cm) : null;
}
