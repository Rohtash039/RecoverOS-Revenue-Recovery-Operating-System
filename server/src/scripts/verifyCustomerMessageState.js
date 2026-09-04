import { connectDB, disconnectDB } from '../config/db.js';
import { Customer } from '../models/Customer.js';
import { Transaction } from '../models/Transaction.js';
import { RecoveryCase } from '../models/RecoveryCase.js';
import { generateSeedDataset } from '../services/simulation/seedDataGenerator.js';
import { processCaseWorkflow, handleHumanAction } from '../services/workflow/workflowEngine.js';
import { CASE_STATES } from '../config/constants.js';

function resolveCustomerMessage(rc) {
  if (!rc) return null;
  if (rc.state === 'ESCALATED') {
    return {
      channel: rc.aiDiagnosis?.customerMessage?.channel || 'EMAIL',
      headline: 'Transaction Review in Progress',
      body: 'Your high-value transaction encountered a temporary delay and is pending review by our operations team. No automated charges or retries have been dispatched.',
      cta: 'View Status'
    };
  }
  if (rc.state === 'RECOVERED') {
    return {
      channel: rc.aiDiagnosis?.customerMessage?.channel || 'EMAIL',
      headline: 'Payment Successfully Completed',
      body: `Your payment of ₹${rc.recoveredAmount || rc.initialRevenueAtRisk} has been successfully recovered and confirmed.`,
      cta: 'View Confirmation'
    };
  }
  if (rc.state === 'STOPPED') {
    return {
      channel: rc.aiDiagnosis?.customerMessage?.channel || 'EMAIL',
      headline: 'Payment Recovery Discontinued',
      body: 'Automated recovery for this transaction has been halted in accordance with safety guardrails. Please use an alternate payment method if needed.',
      cta: 'Alternate Payment'
    };
  }
  return rc.aiDiagnosis?.customerMessage || null;
}

async function runCustomerMessageTest() {
  
  await connectDB();
  await generateSeedDataset();

  console.log('>>> [1. TESTING TXN-8003 IN ESCALATED PRE-APPROVAL STATE]');
  const caseHv = await RecoveryCase.findOne({ recoveryCaseId: 'RC-1003' });
  const custHv = await Customer.findOne({ customerId: caseHv.customerId });
  const txnHv = await Transaction.findOne({ transactionId: caseHv.transactionId });

  await processCaseWorkflow(caseHv, custHv, txnHv);
  const escalatedCase = await RecoveryCase.findOne({ recoveryCaseId: 'RC-1003' });

  const preApprovalMsg = resolveCustomerMessage(escalatedCase);
  console.log(`- State: ${escalatedCase.state}`);
  console.log(`- Headline: ${preApprovalMsg.headline}`);
  console.log(`- Body: ${preApprovalMsg.body}`);
  console.log(`- CTA: ${preApprovalMsg.cta}`);

  const containsScheduledRetry = (
    preApprovalMsg.body.toLowerCase().includes('scheduled for automatic retry') ||
    preApprovalMsg.body.toLowerCase().includes('will automatically retry') ||
    preApprovalMsg.headline.toLowerCase().includes('pending retry')
  );
  const containsNeutralReview = preApprovalMsg.body.toLowerCase().includes('pending review');

  console.log(`- Contains 'scheduled for automatic retry': ${containsScheduledRetry ? 'YES (FAIL)' : 'NO (PASS)'}`);
  console.log(`- Contains neutral review phrasing: ${containsNeutralReview ? 'YES (PASS)' : 'NO (FAIL)'}`);

  const preApprovalPass = !containsScheduledRetry && containsNeutralReview && escalatedCase.state === CASE_STATES.ESCALATED;

  console.log('\n>>> [2. TESTING TXN-8003 IN RECOVERED POST-APPROVAL STATE]');
  const approvedCase = await handleHumanAction(escalatedCase, txnHv, 'APPROVE_ESCALATION');
  const postApprovalMsg = resolveCustomerMessage(approvedCase);

  console.log(`- State: ${approvedCase.state}`);
  console.log(`- Headline: ${postApprovalMsg.headline}`);
  console.log(`- Body: ${postApprovalMsg.body}`);
  console.log(`- CTA: ${postApprovalMsg.cta}`);

  const postApprovalPass = (
    approvedCase.state === CASE_STATES.RECOVERED &&
    postApprovalMsg.headline.toLowerCase().includes('completed') &&
    postApprovalMsg.body.toLowerCase().includes('successfully recovered')
  );

  await generateSeedDataset();
  await disconnectDB();

  console.log(`PRE-APPROVAL CHECK:  ${preApprovalPass ? 'PASS' : 'FAIL'}`);
  console.log(`POST-APPROVAL CHECK: ${postApprovalPass ? 'PASS' : 'FAIL'}`);
}

runCustomerMessageTest();

