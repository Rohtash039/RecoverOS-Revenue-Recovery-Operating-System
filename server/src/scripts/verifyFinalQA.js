import { connectDB, disconnectDB } from '../config/db.js';
import { Customer } from '../models/Customer.js';
import { Transaction } from '../models/Transaction.js';
import { RecoveryCase } from '../models/RecoveryCase.js';
import { RecoveryAction } from '../models/RecoveryAction.js';
import { AuditLog } from '../models/AuditLog.js';
import { generateSeedDataset } from '../services/simulation/seedDataGenerator.js';
import { processCaseWorkflow, handleHumanAction } from '../services/workflow/workflowEngine.js';
import { CASE_STATES, AUDIT_ACTORS, RECOVERY_ACTIONS } from '../config/constants.js';

async function runFinalQASuite() {
  console.log('====================================================================');
  console.log('            RECOVEROS — FINAL QA & CONCURRENCY AUDIT                ');
  console.log('====================================================================\n');

  await connectDB();
  await generateSeedDataset();

  // -------------------------------------------------------------------------
  // 1. FRAUD VISUAL & RECOVERY VERIFICATION (TXN-8093)
  // -------------------------------------------------------------------------
  console.log('>>> [1. HARD-PROHIBITED VERIFICATION (TXN-8093 / RC-1093)]');
  const fraudCase = await RecoveryCase.findOne({ recoveryCaseId: 'RC-1093' });
  const fraudCust = await Customer.findOne({ customerId: fraudCase.customerId });
  const fraudTxn = await Transaction.findOne({ transactionId: fraudCase.transactionId });

  console.log(`- Before Processing:`);
  console.log(`  * Failure Code: ${fraudTxn.failureCode}`);
  console.log(`  * Normalized Category: ${fraudCase.normalizedFailureCategory}`);
  console.log(`  * ROS Score: ${fraudCase.recoveryScore}/100 (Expected: 0)`);
  console.log(`  * State: ${fraudCase.state} (UI Presentation: BLOCKED)`);

  await processCaseWorkflow(fraudCase, fraudCust, fraudTxn);
  const updatedFraud = await RecoveryCase.findOne({ recoveryCaseId: 'RC-1093' });
  const fraudLogs = await AuditLog.find({ recoveryCaseId: 'RC-1093' }).sort({ timestamp: 1 });

  console.log(`- After Processing:`);
  console.log(`  * State: ${updatedFraud.state} (Expected: 'STOPPED')`);
  console.log(`  * AI Diagnosis: ${updatedFraud.aiDiagnosis?.diagnosisCategory}`);
  console.log(`  * AI Recommendation: ${updatedFraud.aiDiagnosis?.recommendedAction}`);
  console.log(`  * Policy Decision: ${updatedFraud.policyEvaluation?.decision}`);
  console.log(`  * Policy Final Action: ${updatedFraud.policyEvaluation?.finalAction}`);
  console.log(`  * Recovered Amount: ₹${updatedFraud.recoveredAmount} (Expected: 0)`);
  console.log(`  * Visible Audit Sequence: ${fraudLogs.map(l => l.event).join(' -> ')}`);

  // -------------------------------------------------------------------------
  // 2. HIGH-VALUE HUMAN APPROVAL VISUAL VERIFICATION (TXN-8003)
  // -------------------------------------------------------------------------
  console.log('\n>>> [2. HIGH-VALUE HUMAN APPROVAL VERIFICATION (TXN-8003 / RC-1003)]');
  const hvCase = await RecoveryCase.findOne({ recoveryCaseId: 'RC-1003' });
  const hvCust = await Customer.findOne({ customerId: hvCase.customerId });
  const hvTxn = await Transaction.findOne({ transactionId: hvCase.transactionId });

  console.log(`- Amount: ₹${hvCase.initialRevenueAtRisk.toLocaleString('en-IN')}`);
  console.log(`- Failure: ${hvTxn.failureCode}`);

  await processCaseWorkflow(hvCase, hvCust, hvTxn);
  const escalatedHv = await RecoveryCase.findOne({ recoveryCaseId: 'RC-1003' });
  console.log(`- State after Policy Check: ${escalatedHv.state} (Expected: 'ESCALATED')`);
  console.log(`- Policy Final Action: ${escalatedHv.policyEvaluation?.finalAction} (Expected: 'ESCALATE_TO_HUMAN')`);

  const approvedHv = await handleHumanAction(escalatedHv, hvTxn, 'APPROVE_ESCALATION');
  const hvLogs = await AuditLog.find({ recoveryCaseId: 'RC-1003' }).sort({ timestamp: 1 });

  console.log(`- State after Human Approval: ${approvedHv.state} (Expected: 'RECOVERED')`);
  console.log(`- Simulated Recovered Revenue: ₹${approvedHv.recoveredAmount.toLocaleString('en-IN')}`);
  console.log(`- Visible Audit Sequence:`);
  for (const log of hvLogs) {
    console.log(`  * [${log.actor}] ${log.event}: ${log.reason || '—'} (Impact: ₹${log.financialImpact})`);
  }

  // -------------------------------------------------------------------------
  // 3. CONCURRENCY & IDEMPOTENCY CHECK (SIMULTANEOUS APPROVAL RACE)
  // -------------------------------------------------------------------------
  console.log('\n>>> [3. SIMULTANEOUS CONCURRENT HUMAN APPROVAL RACE]');
  // Reset clean state for fresh test
  await generateSeedDataset();
  const raceCase = await RecoveryCase.findOne({ recoveryCaseId: 'RC-1003' });
  const raceCust = await Customer.findOne({ customerId: raceCase.customerId });
  const raceTxn = await Transaction.findOne({ transactionId: raceCase.transactionId });

  await processCaseWorkflow(raceCase, raceCust, raceTxn);
  const escalatedForRace = await RecoveryCase.findOne({ recoveryCaseId: 'RC-1003' });

  // Fire two simultaneous approvals concurrently
  const [res1, res2] = await Promise.all([
    handleHumanAction(escalatedForRace, raceTxn, 'APPROVE_ESCALATION'),
    handleHumanAction(escalatedForRace, raceTxn, 'APPROVE_ESCALATION')
  ]);

  const actionsAfterRace = await RecoveryAction.find({ recoveryCaseId: 'RC-1003' });
  const finalCaseRace = await RecoveryCase.findOne({ recoveryCaseId: 'RC-1003' });

  console.log(`- Response 1 State: ${res1.state}, Recovered: ₹${res1.recoveredAmount}`);
  console.log(`- Response 2 State: ${res2.state}, Recovered: ₹${res2.recoveredAmount}`);
  console.log(`- Stored RecoveryAction Documents: ${actionsAfterRace.length} (Expected: 1)`);
  console.log(`- Final Case Recovered Amount: ₹${finalCaseRace.recoveredAmount} (Expected: ₹53,149, Never ₹1,06,298)`);

  const concurrencyPass = (
    actionsAfterRace.length === 1 &&
    finalCaseRace.recoveredAmount === 53149 &&
    finalCaseRace.state === CASE_STATES.RECOVERED
  );
  console.log(`Concurrency Result: ${concurrencyPass ? '✅ PASS' : '❌ FAIL'}\n`);

  await generateSeedDataset();
  await disconnectDB();

  console.log('====================================================================');
  console.log('            FINAL QA & CONCURRENCY AUDIT COMPLETE                   ');
  console.log('====================================================================\n');
}

runFinalQASuite();
