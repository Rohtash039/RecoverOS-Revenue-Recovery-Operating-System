import { RecoveryCase } from '../../models/RecoveryCase.js';
import { RecoveryAction } from '../../models/RecoveryAction.js';
import { CASE_STATES, DIAGNOSIS_CATEGORIES } from '../../config/constants.js';

let cachedAnalytics = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 5000;

export function invalidateAnalyticsCache() {
  cachedAnalytics = null;
  lastCacheTime = 0;
}

/**
 * Calculates authoritative financial analytics dynamically from raw MongoDB records.
 * Uses 5-second in-memory caching with automatic invalidation on mutating recovery actions.
 */
export async function getDashboardAnalytics(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedAnalytics && (now - lastCacheTime < CACHE_TTL_MS)) {
    return cachedAnalytics;
  }

  const cases = await RecoveryCase.find({});
  const totalActions = await RecoveryAction.countDocuments({});

  let initialRevenueAtRisk = 0;
  let recoveredRevenue = 0;
  let expectedRecovery = 0;

  const casesByState = {
    [CASE_STATES.AT_RISK]: 0,
    [CASE_STATES.SCORING]: 0,
    [CASE_STATES.ANALYZING]: 0,
    [CASE_STATES.ACTION_PLANNED]: 0,
    [CASE_STATES.POLICY_CHECK]: 0,
    [CASE_STATES.EXECUTING]: 0,
    [CASE_STATES.OBSERVING]: 0,
    [CASE_STATES.RECOVERED]: 0,
    [CASE_STATES.ESCALATED]: 0,
    [CASE_STATES.STOPPED]: 0,
    [CASE_STATES.EXPIRED]: 0
  };

  const categoryMap = {};
  for (const cat of DIAGNOSIS_CATEGORIES) {
    categoryMap[cat] = { initialAtRisk: 0, recovered: 0, casesCount: 0, recoveredCount: 0 };
  }

  let analyzedCount = 0;
  let actionableCount = 0;
  let executedCount = 0;
  let recoveredCount = 0;

  for (const c of cases) {
    initialRevenueAtRisk += c.initialRevenueAtRisk || 0;
    expectedRecovery += c.expectedRecovery || 0;

    if (casesByState[c.state] !== undefined) {
      casesByState[c.state]++;
    }

    if (c.state === CASE_STATES.RECOVERED) {
      recoveredRevenue += c.recoveredAmount || 0;
      recoveredCount++;
    }

    const cat = c.normalizedFailureCategory || 'UNKNOWN';
    if (!categoryMap[cat]) {
      categoryMap[cat] = { initialAtRisk: 0, recovered: 0, casesCount: 0, recoveredCount: 0 };
    }
    categoryMap[cat].initialAtRisk += c.initialRevenueAtRisk || 0;
    categoryMap[cat].casesCount++;

    if (c.state === CASE_STATES.RECOVERED) {
      categoryMap[cat].recovered += c.recoveredAmount || 0;
      categoryMap[cat].recoveredCount++;
    }

    // Funnel counts
    if (c.state !== CASE_STATES.AT_RISK && c.state !== CASE_STATES.SCORING) {
      analyzedCount++;
    }
    if (c.policyEvaluation?.decision === 'APPROVE' || c.policyEvaluation?.decision === 'MODIFY') {
      actionableCount++;
    }
    if (c.retryCount > 0 || c.state === CASE_STATES.RECOVERED || c.state === CASE_STATES.EXECUTING || c.state === CASE_STATES.OBSERVING) {
      executedCount++;
    }
  }

  const remainingRevenueAtRisk = Math.max(0, initialRevenueAtRisk - recoveredRevenue);
  const recoveryRate = initialRevenueAtRisk > 0 
    ? Number(((recoveredRevenue / initialRevenueAtRisk) * 100).toFixed(2)) 
    : 0;

  const expectedRecoveryAttainment = expectedRecovery > 0 
    ? Number(((recoveredRevenue / expectedRecovery) * 100).toFixed(2)) 
    : 0;

  const terminalStates = [CASE_STATES.RECOVERED, CASE_STATES.STOPPED, CASE_STATES.EXPIRED];
  const activeCasesCount = cases.filter(c => !terminalStates.includes(c.state)).length;

  const recoveryByFailureCategory = Object.entries(categoryMap)
    .filter(([_, data]) => data.casesCount > 0)
    .map(([category, data]) => ({
      category,
      initialAtRisk: data.initialAtRisk,
      recovered: data.recovered,
      casesCount: data.casesCount,
      recoveredCount: data.recoveredCount,
      rate: data.initialAtRisk > 0 ? Number(((data.recovered / data.initialAtRisk) * 100).toFixed(2)) : 0
    }))
    .sort((a, b) => b.initialAtRisk - a.initialAtRisk);

  const interventionEfficiency = executedCount > 0 
    ? Number(((recoveredCount / executedCount) * 100).toFixed(2)) 
    : 0;

  const result = {
    initialRevenueAtRisk,
    recoveredRevenue,
    remainingRevenueAtRisk,
    recoveryRate,
    expectedRecovery,
    expectedRecoveryAttainment,
    activeCasesCount,
    totalCasesCount: cases.length,
    casesByState,
    pipelineFunnel: {
      detectedAtRisk: cases.length,
      analyzed: analyzedCount,
      actionable: actionableCount,
      executed: executedCount,
      recovered: recoveredCount
    },
    recoveryByFailureCategory,
    expectedVsActual: {
      expected: expectedRecovery,
      actual: recoveredRevenue,
      variance: recoveredRevenue - expectedRecovery,
      expectedRecoveryAttainment
    },
    interventionEfficiency,
    totalActionsRecorded: totalActions
  };

  cachedAnalytics = result;
  lastCacheTime = Date.now();
  return result;
}
