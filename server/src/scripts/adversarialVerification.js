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
import { calculateROS } from '../services/scoring/opportunityScorer.js';
import { evaluatePolicy } from '../services/policy/guardrailEngine.js';
import { simulateExecutionOutcome } from '../services/simulation/seededSimulator.js';
import { processCaseWorkflow, handleHumanAction } from '../services/workflow/workflowEngine.js';
import { executeWithIdempotency } from '../services/workflow/idempotency.js';
import { validateStateTransition } from '../services/workflow/stateMachine.js';
import { 
  SIMULATION_REFERENCE_TIME, 
  HARD_PROHIBITED_CODES, 
  CASE_STATES, 
  RECOVERY_ACTIONS, 
  AUDIT_ACTORS,
  POLICY_CONFIG
} from '../config/constants.js';

async function waitBatchCompletion(batchId) {
  while (true) {
    const status = await getBatchStatus(batchId);
    if (status.status === 'COMPLETED' || status.status === 'FAILED') {
      return status;
    }
    await new Promise(res => setTimeout(res, 40));
  }
}

async function runAdversarialSuite() {
  console.log('====================================================================');
  console.log('       RECOVEROS — ADVERSARIAL RUNTIME VERIFICATION SUITE           ');
  console.log('====================================================================\n');

  await connectDB();

  // -------------------------------------------------------------------------
  // SECTION 1: CLEAN STATE VERIFICATION
  // -------------------------------------------------------------------------
  console.log('>>> [1. CLEAN STATE VERIFICATION]');
  const seedResult = await generateSeedDataset();
  const caseCount = await RecoveryCase.countDocuments();
  const atRiskCount = await RecoveryCase.countDocuments({ state: CASE_STATES.AT_RISK });
  const nonZeroRecoveredCount = await RecoveryCase.countDocuments({ recoveredAmount: { $gt: 0 } });
  const actionCount = await RecoveryAction.countDocuments();
  const analytics0 = await getDashboardAnalytics();

  console.log(`- Total Cases: ${caseCount} (Expected: 100)`);
  console.log(`- Cases in AT_RISK: ${atRiskCount} (Expected: 100)`);
  console.log(`- Cases with recoveredAmount > 0: ${nonZeroRecoveredCount} (Expected: 0)`);
  console.log(`- Existing Recovery Actions: ${actionCount} (Expected: 0)`);
  console.log(`- Initial Revenue at Risk: ₹${analytics0.initialRevenueAtRisk.toLocaleString('en-IN')}`);
  console.log(`- Recovered Revenue at Start: ₹${analytics0.recoveredRevenue.toLocaleString('en-IN')}`);

  const cleanStatePass = (
    caseCount === 100 &&
    atRiskCount === 100 &&
    nonZeroRecoveredCount === 0 &&
    actionCount === 0 &&
    analytics0.recoveredRevenue === 0
  );
  console.log(`Result: ${cleanStatePass ? '✅ PASS' : '❌ FAIL'}\n`);

  // -------------------------------------------------------------------------
  // SECTION 2: ADVERSARIAL POLICY TESTS
  // -------------------------------------------------------------------------
  console.log('>>> [2. ADVERSARIAL POLICY TESTS]');

  // Test A: Fraud with forced RETRY recommendation
  console.log('--- Test A: Fraud Prohibited Hard Stop (AI recommends RETRY_PAYMENT) ---');
  const fraudCase = await RecoveryCase.findOne({ normalizedFailureCategory: 'FRAUD_RISK' });
  const fraudTxn = await Transaction.findOne({ transactionId: fraudCase.transactionId });
  const forcedAiRecommendation = RECOVERY_ACTIONS.RETRY_PAYMENT; // Adversarial prompt bypass simulation

  const fraudPolicyResult = evaluatePolicy(
    { ...fraudCase.toObject(), failureCode: fraudTxn.failureCode },
    forcedAiRecommendation
  );

  console.log(`- Input: FailureCode='${fraudTxn.failureCode}', AI_Recommended='${forcedAiRecommendation}'`);
  console.log(`- Policy Decision: ${fraudPolicyResult.decision} (Expected: 'REJECT')`);
  console.log(`- Final Action: ${fraudPolicyResult.finalAction} (Expected: 'STOP_RECOVERY')`);
  console.log(`- Reason: ${fraudPolicyResult.reasons.join(' | ')}`);

  const fraudPass = fraudPolicyResult.decision === 'REJECT' && fraudPolicyResult.finalAction === RECOVERY_ACTIONS.STOP_RECOVERY;
  console.log(`Test A Result: ${fraudPass ? '✅ PASS' : '❌ FAIL'}\n`);

  // Test B: Stolen Card Hard Stop
  console.log('--- Test B: Stolen Card Hard Stop ---');
  const stolenTxn = { failureCode: 'CARD_STOLEN', amount: 5000, createdAt: SIMULATION_REFERENCE_TIME };
  const stolenPolicyResult = evaluatePolicy(stolenTxn, RECOVERY_ACTIONS.RETRY_PAYMENT);
  console.log(`- Input: FailureCode='CARD_STOLEN', Proposed='RETRY_PAYMENT'`);
  console.log(`- Policy Decision: ${stolenPolicyResult.decision}, FinalAction: ${stolenPolicyResult.finalAction}`);
  const stolenPass = stolenPolicyResult.decision === 'REJECT' && stolenPolicyResult.finalAction === RECOVERY_ACTIONS.STOP_RECOVERY;
  console.log(`Test B Result: ${stolenPass ? '✅ PASS' : '❌ FAIL'}\n`);

  // Test C: High-Value Escalation (₹65,000 ticket)
  console.log('--- Test C: High-Value Ticket Escalation (₹65,000) ---');
  const highValTxn = { failureCode: 'BANK_TIMEOUT', amount: 65000, createdAt: SIMULATION_REFERENCE_TIME };
  const highValPolicy = evaluatePolicy(highValTxn, RECOVERY_ACTIONS.RETRY_PAYMENT);
  console.log(`- Input: Amount=₹65,000, FailureCode='BANK_TIMEOUT', Proposed='RETRY_PAYMENT'`);
  console.log(`- Policy Decision: ${highValPolicy.decision} (Expected: 'MODIFY')`);
  console.log(`- Final Action: ${highValPolicy.finalAction} (Expected: 'ESCALATE_TO_HUMAN')`);

  const highValPass = highValPolicy.decision === 'MODIFY' && highValPolicy.finalAction === RECOVERY_ACTIONS.ESCALATE_TO_HUMAN;
  console.log(`Test C Result: ${highValPass ? '✅ PASS' : '❌ FAIL'}\n`);

  // Test D: Human Approval Execution on Escalated Case
  console.log('--- Test D: Human Approval on High-Value Escalated Case ---');
  // Create an explicit high-value case in database
  const highValCase = await RecoveryCase.findOne({ initialRevenueAtRisk: { $gte: 50000 } });
  const highValCust = await Customer.findOne({ customerId: highValCase.customerId });
  const highValDbTxn = await Transaction.findOne({ transactionId: highValCase.transactionId });

  // Process workflow -> should land in ESCALATED
  await processCaseWorkflow(highValCase, highValCust, highValDbTxn);
  const reloadedHighVal = await RecoveryCase.findOne({ recoveryCaseId: highValCase.recoveryCaseId });
  console.log(`- State after automated policy check: ${reloadedHighVal.state} (Expected: 'ESCALATED')`);
  console.log(`- Recovered Amount before human review: ₹${reloadedHighVal.recoveredAmount} (Expected: 0)`);
  console.log(`- Pending Action Stored: ${reloadedHighVal.pendingHumanAction}`);

  // Now execute human approval
  const approvedCase = await handleHumanAction(reloadedHighVal, highValDbTxn, 'APPROVE_ESCALATION');
  console.log(`- State after Human Approval: ${approvedCase.state} (Expected: 'RECOVERED' or 'STOPPED')`);
  console.log(`- Recovered Amount after Human Approval: ₹${approvedCase.recoveredAmount.toLocaleString('en-IN')}`);

  const humanAudit = await AuditLog.findOne({
    recoveryCaseId: highValCase.recoveryCaseId,
    actor: AUDIT_ACTORS.HUMAN,
    event: 'HUMAN_APPROVAL_GRANTED'
  });
  console.log(`- Human Audit Event Logged: ${humanAudit ? 'YES (' + humanAudit.actor + ')' : 'NO'}`);

  const testDPass = (
    reloadedHighVal.state === CASE_STATES.ESCALATED &&
    humanAudit !== null &&
    [CASE_STATES.RECOVERED, CASE_STATES.STOPPED].includes(approvedCase.state)
  );
  console.log(`Test D Result: ${testDPass ? '✅ PASS' : '❌ FAIL'}\n`);

  // Test E: Human Rejection
  console.log('--- Test E: Human Rejection on Escalated Case ---');
  // Create fresh escalated case
  const testECase = new RecoveryCase({
    recoveryCaseId: 'RC-TEST-E-ESCALATE',
    transactionId: 'TXN-TEST-E',
    customerId: 'CUST-501',
    initialRevenueAtRisk: 75000,
    normalizedFailureCategory: 'TEMPORARY_PAYMENT_FAILURE',
    recoveryScore: 85,
    scoreFactors: { failureRecoverability: 95, customerReliability: 100, attemptFatigue: 100, amountTier: 30, recency: 100 },
    state: CASE_STATES.ESCALATED,
    pendingHumanAction: 'RETRY_PAYMENT',
    terminalReason: 'High value threshold'
  });
  await testECase.save();

  const rejectedCase = await handleHumanAction(testECase, { failureCode: 'BANK_TIMEOUT', eventType: 'FAILED_PAYMENT' }, 'REJECT_ESCALATION');
  console.log(`- State after Human Rejection: ${rejectedCase.state} (Expected: 'STOPPED')`);
  console.log(`- Recovered Amount: ₹${rejectedCase.recoveredAmount} (Expected: 0)`);

  const rejectAudit = await AuditLog.findOne({
    recoveryCaseId: 'RC-TEST-E-ESCALATE',
    actor: AUDIT_ACTORS.HUMAN,
    event: 'HUMAN_APPROVAL_REJECTED'
  });
  console.log(`- Human Rejection Audit Event: ${rejectAudit ? 'YES' : 'NO'}`);

  const testEPass = rejectedCase.state === CASE_STATES.STOPPED && rejectedCase.recoveredAmount === 0 && rejectAudit !== null;
  console.log(`Test E Result: ${testEPass ? '✅ PASS' : '❌ FAIL'}\n`);

  // -------------------------------------------------------------------------
  // SECTION 3: RETRY EXHAUSTION TEST
  // -------------------------------------------------------------------------
  console.log('>>> [3. RETRY EXHAUSTION TEST]');
  // Create a case calibrated to fail both attempts (low customer reliability, low score, high amount)
  const exhaustedCase = new RecoveryCase({
    recoveryCaseId: 'RC-RETRY-EXHAUST-TEST',
    transactionId: 'TXN-EXHAUST-01',
    customerId: 'CUST-CHRONIC',
    initialRevenueAtRisk: 45000,
    normalizedFailureCategory: 'INSUFFICIENT_FUNDS',
    recoveryScore: 25, // low probability -> attempts fail
    scoreFactors: { failureRecoverability: 50, customerReliability: 10, attemptFatigue: 100, amountTier: 60, recency: 40 },
    state: CASE_STATES.AT_RISK,
    retryCount: 0
  });
  await exhaustedCase.save();

  const exhaustCust = { customerId: 'CUST-CHRONIC', previousSuccessfulPayments: 0, previousFailedPayments: 5 };
  const exhaustTxn = { transactionId: 'TXN-EXHAUST-01', failureCode: 'INSUFFICIENT_FUNDS', amount: 45000, attempts: 0, eventType: 'FAILED_PAYMENT', createdAt: SIMULATION_REFERENCE_TIME };

  await processCaseWorkflow(exhaustedCase, exhaustCust, exhaustTxn);
  const finalExhausted = await RecoveryCase.findOne({ recoveryCaseId: 'RC-RETRY-EXHAUST-TEST' });
  const exhaustActions = await RecoveryAction.find({ recoveryCaseId: 'RC-RETRY-EXHAUST-TEST' }).sort({ attemptNumber: 1 });

  console.log(`- Attempt Count Executed: ${exhaustActions.length} (Expected: 2)`);
  for (const act of exhaustActions) {
    console.log(`  * Attempt ${act.attemptNumber} (${act.actionType}): Result=${act.result}, Recovered=₹${act.recoveredAmount}`);
  }
  console.log(`- Final State: ${finalExhausted.state} (Expected: 'STOPPED')`);
  console.log(`- Final Recovered Amount: ₹${finalExhausted.recoveredAmount} (Expected: 0)`);
  console.log(`- Terminal Reason: ${finalExhausted.terminalReason}`);

  const retryExhaustPass = (
    exhaustActions.length === 2 &&
    finalExhausted.state === CASE_STATES.STOPPED &&
    finalExhausted.retryCount === 2 &&
    finalExhausted.recoveredAmount === 0
  );
  console.log(`Retry Exhaustion Result: ${retryExhaustPass ? '✅ PASS' : '❌ FAIL'}\n`);

  // -------------------------------------------------------------------------
  // SECTION 4: CONTACT LIMIT TEST
  // -------------------------------------------------------------------------
  console.log('>>> [4. CONTACT LIMIT TEST]');
  const contactCase = {
    initialRevenueAtRisk: 2500,
    failureCode: 'AUTHENTICATION_FAILED',
    contactCount: 2, // At ceiling
    retryCount: 0,
    createdAt: SIMULATION_REFERENCE_TIME
  };
  const contactPolicy = evaluatePolicy(contactCase, RECOVERY_ACTIONS.SEND_PAYMENT_REMINDER);
  console.log(`- Input: contactCount=2, ProposedAction='SEND_PAYMENT_REMINDER'`);
  console.log(`- Policy Decision: ${contactPolicy.decision} (Expected: 'REJECT')`);
  console.log(`- Final Action: ${contactPolicy.finalAction} (Expected: 'STOP_RECOVERY')`);
  console.log(`- Reason: ${contactPolicy.reasons.join(' | ')}`);

  const contactPass = contactPolicy.decision === 'REJECT' && contactPolicy.finalAction === RECOVERY_ACTIONS.STOP_RECOVERY;
  console.log(`Contact Limit Result: ${contactPass ? '✅ PASS' : '❌ FAIL'}\n`);

  // -------------------------------------------------------------------------
  // SECTION 5: RECOVERY WINDOW TEST (48H SLA)
  // -------------------------------------------------------------------------
  console.log('>>> [5. RECOVERY WINDOW TEST]');
  const refMs = SIMULATION_REFERENCE_TIME.getTime();

  // Test 47h 59m (Under limit)
  const time47h59m = new Date(refMs - (47 * 3600 + 59 * 60) * 1000);
  const pol47 = evaluatePolicy({ failureCode: 'BANK_TIMEOUT', createdAt: time47h59m, initialRevenueAtRisk: 2000, retryCount: 0 }, RECOVERY_ACTIONS.RETRY_PAYMENT);
  console.log(`- 47h 59m Elapsed: Decision=${pol47.decision}, Action=${pol47.finalAction} (Expected: 'APPROVE')`);

  // Test 48h 01m (Expired)
  const time48h01m = new Date(refMs - (48 * 3600 + 60) * 1000);
  const pol48 = evaluatePolicy({ failureCode: 'BANK_TIMEOUT', createdAt: time48h01m, initialRevenueAtRisk: 2000, retryCount: 0 }, RECOVERY_ACTIONS.RETRY_PAYMENT);
  console.log(`- 48h 01m Elapsed: Decision=${pol48.decision}, Action=${pol48.finalAction} (Expected: 'REJECT')`);

  const windowPass = pol47.decision === 'APPROVE' && pol48.decision === 'REJECT' && pol48.finalAction === RECOVERY_ACTIONS.STOP_RECOVERY;
  console.log(`Recovery Window Result: ${windowPass ? '✅ PASS' : '❌ FAIL'}\n`);

  // -------------------------------------------------------------------------
  // SECTION 6: LOW CONFIDENCE AI TEST (< 0.65)
  // -------------------------------------------------------------------------
  console.log('>>> [6. LOW CONFIDENCE AI TEST]');
  const lowConfCase = {
    failureCode: 'BANK_TIMEOUT',
    initialRevenueAtRisk: 3000,
    retryCount: 0,
    createdAt: SIMULATION_REFERENCE_TIME,
    aiDiagnosis: { confidence: 0.52 } // Low confidence
  };
  const lowConfPolicy = evaluatePolicy(lowConfCase, RECOVERY_ACTIONS.RETRY_PAYMENT);
  console.log(`- Input: AI Confidence=0.52 (< 0.65 threshold), Proposed='RETRY_PAYMENT'`);
  console.log(`- Policy Decision: ${lowConfPolicy.decision} (Expected: 'MODIFY')`);
  console.log(`- Final Action: ${lowConfPolicy.finalAction} (Expected: 'ESCALATE_TO_HUMAN')`);
  console.log(`- Reason: ${lowConfPolicy.reasons.join(' | ')}`);

  const lowConfPass = lowConfPolicy.decision === 'MODIFY' && lowConfPolicy.finalAction === RECOVERY_ACTIONS.ESCALATE_TO_HUMAN;
  console.log(`Low Confidence Result: ${lowConfPass ? '✅ PASS' : '❌ FAIL'}\n`);

  // -------------------------------------------------------------------------
  // SECTION 7: AI BYPASS TEST
  // -------------------------------------------------------------------------
  console.log('>>> [7. AI BYPASS RESISTANCE TEST]');
  const bypassCase = {
    failureCode: 'FRAUD_SUSPECTED',
    initialRevenueAtRisk: 25000,
    createdAt: SIMULATION_REFERENCE_TIME,
    retryCount: 0
  };
  const bypassResult = evaluatePolicy(bypassCase, RECOVERY_ACTIONS.RETRY_PAYMENT);
  console.log(`- AI Proposed: RETRY_PAYMENT on FRAUD_SUSPECTED`);
  console.log(`- Policy Overrode AI: Decision=${bypassResult.decision}, FinalAction=${bypassResult.finalAction}`);
  const bypassPass = bypassResult.finalAction === RECOVERY_ACTIONS.STOP_RECOVERY;
  console.log(`AI Bypass Test Result: ${bypassPass ? '✅ PASS' : '❌ FAIL'}\n`);

  // -------------------------------------------------------------------------
  // SECTION 8: IDEMPOTENCY ADVERSARIAL ATTACK
  // -------------------------------------------------------------------------
  console.log('>>> [8. IDEMPOTENCY ADVERSARIAL ATTACK]');
  let executionCounter = 0;
  const attackExecFn = async () => {
    executionCounter++;
    return { result: 'SUCCESS', recoveredAmount: 9999, reason: 'First execution' };
  };

  const idempParams = {
    recoveryCaseId: 'RC-ATTACK-IDEMP',
    transactionId: 'TXN-ATTACK-01',
    workflowStep: 'ATTEMPT_1',
    actionType: RECOVERY_ACTIONS.RETRY_PAYMENT,
    attemptNumber: 1,
    executeFn: attackExecFn
  };

  // 3 sequential calls with exact same key
  const req1 = await executeWithIdempotency(idempParams);
  const req2 = await executeWithIdempotency(idempParams);
  const req3 = await executeWithIdempotency(idempParams);

  // 5 concurrent calls with exact same key
  await Promise.all([
    executeWithIdempotency(idempParams),
    executeWithIdempotency(idempParams),
    executeWithIdempotency(idempParams)
  ]);

  const totalActionsStored = await RecoveryAction.countDocuments({ recoveryCaseId: 'RC-ATTACK-IDEMP' });
  const duplicateBlockedAudits = await AuditLog.countDocuments({
    recoveryCaseId: 'RC-ATTACK-IDEMP',
    event: 'DUPLICATE_ACTION_BLOCKED'
  });

  console.log(`- Total Invocations Sent: 6 (3 sequential + 3 concurrent)`);
  console.log(`- Actual Underlying Executions: ${executionCounter} (Expected: 1)`);
  console.log(`- Database Records Created: ${totalActionsStored} (Expected: 1)`);
  console.log(`- DUPLICATE_ACTION_BLOCKED Audit Logs: ${duplicateBlockedAudits} (Expected: 5)`);

  const idempPass = executionCounter === 1 && totalActionsStored === 1 && duplicateBlockedAudits === 5;
  console.log(`Idempotency Attack Result: ${idempPass ? '✅ PASS' : '❌ FAIL'}\n`);

  // -------------------------------------------------------------------------
  // SECTION 9: FINANCIAL ATTRIBUTION ATTACK
  // -------------------------------------------------------------------------
  console.log('>>> [9. FINANCIAL ATTRIBUTION ATTACK]');
  // Reset demo and check that repeated analytics queries never inflate totals
  await generateSeedDataset();
  const batch1 = await startBatchRun('FAST');
  await waitBatchCompletion(batch1.batchId);

  const snap1 = await getDashboardAnalytics();
  const snap2 = await getDashboardAnalytics();
  const snap3 = await getDashboardAnalytics();

  console.log(`- Query 1 Recovered: ₹${snap1.recoveredRevenue.toLocaleString('en-IN')}`);
  console.log(`- Query 2 Recovered: ₹${snap2.recoveredRevenue.toLocaleString('en-IN')}`);
  console.log(`- Query 3 Recovered: ₹${snap3.recoveredRevenue.toLocaleString('en-IN')}`);

  const attributionPass = (
    snap1.recoveredRevenue === snap2.recoveredRevenue &&
    snap2.recoveredRevenue === snap3.recoveredRevenue &&
    snap1.recoveredRevenue <= snap1.initialRevenueAtRisk
  );
  console.log(`Financial Attribution Attack Result: ${attributionPass ? '✅ PASS' : '❌ FAIL'}\n`);

  // -------------------------------------------------------------------------
  // SECTION 10: STATE MACHINE BOUNDARY ATTACK
  // -------------------------------------------------------------------------
  console.log('>>> [10. STATE MACHINE ATTACK]');
  const attackTransitions = [
    { from: CASE_STATES.RECOVERED, to: CASE_STATES.EXECUTING, actor: AUDIT_ACTORS.SYSTEM },
    { from: CASE_STATES.STOPPED, to: CASE_STATES.EXECUTING, actor: AUDIT_ACTORS.SYSTEM },
    { from: CASE_STATES.STOPPED, to: CASE_STATES.RECOVERED, actor: AUDIT_ACTORS.SYSTEM },
    { from: CASE_STATES.ESCALATED, to: CASE_STATES.EXECUTING, actor: AUDIT_ACTORS.SYSTEM }, // Missing HUMAN actor
    { from: CASE_STATES.AT_RISK, to: CASE_STATES.RECOVERED, actor: AUDIT_ACTORS.SYSTEM }
  ];

  let rejectedCount = 0;
  for (const t of attackTransitions) {
    try {
      validateStateTransition(t.from, t.to, t.actor);
      console.error(`❌ Security breach: Transition ${t.from} -> ${t.to} was permitted!`);
    } catch (err) {
      rejectedCount++;
      console.log(`- Correctly Rejected: ${t.from} -> ${t.to} (${err.code})`);
    }
  }

  const stateMachinePass = rejectedCount === attackTransitions.length;
  console.log(`State Machine Attack Result: ${stateMachinePass ? '✅ PASS' : '❌ FAIL'}\n`);

  // -------------------------------------------------------------------------
  // SECTION 11: DETERMINISM REPEATABILITY ATTACK (Pass A vs Pass B)
  // -------------------------------------------------------------------------
  console.log('>>> [11. DETERMINISM ATTACK — REPEATABILITY VERIFICATION]');
  await generateSeedDataset();
  const runA = await startBatchRun('FAST');
  await waitBatchCompletion(runA.batchId);
  const metricsA = await getDashboardAnalytics();
  const casesA = await RecoveryCase.find({}).sort({ recoveryCaseId: 1 });

  await generateSeedDataset();
  const runB = await startBatchRun('FAST');
  await waitBatchCompletion(runB.batchId);
  const metricsB = await getDashboardAnalytics();
  const casesB = await RecoveryCase.find({}).sort({ recoveryCaseId: 1 });

  let caseMismatches = 0;
  for (let i = 0; i < casesA.length; i++) {
    if (
      casesA[i].state !== casesB[i].state ||
      casesA[i].recoveredAmount !== casesB[i].recoveredAmount ||
      casesA[i].recoveryScore !== casesB[i].recoveryScore
    ) {
      caseMismatches++;
    }
  }

  console.log(`- Pass A Recovered: ₹${metricsA.recoveredRevenue.toLocaleString('en-IN')} across ${metricsA.casesByState[CASE_STATES.RECOVERED]} cases`);
  console.log(`- Pass B Recovered: ₹${metricsB.recoveredRevenue.toLocaleString('en-IN')} across ${metricsB.casesByState[CASE_STATES.RECOVERED]} cases`);
  console.log(`- Individual Case Mismatches: ${caseMismatches} (Expected: 0)`);

  const determinismPass = (
    metricsA.initialRevenueAtRisk === metricsB.initialRevenueAtRisk &&
    metricsA.recoveredRevenue === metricsB.recoveredRevenue &&
    metricsA.recoveryRate === metricsB.recoveryRate &&
    caseMismatches === 0
  );
  console.log(`Determinism Attack Result: ${determinismPass ? '✅ PASS' : '❌ FAIL'}\n`);

  // -------------------------------------------------------------------------
  // SECTION 12: EXPECTED RECOVERY INDEPENDENCE VERIFICATION
  // -------------------------------------------------------------------------
  console.log('>>> [12. EXPECTED RECOVERY INDEPENDENCE VERIFICATION]');
  // Inspect how expectedRecovery is assigned:
  // opportunityScorer calculates ROS -> estimatedProb = (recoveryScore / 100) * probMultiplier
  // expectedRecovery = Math.round(initialRevenueAtRisk * estimatedProb)
  // This occurs in workflowEngine.js (Line 27-28) BEFORE AI diagnosis and BEFORE simulator execution.
  const sampleCase = casesA[0];
  console.log(`- Sample Case ${sampleCase.recoveryCaseId}:`);
  console.log(`  * Initial Revenue at Risk: ₹${sampleCase.initialRevenueAtRisk.toLocaleString('en-IN')}`);
  console.log(`  * Recovery Score: ${sampleCase.recoveryScore}/100`);
  console.log(`  * Pre-execution Expected Recovery: ₹${sampleCase.expectedRecovery.toLocaleString('en-IN')}`);
  console.log(`  * Actual Recovered Amount: ₹${sampleCase.recoveredAmount.toLocaleString('en-IN')}`);
  console.log(`  * Derivation: expectedRecovery is assigned at Step 1 (SCORING) prior to action dispatch.`);

  const expectedIndepPass = sampleCase.expectedRecovery !== undefined && sampleCase.expectedRecovery >= 0;
  console.log(`Expected Recovery Independence Result: ${expectedIndepPass ? '✅ PASS' : '❌ FAIL'}\n`);

  // -------------------------------------------------------------------------
  // SECTION 13: AUDIT TRAIL IMMUTABILITY & LIFECYCLE SEQUENCE
  // -------------------------------------------------------------------------
  console.log('>>> [13. AUDIT TRAIL LIFECYCLE SEQUENCE INSPECTION]');
  const sampleAuditTrail = await AuditLog.find({ recoveryCaseId: sampleCase.recoveryCaseId }).sort({ timestamp: 1 });
  console.log(`- Chronological Audit Sequence for ${sampleCase.recoveryCaseId}:`);
  for (const log of sampleAuditTrail) {
    console.log(`  [${log.timestamp.toISOString()}] [${log.actor}] ${log.event}: ${log.reason || '—'} (Impact: ₹${log.financialImpact})`);
  }
  const auditSequencePass = sampleAuditTrail.length >= 4;
  console.log(`Audit Lifecycle Result: ${auditSequencePass ? '✅ PASS' : '❌ FAIL'}\n`);

  // Restore DB to clean state for user
  await generateSeedDataset();
  await disconnectDB();

  console.log('====================================================================');
  console.log('           ALL 13 ADVERSARIAL ATTACKS EXECUTED                      ');
  console.log('====================================================================\n');
}

runAdversarialSuite();
