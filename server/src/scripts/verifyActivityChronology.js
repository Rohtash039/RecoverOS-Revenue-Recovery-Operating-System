import { connectDB, disconnectDB } from '../config/db.js';
import { Customer } from '../models/Customer.js';
import { Transaction } from '../models/Transaction.js';
import { RecoveryCase } from '../models/RecoveryCase.js';
import { generateSeedDataset } from '../services/simulation/seedDataGenerator.js';
import { processCaseWorkflow, handleHumanAction } from '../services/workflow/workflowEngine.js';
import { AuditLog } from '../models/AuditLog.js';

const EVENT_CHRONO_RANK = {
  CASE_CREATED: 10,
  ROS_CALCULATED: 20,
  AI_ANALYZED: 30,
  AI_FALLBACK_USED: 30,
  POLICY_EVALUATED: 40,
  CASE_ESCALATED: 50,
  HUMAN_APPROVAL_GRANTED: 60,
  HUMAN_APPROVAL_REJECTED: 60,
  ACTION_EXECUTED: 70,
  ATTEMPT_FAILED: 80,
  REVENUE_RECOVERED: 90,
  MAX_RETRIES_STOP: 90,
  CASE_STOPPED: 90,
  DUPLICATE_ACTION_BLOCKED: 100
};

async function getActivityStreamMock(limit = 50) {
  const logs = await AuditLog.find({
    actor: { $in: ['AI_AGENT', 'POLICY_ENGINE', 'SIMULATOR', 'HUMAN', 'SYSTEM'] },
    event: { $nin: ['CASE_CREATED', 'ROS_CALCULATED'] }
  })
    .sort({ timestamp: -1, _id: -1 })
    .limit(limit * 2);

  const logDocs = logs.map(l => l.toObject());

  logDocs.sort((a, b) => {
    const timeA = new Date(a.timestamp).getTime();
    const timeB = new Date(b.timestamp).getTime();

    if (Math.abs(timeA - timeB) <= 1000 && a.transactionId === b.transactionId) {
      const rankA = EVENT_CHRONO_RANK[a.event] || 50;
      const rankB = EVENT_CHRONO_RANK[b.event] || 50;
      return rankA - rankB;
    }

    return timeB - timeA;
  });

  return logDocs.slice(0, limit);
}

async function runChronologyVerification() {
  console.log('====================================================================');
  console.log('       RECOVEROS — ACTIVITY STREAM CHRONOLOGY VERIFICATION          ');
  console.log('====================================================================\n');

  await connectDB();
  await generateSeedDataset();

  // 1. Process TXN-8093 (Hard Prohibited Fraud)
  console.log('>>> [1. EXECUTING TXN-8093 (FRAUD_SUSPECTED)]');
  const fraudCase = await RecoveryCase.findOne({ recoveryCaseId: 'RC-1093' });
  const fraudCust = await Customer.findOne({ customerId: fraudCase.customerId });
  const fraudTxn = await Transaction.findOne({ transactionId: fraudCase.transactionId });
  await processCaseWorkflow(fraudCase, fraudCust, fraudTxn);

  // 2. Process TXN-8003 (High Value & Human Approval)
  console.log('>>> [2. EXECUTING TXN-8003 (HIGH-VALUE & HUMAN APPROVAL)]');
  const hvCase = await RecoveryCase.findOne({ recoveryCaseId: 'RC-1003' });
  const hvCust = await Customer.findOne({ customerId: hvCase.customerId });
  const hvTxn = await Transaction.findOne({ transactionId: hvCase.transactionId });
  await processCaseWorkflow(hvCase, hvCust, hvTxn);

  const escalatedHv = await RecoveryCase.findOne({ recoveryCaseId: 'RC-1003' });
  await handleHumanAction(escalatedHv, hvTxn, 'APPROVE_ESCALATION');

  // 3. Query Activity Stream
  console.log('\n>>> [3. INSPECTING ACTIVITY STREAM OUTPUT]');
  const stream = await getActivityStreamMock(20);

  console.log('Full Activity Stream Output (Top to Bottom):');
  for (const item of stream) {
    const timeStr = new Date(item.timestamp).toISOString().substring(11, 19);
    console.log(`[${timeStr}] [${item.actor.padEnd(13)}] ${item.transactionId} -> ${item.event} (${item.reason?.substring(0, 50) || '—'})`);
  }

  // Verify TXN-8003 sequence in stream
  const hvEvents = stream.filter(s => s.transactionId === 'TXN-8003').map(s => s.event);
  console.log(`\n- TXN-8003 Sequence in Activity Stream: ${hvEvents.join(' -> ')}`);

  const expectedHvOrder = [
    'HUMAN_APPROVAL_GRANTED',
    'ACTION_EXECUTED',
    'REVENUE_RECOVERED'
  ];

  let hvIndex = 0;
  let hvMatch = true;
  for (const exp of expectedHvOrder) {
    const foundIdx = hvEvents.indexOf(exp, hvIndex);
    if (foundIdx === -1 || foundIdx < hvIndex) {
      hvMatch = false;
      break;
    }
    hvIndex = foundIdx;
  }
  console.log(`- TXN-8003 Chronological Ordering: ${hvMatch ? '✅ PASS' : '❌ FAIL'}`);

  // Verify TXN-8093 sequence in stream
  const fraudEvents = stream.filter(s => s.transactionId === 'TXN-8093').map(s => s.event);
  console.log(`- TXN-8093 Sequence in Activity Stream: ${fraudEvents.join(' -> ')}`);

  const expectedFraudOrder = [
    'AI_FALLBACK_USED',
    'POLICY_EVALUATED',
    'CASE_STOPPED'
  ];

  let fraudIndex = 0;
  let fraudMatch = true;
  for (const exp of expectedFraudOrder) {
    const foundIdx = fraudEvents.indexOf(exp, fraudIndex);
    if (foundIdx === -1 || foundIdx < fraudIndex) {
      fraudMatch = false;
      break;
    }
    fraudIndex = foundIdx;
  }
  console.log(`- TXN-8093 Chronological Ordering: ${fraudMatch ? '✅ PASS' : '❌ FAIL'}`);

  await generateSeedDataset();
  await disconnectDB();

  console.log('\n====================================================================');
  console.log(`OVERALL CHRONOLOGY RESULT: ${hvMatch && fraudMatch ? '✅ PASS' : '❌ FAIL'}`);
  console.log('====================================================================\n');
}

runChronologyVerification();
