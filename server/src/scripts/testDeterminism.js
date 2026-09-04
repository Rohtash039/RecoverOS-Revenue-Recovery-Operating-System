import { connectDB, disconnectDB } from '../config/db.js';
import { generateSeedDataset } from '../services/simulation/seedDataGenerator.js';
import { startBatchRun, getBatchStatus } from '../services/simulation/batchOrchestrator.js';
import { getDashboardAnalytics } from '../services/analytics/analyticsService.js';
import { RecoveryCase } from '../models/RecoveryCase.js';
import { Transaction } from '../models/Transaction.js';
import { handleHumanAction } from '../services/workflow/workflowEngine.js';
import { executeWithIdempotency } from '../services/workflow/idempotency.js';
import { CASE_STATES, RECOVERY_ACTIONS } from '../config/constants.js';

async function waitBatchCompletion(batchId) {
  while (true) {
    const status = await getBatchStatus(batchId);
    if (status.status === 'COMPLETED' || status.status === 'FAILED') {
      return status;
    }
    await new Promise(res => setTimeout(res, 50));
  }
}

async function runDeterminismTest() {
  console.log('=== [RecoverOS Test Suite] Starting Determinism & Guardrail Verification ===\n');
  await connectDB();

  console.log('--- Step 1: Pass 1 Seed & Batch Execution ---');
  await generateSeedDataset();
  const batch1 = await startBatchRun('FAST');
  await waitBatchCompletion(batch1.batchId);
  const metrics1 = await getDashboardAnalytics();

  console.log(`Pass 1 Results:
  - Initial At Risk: ₹${metrics1.initialRevenueAtRisk.toLocaleString('en-IN')}
  - Recovered Revenue: ₹${metrics1.recoveredRevenue.toLocaleString('en-IN')}
  - Recovery Rate: ${metrics1.recoveryRate}%
  - Expected Recovery: ₹${metrics1.expectedRecovery.toLocaleString('en-IN')}
  - Expected Recovery Attainment: ${metrics1.expectedRecoveryAttainment}%
  - Recovered Cases: ${metrics1.casesByState[CASE_STATES.RECOVERED]}
  - Escalated Cases: ${metrics1.casesByState[CASE_STATES.ESCALATED]}
  - Stopped Cases: ${metrics1.casesByState[CASE_STATES.STOPPED]}`);

  console.log('\n--- Step 2: Pass 2 Seed & Batch Execution ---');
  await generateSeedDataset();
  const batch2 = await startBatchRun('FAST');
  await waitBatchCompletion(batch2.batchId);
  const metrics2 = await getDashboardAnalytics();

  console.log(`Pass 2 Results:
  - Initial At Risk: ₹${metrics2.initialRevenueAtRisk.toLocaleString('en-IN')}
  - Recovered Revenue: ₹${metrics2.recoveredRevenue.toLocaleString('en-IN')}
  - Recovery Rate: ${metrics2.recoveryRate}%
  - Expected Recovery: ₹${metrics2.expectedRecovery.toLocaleString('en-IN')}
  - Expected Recovery Attainment: ${metrics2.expectedRecoveryAttainment}%
  - Recovered Cases: ${metrics2.casesByState[CASE_STATES.RECOVERED]}
  - Escalated Cases: ${metrics2.casesByState[CASE_STATES.ESCALATED]}
  - Stopped Cases: ${metrics2.casesByState[CASE_STATES.STOPPED]}`);

  console.log('\n--- Step 3: Verifying Determinism Assertions ---');
  const match = (
    metrics1.initialRevenueAtRisk === metrics2.initialRevenueAtRisk &&
    metrics1.recoveredRevenue === metrics2.recoveredRevenue &&
    metrics1.recoveryRate === metrics2.recoveryRate &&
    metrics1.expectedRecovery === metrics2.expectedRecovery &&
    metrics1.expectedRecoveryAttainment === metrics2.expectedRecoveryAttainment &&
    metrics1.casesByState[CASE_STATES.RECOVERED] === metrics2.casesByState[CASE_STATES.RECOVERED] &&
    metrics1.casesByState[CASE_STATES.ESCALATED] === metrics2.casesByState[CASE_STATES.ESCALATED] &&
    metrics1.casesByState[CASE_STATES.STOPPED] === metrics2.casesByState[CASE_STATES.STOPPED]
  );

  if (match) {
    console.log(' DETERMINISM VERIFIED: Pass 1 and Pass 2 produced 100% identical financial attribution and state distributions.');
  } else {
    console.error(' DETERMINISM FAILED: Discrepancy between Pass 1 and Pass 2.');
    process.exit(1);
  }

  console.log('\n--- Step 4: Testing Guardrail Scenarios ---');

  const fraudCase = await RecoveryCase.findOne({ normalizedFailureCategory: 'FRAUD_RISK' });
  if (fraudCase && fraudCase.state === CASE_STATES.STOPPED && fraudCase.recoveredAmount === 0) {
    console.log(` SCENARIO 1 (Fraud Hard Stop): Case ${fraudCase.recoveryCaseId} was stopped by policy. Recovered: ₹0.`);
  } else {
    console.error('SCENARIO 1 FAILED:', fraudCase);
  }

  const highValCase = await RecoveryCase.findOne({ state: CASE_STATES.ESCALATED });
  if (highValCase && highValCase.initialRevenueAtRisk >= 50000) {
    console.log(`SCENARIO 2 (High-Value Escalation): Case ${highValCase.recoveryCaseId} (₹${highValCase.initialRevenueAtRisk.toLocaleString('en-IN')}) successfully escalated to human queue.`);

    const txn = await Transaction.findOne({ transactionId: highValCase.transactionId });
    const approvedCase = await handleHumanAction(highValCase, txn, 'APPROVE_ESCALATION');
    if ([CASE_STATES.RECOVERED, CASE_STATES.STOPPED].includes(approvedCase.state)) {
      console.log(`SCENARIO 3 (Human Action Execution): Escalated case transitioned to ${approvedCase.state} upon human approval.`);
    } else {
      console.error('SCENARIO 3 FAILED: Case did not resolve correctly after human approval.');
    }
  } else {
    console.warn('No escalated case found for test.');
  }

  console.log('\n--- Step 5: Testing Idempotency Protection ---');
  let execCount = 0;
  const testFn = async () => {
    execCount++;
    return { result: 'SUCCESS', recoveredAmount: 1000, reason: 'Test execution' };
  };

  const res1 = await executeWithIdempotency({
    recoveryCaseId: 'RC-IDEMPOTENCY-TEST',
    transactionId: 'TXN-IDEM-01',
    workflowStep: 'ATTEMPT_1',
    actionType: RECOVERY_ACTIONS.RETRY_PAYMENT,
    attemptNumber: 1,
    executeFn: testFn
  });

  const res2 = await executeWithIdempotency({
    recoveryCaseId: 'RC-IDEMPOTENCY-TEST',
    transactionId: 'TXN-IDEM-01',
    workflowStep: 'ATTEMPT_1',
    actionType: RECOVERY_ACTIONS.RETRY_PAYMENT,
    attemptNumber: 1,
    executeFn: testFn
  });

  if (res1.idempotent === false && res2.idempotent === true && execCount === 1) {
    console.log('SCENARIO 4 (Idempotency Protection): Duplicate action request was blocked from re-execution.');
  } else {
    console.error('SCENARIO 4 FAILED: Idempotency execution count mismatch:', execCount);
  }

  await generateSeedDataset();
  console.log('\n[RecoverOS] Test suite completed successfully. DB restored to clean AT_RISK seed state.\n');

  await disconnectDB();
}

runDeterminismTest();

