import { connectDB, disconnectDB } from '../config/db.js';
import { Customer } from '../models/Customer.js';
import { Transaction } from '../models/Transaction.js';
import { RecoveryCase } from '../models/RecoveryCase.js';
import { RecoveryAction } from '../models/RecoveryAction.js';
import { AuditLog } from '../models/AuditLog.js';
import { SimulationBatch } from '../models/SimulationBatch.js';
import { generateSeedDataset } from '../services/simulation/seedDataGenerator.js';
import { startBatchRun, getBatchStatus } from '../services/simulation/batchOrchestrator.js';
import { getDashboardAnalytics } from '../services/analytics/analyticsService.js';
import { handleHumanAction } from '../services/workflow/workflowEngine.js';
import { 
  CASE_STATES, 
  HARD_PROHIBITED_CODES, 
  POLICY_CONFIG, 
  AUDIT_ACTORS 
} from '../config/constants.js';

async function waitBatch(batchId) {
  while (true) {
    const status = await getBatchStatus(batchId);
    if (status.status === 'COMPLETED' || status.status === 'FAILED') {
      return status;
    }
    await new Promise(r => setTimeout(r, 40));
  }
}

async function runBatchAudit() {
  console.log('====================================================================');
  console.log('       RECOVEROS — P0 BATCH ECONOMICS & DASHBOARD AUDIT             ');
  console.log('====================================================================\n');

  await connectDB();

  // -------------------------------------------------------------------------
  // 1. CLEAN RESET AUDIT
  // -------------------------------------------------------------------------
  console.log('>>> [1. CLEAN RESET BASELINE AUDIT]');
  await generateSeedDataset();

  const baselineCases = await RecoveryCase.find({});
  const baselineActions = await RecoveryAction.countDocuments();
  const baselineBatches = await SimulationBatch.countDocuments();
  const baselineAnalytics = await getDashboardAnalytics();

  const atRiskCases = baselineCases.filter(c => c.state === CASE_STATES.AT_RISK);
  const recoveredCases0 = baselineCases.filter(c => c.state === CASE_STATES.RECOVERED);
  const escalatedCases0 = baselineCases.filter(c => c.state === CASE_STATES.ESCALATED);
  const stoppedCases0 = baselineCases.filter(c => c.state === CASE_STATES.STOPPED);

  console.log(`- Total Cases in DB: ${baselineCases.length} (Expected: 100)`);
  console.log(`- Cases in AT_RISK: ${atRiskCases.length} (Expected: 100)`);
  console.log(`- Cases in RECOVERED: ${recoveredCases0.length} (Expected: 0)`);
  console.log(`- Cases in ESCALATED: ${escalatedCases0.length} (Expected: 0)`);
  console.log(`- Cases in STOPPED: ${stoppedCases0.length} (Expected: 0)`);
  console.log(`- Initial Revenue at Risk: ₹${baselineAnalytics.initialRevenueAtRisk.toLocaleString('en-IN')}`);
  console.log(`- Recovered Revenue: ₹${baselineAnalytics.recoveredRevenue.toLocaleString('en-IN')} (Expected: ₹0)`);
  console.log(`- Remaining Revenue at Risk: ₹${baselineAnalytics.remainingRevenueAtRisk.toLocaleString('en-IN')}`);
  console.log(`- Existing Recovery Actions: ${baselineActions} (Expected: 0)`);
  console.log(`- Active Simulation Batches: ${baselineBatches} (Expected: 0)`);

  const resetPass = (
    baselineCases.length === 100 &&
    atRiskCases.length === 100 &&
    recoveredCases0.length === 0 &&
    escalatedCases0.length === 0 &&
    stoppedCases0.length === 0 &&
    baselineAnalytics.recoveredRevenue === 0 &&
    baselineAnalytics.remainingRevenueAtRisk === baselineAnalytics.initialRevenueAtRisk &&
    baselineActions === 0 &&
    baselineBatches === 0
  );
  console.log(`Clean Reset Baseline Result: ${resetPass ? '✅ PASS' : '❌ FAIL'}\n`);

  // -------------------------------------------------------------------------
  // 2. REAL 100-CASE BATCH EXECUTION & PROGRESS AUDIT
  // -------------------------------------------------------------------------
  console.log('>>> [2. REAL 100-CASE BATCH RUN]');
  const batchLaunch = await startBatchRun('FAST');
  console.log(`- Batch Launched with ID: ${batchLaunch.batchId}`);

  const batchFinal = await waitBatch(batchLaunch.batchId);
  console.log(`- Batch Final Status: ${batchFinal.status}`);
  console.log(`- Processed Cases: ${batchFinal.processedCases} / ${batchFinal.totalCases}`);
  console.log(`- Batch Reported Recovered Cases: ${batchFinal.recoveredCases}`);
  console.log(`- Batch Reported Escalated Cases: ${batchFinal.escalatedCases}`);
  console.log(`- Batch Reported Stopped Cases: ${batchFinal.stoppedCases}`);
  console.log(`- Batch Reported Recovered Amount: ₹${batchFinal.recoveredAmount.toLocaleString('en-IN')}`);

  // -------------------------------------------------------------------------
  // 3. FINAL BATCH STATE & NON-INTERMEDIATE STATE AUDIT
  // -------------------------------------------------------------------------
  console.log('\n>>> [3. FINAL CASE STATE INTEGRITY AUDIT]');
  const postBatchCases = await RecoveryCase.find({});
  const invalidIntermediateStates = postBatchCases.filter(c => [
    CASE_STATES.SCORING,
    CASE_STATES.ANALYZING,
    CASE_STATES.ACTION_PLANNED,
    CASE_STATES.POLICY_CHECK,
    CASE_STATES.EXECUTING,
    CASE_STATES.OBSERVING
  ].includes(c.state));

  const countRecovered = postBatchCases.filter(c => c.state === CASE_STATES.RECOVERED).length;
  const countEscalated = postBatchCases.filter(c => c.state === CASE_STATES.ESCALATED).length;
  const countStopped = postBatchCases.filter(c => c.state === CASE_STATES.STOPPED).length;
  const countExpired = postBatchCases.filter(c => c.state === CASE_STATES.EXPIRED).length;

  console.log(`- Recovered Cases: ${countRecovered}`);
  console.log(`- Escalated Cases (Pending Human Review): ${countEscalated}`);
  console.log(`- Stopped Cases: ${countStopped}`);
  console.log(`- Expired Cases: ${countExpired}`);
  console.log(`- Cases in Invalid Intermediate States: ${invalidIntermediateStates.length} (Expected: 0)`);

  const statesPass = invalidIntermediateStates.length === 0 && (countRecovered + countEscalated + countStopped + countExpired === 100);
  console.log(`State Integrity Result: ${statesPass ? '✅ PASS' : '❌ FAIL'}\n`);

  // -------------------------------------------------------------------------
  // 4. FINANCIAL ATTRIBUTION & ANALYTICS AUDIT
  // -------------------------------------------------------------------------
  console.log('>>> [4. DYNAMIC FINANCIAL ATTRIBUTION AUDIT]');
  const analytics = await getDashboardAnalytics();

  console.log(`- A. Initial Revenue at Risk: ₹${analytics.initialRevenueAtRisk.toLocaleString('en-IN')}`);
  console.log(`- B. Recovered Revenue: ₹${analytics.recoveredRevenue.toLocaleString('en-IN')}`);
  console.log(`- C. Remaining Revenue at Risk: ₹${analytics.remainingRevenueAtRisk.toLocaleString('en-IN')}`);
  console.log(`- D. Recovery Rate: ${analytics.recoveryRate}%`);
  console.log(`- E. Pre-execution Expected Recovery: ₹${analytics.expectedRecovery.toLocaleString('en-IN')}`);
  console.log(`- F. Expected Recovery Attainment: ${analytics.expectedRecoveryAttainment}%`);
  console.log(`- Intervention Efficiency: ${analytics.interventionEfficiency}%`);

  const mathCheckPass = (
    analytics.remainingRevenueAtRisk === (analytics.initialRevenueAtRisk - analytics.recoveredRevenue) &&
    analytics.recoveredRevenue <= analytics.initialRevenueAtRisk &&
    analytics.recoveryRate === Number(((analytics.recoveredRevenue / analytics.initialRevenueAtRisk) * 100).toFixed(2))
  );
  console.log(`Financial Attribution Math: ${mathCheckPass ? '✅ PASS' : '❌ FAIL'}\n`);

  // -------------------------------------------------------------------------
  // 5. FRAUD & HARD-PROHIBITED ACCOUNTING AUDIT
  // -------------------------------------------------------------------------
  console.log('>>> [5. FRAUD & HARD-PROHIBITED ACCOUNTING AUDIT]');
  const hardTxns = await Transaction.find({ failureCode: { $in: HARD_PROHIBITED_CODES } });
  const hardTxnIds = hardTxns.map(t => t.transactionId);
  const hardCases = await RecoveryCase.find({ transactionId: { $in: hardTxnIds } });

  let hardScoreFailures = 0;
  let hardRecoveredFailures = 0;
  let hardStateFailures = 0;

  for (const hc of hardCases) {
    if (hc.recoveryScore !== 0) hardScoreFailures++;
    if (hc.recoveredAmount !== 0) hardRecoveredFailures++;
    if (hc.state !== CASE_STATES.STOPPED) hardStateFailures++;
  }

  console.log(`- Total Hard-Prohibited Cases: ${hardCases.length}`);
  console.log(`- Hard-Prohibited Cases with ROS > 0: ${hardScoreFailures} (Expected: 0)`);
  console.log(`- Hard-Prohibited Cases with Recovered > 0: ${hardRecoveredFailures} (Expected: 0)`);
  console.log(`- Hard-Prohibited Cases in Non-STOPPED State: ${hardStateFailures} (Expected: 0)`);

  const fraudAccountingPass = hardScoreFailures === 0 && hardRecoveredFailures === 0 && hardStateFailures === 0;
  console.log(`Fraud Accounting Result: ${fraudAccountingPass ? '✅ PASS' : '❌ FAIL'}\n`);

  // -------------------------------------------------------------------------
  // 6. HIGH-VALUE ESCALATION ACCOUNTING AUDIT
  // -------------------------------------------------------------------------
  console.log('>>> [6. HIGH-VALUE ESCALATION ACCOUNTING AUDIT]');
  const highValueCases = postBatchCases.filter(c => c.initialRevenueAtRisk >= POLICY_CONFIG.HIGH_VALUE_THRESHOLD);
  console.log(`- Total High-Value Cases (>= ₹50,000): ${highValueCases.length}`);

  let hvAutoRecovered = 0;
  let hvInEscalated = 0;
  for (const hv of highValueCases) {
    if (hv.state === CASE_STATES.RECOVERED) hvAutoRecovered++;
    if (hv.state === CASE_STATES.ESCALATED) hvInEscalated++;
    console.log(`  * ${hv.recoveryCaseId} (${hv.transactionId}): Amount=₹${hv.initialRevenueAtRisk.toLocaleString('en-IN')}, State=${hv.state}, Recovered=₹${hv.recoveredAmount}`);
  }

  console.log(`- High-Value Cases Auto-Recovered without Human Approval: ${hvAutoRecovered} (Expected: 0)`);
  console.log(`- High-Value Cases in ESCALATED State: ${hvInEscalated} (Expected: 4)`);

  const highValuePass = hvAutoRecovered === 0 && hvInEscalated === highValueCases.length;
  console.log(`High-Value Escalation Accounting Result: ${highValuePass ? '✅ PASS' : '❌ FAIL'}\n`);

  // -------------------------------------------------------------------------
  // 7. RETRY EXECUTION ACCOUNTING AUDIT
  // -------------------------------------------------------------------------
  console.log('>>> [7. RETRY EXECUTION ACCOUNTING AUDIT]');
  const retryActions = await RecoveryAction.find({ attemptNumber: 2 });
  const retryCases = await RecoveryCase.find({ retryCount: { $gte: 2 } });
  const overLimitCases = await RecoveryCase.find({ retryCount: { $gt: 2 } });

  console.log(`- Second-Attempt Actions Recorded: ${retryActions.length}`);
  console.log(`- Cases that Reached Attempt 2: ${retryCases.length}`);
  console.log(`- Cases that Exceeded Max Retry Limit (>2): ${overLimitCases.length} (Expected: 0)`);

  const retryPass = retryActions.length > 0 && overLimitCases.length === 0;
  console.log(`Retry Accounting Result: ${retryPass ? '✅ PASS' : '❌ FAIL'}\n`);

  // -------------------------------------------------------------------------
  // 8. AUDIT LOG COMPLETENESS & CHAIN VERIFICATION
  // -------------------------------------------------------------------------
  console.log('>>> [8. AUDIT COMPLETENESS VERIFICATION]');
  const totalLogs = await AuditLog.countDocuments({});
  const normalCase = await RecoveryCase.findOne({ state: CASE_STATES.RECOVERED });
  const normalLogs = await AuditLog.find({ recoveryCaseId: normalCase.recoveryCaseId }).sort({ timestamp: 1 });
  const stoppedCase = await RecoveryCase.findOne({ state: CASE_STATES.STOPPED, normalizedFailureCategory: 'FRAUD_RISK' });
  const stoppedLogs = await AuditLog.find({ recoveryCaseId: stoppedCase.recoveryCaseId }).sort({ timestamp: 1 });

  console.log(`- Total Audit Logs Recorded for Batch: ${totalLogs}`);
  console.log(`- Normal Recovery Chain (${normalCase.recoveryCaseId}): ${normalLogs.map(l => l.event).join(' -> ')}`);
  console.log(`- Hard Stop Chain (${stoppedCase.recoveryCaseId}): ${stoppedLogs.map(l => l.event).join(' -> ')}`);

  const auditPass = totalLogs >= 400 && normalLogs.length >= 5 && stoppedLogs.length >= 4;
  console.log(`Audit Completeness Result: ${auditPass ? '✅ PASS' : '❌ FAIL'}\n`);

  // -------------------------------------------------------------------------
  // 9. RESET -> RUN -> RESET -> RUN REPEATABILITY AUDIT
  // -------------------------------------------------------------------------
  console.log('>>> [9. RESET -> RUN -> RESET -> RUN REPEATABILITY AUDIT]');
  // Run 1 Metrics are stored in `analytics`
  await generateSeedDataset();
  const run2Launch = await startBatchRun('FAST');
  await waitBatch(run2Launch.batchId);
  const analyticsRun2 = await getDashboardAnalytics();
  const casesRun2 = await RecoveryCase.find({}).sort({ recoveryCaseId: 1 });

  let caseMismatches = 0;
  for (let i = 0; i < postBatchCases.length; i++) {
    const c1 = postBatchCases.find(c => c.recoveryCaseId === casesRun2[i].recoveryCaseId);
    const c2 = casesRun2[i];
    if (c1.state !== c2.state || c1.recoveredAmount !== c2.recoveredAmount || c1.recoveryScore !== c2.recoveryScore) {
      caseMismatches++;
    }
  }

  console.log(`- Run 1 Recovered: ₹${analytics.recoveredRevenue.toLocaleString('en-IN')} across ${analytics.casesByState[CASE_STATES.RECOVERED]} cases`);
  console.log(`- Run 2 Recovered: ₹${analyticsRun2.recoveredRevenue.toLocaleString('en-IN')} across ${analyticsRun2.casesByState[CASE_STATES.RECOVERED]} cases`);
  console.log(`- Case-by-Case Mismatches: ${caseMismatches} (Expected: 0)`);

  const repeatabilityPass = (
    analytics.recoveredRevenue === analyticsRun2.recoveredRevenue &&
    analytics.recoveryRate === analyticsRun2.recoveryRate &&
    analytics.casesByState[CASE_STATES.RECOVERED] === analyticsRun2.casesByState[CASE_STATES.RECOVERED] &&
    analytics.casesByState[CASE_STATES.ESCALATED] === analyticsRun2.casesByState[CASE_STATES.ESCALATED] &&
    analytics.casesByState[CASE_STATES.STOPPED] === analyticsRun2.casesByState[CASE_STATES.STOPPED] &&
    caseMismatches === 0
  );
  console.log(`Repeatability Result: ${repeatabilityPass ? '✅ PASS' : '❌ FAIL'}\n`);

  // Restore clean state for demo
  await generateSeedDataset();
  await disconnectDB();

  console.log('====================================================================');
  console.log('          P0 BATCH ECONOMICS AUDIT COMPLETE                         ');
  console.log('====================================================================\n');
}

runBatchAudit();
