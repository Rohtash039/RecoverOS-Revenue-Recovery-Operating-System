import { connectDB, disconnectDB } from '../config/db.js';
import { Customer } from '../models/Customer.js';
import { Transaction } from '../models/Transaction.js';
import { RecoveryCase } from '../models/RecoveryCase.js';
import { RecoveryAction } from '../models/RecoveryAction.js';
import { AuditLog } from '../models/AuditLog.js';
import { generateSeedDataset } from '../services/simulation/seedDataGenerator.js';
import { processCaseWorkflow, handleHumanAction } from '../services/workflow/workflowEngine.js';
import { calculateROS } from '../services/scoring/opportunityScorer.js';
import { CASE_STATES, AUDIT_ACTORS, RECOVERY_ACTIONS } from '../config/constants.js';

async function runVerification() {
  console.log('====================================================================');
  console.log('   RECOVEROS — FINAL WORKFLOW & FRAUD SEMANTICS VERIFICATION       ');
  console.log('====================================================================\n');

  await connectDB();

  // Reset to clean seed state
  console.log('>>> [RESETTING TO CLEAN SEED BASELINE]');
  await generateSeedDataset();

  // -------------------------------------------------------------------------
  // TEST A: NORMAL RECOVERY
  // -------------------------------------------------------------------------
  console.log('>>> [TEST A: NORMAL RECOVERY]');
  const caseA = await RecoveryCase.findOne({ normalizedFailureCategory: 'TEMPORARY_PAYMENT_FAILURE', initialRevenueAtRisk: { $lt: 50000 } });
  const custA = await Customer.findOne({ customerId: caseA.customerId });
  const txnA = await Transaction.findOne({ transactionId: caseA.transactionId });

  await processCaseWorkflow(caseA, custA, txnA);
  const updatedA = await RecoveryCase.findOne({ recoveryCaseId: caseA.recoveryCaseId });
  const logsA = await AuditLog.find({ recoveryCaseId: caseA.recoveryCaseId }).sort({ timestamp: 1 });

  console.log(`- Case: ${updatedA.recoveryCaseId} (${updatedA.transactionId})`);
  console.log(`- Final State: ${updatedA.state}`);
  console.log(`- Recovered Amount: ₹${updatedA.recoveredAmount.toLocaleString('en-IN')}`);
  console.log(`- Audit Events: ${logsA.map(l => l.event).join(' -> ')}`);

  const testAPass = updatedA.state === CASE_STATES.RECOVERED && logsA.some(l => l.event === 'ACTION_EXECUTED');
  console.log(`Test A Result: ${testAPass ? '✅ PASS' : '❌ FAIL'}\n`);

  // -------------------------------------------------------------------------
  // TEST B: FRAUD SUSPECTED (TXN-8093 / RC-1093)
  // -------------------------------------------------------------------------
  console.log('>>> [TEST B: FRAUD SUSPECTED (TXN-8093 / RC-1093)]');
  const caseB = await RecoveryCase.findOne({ recoveryCaseId: 'RC-1093' });
  const custB = await Customer.findOne({ customerId: caseB.customerId });
  const txnB = await Transaction.findOne({ transactionId: caseB.transactionId });

  console.log(`- Before Agent Execution:`);
  console.log(`  * State: ${caseB.state} (UI Presentation Disposition: BLOCKED)`);
  console.log(`  * ROS Score: ${caseB.recoveryScore}/100`);
  console.log(`  * Failure Recoverability Factor: ${caseB.scoreFactors?.failureRecoverability}`);

  await processCaseWorkflow(caseB, custB, txnB);
  const updatedB = await RecoveryCase.findOne({ recoveryCaseId: 'RC-1093' });
  const logsB = await AuditLog.find({ recoveryCaseId: 'RC-1093' }).sort({ timestamp: 1 });

  console.log(`- After Agent Execution:`);
  console.log(`  * Final State: ${updatedB.state}`);
  console.log(`  * Recovered Amount: ₹${updatedB.recoveredAmount}`);
  console.log(`  * AI Recommended Action: ${updatedB.aiDiagnosis?.recommendedAction}`);
  console.log(`  * Policy Decision: ${updatedB.policyEvaluation?.decision}`);
  console.log(`  * Policy Final Action: ${updatedB.policyEvaluation?.finalAction}`);
  console.log(`  * Audit Events: ${logsB.map(l => l.event).join(' -> ')}`);

  const testBPass = (
    caseB.recoveryScore === 0 &&
    updatedB.state === CASE_STATES.STOPPED &&
    updatedB.recoveredAmount === 0 &&
    updatedB.policyEvaluation?.decision === 'REJECT' &&
    updatedB.policyEvaluation?.finalAction === RECOVERY_ACTIONS.STOP_RECOVERY
  );
  console.log(`Test B Result: ${testBPass ? '✅ PASS' : '❌ FAIL'}\n`);

  // -------------------------------------------------------------------------
  // TEST C: CARD STOLEN (TXN-8097 / RC-1097)
  // -------------------------------------------------------------------------
  console.log('>>> [TEST C: CARD STOLEN (TXN-8097 / RC-1097)]');
  const caseC = await RecoveryCase.findOne({ recoveryCaseId: 'RC-1097' });
  const custC = await Customer.findOne({ customerId: caseC.customerId });
  const txnC = await Transaction.findOne({ transactionId: caseC.transactionId });

  console.log(`- ROS Score: ${caseC.recoveryScore}/100`);
  await processCaseWorkflow(caseC, custC, txnC);
  const updatedC = await RecoveryCase.findOne({ recoveryCaseId: 'RC-1097' });

  console.log(`- Final State: ${updatedC.state}`);
  console.log(`- Recovered Amount: ₹${updatedC.recoveredAmount}`);
  console.log(`- Policy Decision: ${updatedC.policyEvaluation?.decision}, Action: ${updatedC.policyEvaluation?.finalAction}`);

  const testCPass = caseC.recoveryScore === 0 && updatedC.state === CASE_STATES.STOPPED && updatedC.recoveredAmount === 0;
  console.log(`Test C Result: ${testCPass ? '✅ PASS' : '❌ FAIL'}\n`);

  // -------------------------------------------------------------------------
  // TEST D: ACCOUNT CLOSED (TXN-8099 / RC-1099)
  // -------------------------------------------------------------------------
  console.log('>>> [TEST D: ACCOUNT CLOSED (TXN-8099 / RC-1099)]');
  const caseD = await RecoveryCase.findOne({ recoveryCaseId: 'RC-1099' });
  const custD = await Customer.findOne({ customerId: caseD.customerId });
  const txnD = await Transaction.findOne({ transactionId: caseD.transactionId });

  console.log(`- ROS Score: ${caseD.recoveryScore}/100`);
  await processCaseWorkflow(caseD, custD, txnD);
  const updatedD = await RecoveryCase.findOne({ recoveryCaseId: 'RC-1099' });

  console.log(`- Final State: ${updatedD.state}`);
  console.log(`- Recovered Amount: ₹${updatedD.recoveredAmount}`);
  console.log(`- Policy Decision: ${updatedD.policyEvaluation?.decision}, Action: ${updatedD.policyEvaluation?.finalAction}`);

  const testDPass = caseD.recoveryScore === 0 && updatedD.state === CASE_STATES.STOPPED && updatedD.recoveredAmount === 0;
  console.log(`Test D Result: ${testDPass ? '✅ PASS' : '❌ FAIL'}\n`);

  // -------------------------------------------------------------------------
  // TEST E: HIGH VALUE HUMAN APPROVAL (TXN-8003 / RC-1003)
  // -------------------------------------------------------------------------
  console.log('>>> [TEST E: HIGH VALUE HUMAN APPROVAL (TXN-8003 / RC-1003)]');
  const caseE = await RecoveryCase.findOne({ recoveryCaseId: 'RC-1003' });
  const custE = await Customer.findOne({ customerId: caseE.customerId });
  const txnE = await Transaction.findOne({ transactionId: caseE.transactionId });

  console.log(`- Amount: ₹${caseE.initialRevenueAtRisk.toLocaleString('en-IN')}`);
  console.log(`- ROS Score: ${caseE.recoveryScore}/100`);

  // Automated phase -> must land in ESCALATED
  await processCaseWorkflow(caseE, custE, txnE);
  const escalatedE = await RecoveryCase.findOne({ recoveryCaseId: 'RC-1003' });
  const stateBeforeHuman = escalatedE.state;
  console.log(`- State after automated phase: ${stateBeforeHuman} (Expected: 'ESCALATED')`);
  console.log(`- Pending Action: ${escalatedE.pendingHumanAction}`);

  // Human operator phase -> approve
  const approvedE = await handleHumanAction(escalatedE, txnE, 'APPROVE_ESCALATION');
  const logsE = await AuditLog.find({ recoveryCaseId: 'RC-1003' }).sort({ timestamp: 1 });

  console.log(`- State after Human Approval: ${approvedE.state} (Expected: 'RECOVERED')`);
  console.log(`- Recovered Amount: ₹${approvedE.recoveredAmount.toLocaleString('en-IN')}`);
  console.log(`- Complete Audit Event Chain:`);
  for (const log of logsE) {
    console.log(`  * [${log.actor}] ${log.event}: ${log.reason || '—'} (Impact: ₹${log.financialImpact})`);
  }

  const hasHumanGranted = logsE.some(l => l.event === 'HUMAN_APPROVAL_GRANTED' && l.actor === AUDIT_ACTORS.HUMAN);
  const hasActionExecuted = logsE.some(l => l.event === 'ACTION_EXECUTED' && l.actor === AUDIT_ACTORS.SYSTEM);
  const hasRevenueRecovered = logsE.some(l => l.event === 'REVENUE_RECOVERED' && l.actor === AUDIT_ACTORS.SIMULATOR);

  const testEPass = (
    stateBeforeHuman === CASE_STATES.ESCALATED &&
    approvedE.state === CASE_STATES.RECOVERED &&
    hasHumanGranted &&
    hasActionExecuted &&
    hasRevenueRecovered
  );
  console.log(`Test E Result: ${testEPass ? '✅ PASS' : '❌ FAIL'}\n`);

  // -------------------------------------------------------------------------
  // TEST F: HUMAN REJECTION
  // -------------------------------------------------------------------------
  console.log('>>> [TEST F: HUMAN REJECTION]');
  const caseF = await RecoveryCase.findOne({ recoveryCaseId: 'RC-1017' }); // Another high value case
  const custF = await Customer.findOne({ customerId: caseF.customerId });
  const txnF = await Transaction.findOne({ transactionId: caseF.transactionId });

  await processCaseWorkflow(caseF, custF, txnF);
  const escalatedF = await RecoveryCase.findOne({ recoveryCaseId: 'RC-1017' });
  console.log(`- State after automated phase: ${escalatedF.state}`);

  const rejectedF = await handleHumanAction(escalatedF, txnF, 'REJECT_ESCALATION');
  const logsF = await AuditLog.find({ recoveryCaseId: 'RC-1017' }).sort({ timestamp: 1 });

  console.log(`- State after Human Rejection: ${rejectedF.state} (Expected: 'STOPPED')`);
  console.log(`- Recovered Amount: ₹${rejectedF.recoveredAmount}`);
  const hasHumanRejected = logsF.some(l => l.event === 'HUMAN_APPROVAL_REJECTED' && l.actor === AUDIT_ACTORS.HUMAN);

  const testFPass = rejectedF.state === CASE_STATES.STOPPED && rejectedF.recoveredAmount === 0 && hasHumanRejected;
  console.log(`Test F Result: ${testFPass ? '✅ PASS' : '❌ FAIL'}\n`);

  // -------------------------------------------------------------------------
  // TEST G: DUPLICATE APPROVAL (IDEMPOTENCY)
  // -------------------------------------------------------------------------
  console.log('>>> [TEST G: DUPLICATE HUMAN APPROVAL]');
  const caseG = await RecoveryCase.findOne({ recoveryCaseId: 'RC-1003' }); // Already approved in Test E
  const actionsBefore = await RecoveryAction.find({ recoveryCaseId: 'RC-1003' });
  const amountBefore = caseG.recoveredAmount;

  // Attempt duplicate approval call
  const duplicateResult = await handleHumanAction(caseG, txnE, 'APPROVE_ESCALATION');
  const actionsAfter = await RecoveryAction.find({ recoveryCaseId: 'RC-1003' });

  console.log(`- State after duplicate approval: ${duplicateResult.state}`);
  console.log(`- Action Documents Before: ${actionsBefore.length}, After: ${actionsAfter.length}`);
  console.log(`- Recovered Amount Before: ₹${amountBefore}, After: ₹${duplicateResult.recoveredAmount}`);

  const testGPass = (
    actionsBefore.length === actionsAfter.length &&
    duplicateResult.recoveredAmount === amountBefore &&
    duplicateResult.state === CASE_STATES.RECOVERED
  );
  console.log(`Test G Result: ${testGPass ? '✅ PASS' : '❌ FAIL'}\n`);

  // Restore clean state
  await generateSeedDataset();
  await disconnectDB();

  console.log('====================================================================');
  console.log('     ALL 7 WORKFLOW & FRAUD VERIFICATION TESTS COMPLETE             ');
  console.log('====================================================================\n');
}

runVerification();
