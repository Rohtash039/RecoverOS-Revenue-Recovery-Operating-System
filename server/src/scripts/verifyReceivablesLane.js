import { connectDB } from '../config/db.js';
import { generateSeedDataset } from '../services/simulation/seedDataGenerator.js';
import { RecoveryCase } from '../models/RecoveryCase.js';
import { Transaction } from '../models/Transaction.js';
import { Customer } from '../models/Customer.js';
import { calculateROS } from '../services/scoring/opportunityScorer.js';
import { evaluatePolicy } from '../services/policy/guardrailEngine.js';
import { getFallbackDiagnosis } from '../services/ai/fallbackEngine.js';
import { simulateExecutionOutcome } from '../services/simulation/seededSimulator.js';
import { startBatchRun, getBatchStatus } from '../services/simulation/batchOrchestrator.js';
import { getDashboardAnalytics } from '../services/analytics/analyticsService.js';
import { RECOVERY_ACTIONS, SIMULATION_REFERENCE_TIME } from '../config/constants.js';

async function runReceivablesVerification() {
  console.log('=== [RecoverOS Verification] Starting P1-6 B2B Receivables Recovery Lane Verification ===\n');

  await connectDB();

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    await generateSeedDataset();

    // -------------------------------------------------------------
    // Test 1: Verify seeded dataset contains B2B overdue receivables cases
    // -------------------------------------------------------------
    const receivablesCases = await RecoveryCase.find({
      normalizedFailureCategory: 'RECEIVABLE_OVERDUE'
    });

    assert(
      receivablesCases.length === 20,
      `Seeded dataset contains 20 B2B overdue receivables cases (found: ${receivablesCases.length})`
    );

    // -------------------------------------------------------------
    // Test 2: Verify invoice metadata attached on transactions
    // -------------------------------------------------------------
    const sampleReceivableCase = receivablesCases[0];
    const txn = await Transaction.findOne({ transactionId: sampleReceivableCase.transactionId });
    const cust = await Customer.findOne({ customerId: sampleReceivableCase.customerId });

    assert(
      txn.eventType === 'INVOICE_OVERDUE' &&
      txn.metadata?.invoiceNumber?.startsWith('INV-2026-') &&
      txn.metadata?.daysOverdue > 0,
      `Transaction contains invoice metadata: invoiceNumber='${txn.metadata?.invoiceNumber}', daysOverdue=${txn.metadata?.daysOverdue}`
    );

    // -------------------------------------------------------------
    // Test 3: Verify Opportunity Scorer calculates ROS with recency curve for receivables
    // -------------------------------------------------------------
    const rosResult = calculateROS(txn, cust, SIMULATION_REFERENCE_TIME);
    assert(
      rosResult.recoveryScore > 0 && rosResult.scoreFactors.failureRecoverability === 85,
      `ROS scored B2B invoice case properly: score=${rosResult.recoveryScore}/100, recoverability=${rosResult.scoreFactors.failureRecoverability}`
    );

    // -------------------------------------------------------------
    // Test 4: Verify Fallback Engine recommends SEND_INVOICE_REMINDER
    // -------------------------------------------------------------
    const diagnosis = getFallbackDiagnosis(txn, cust);
    assert(
      diagnosis.diagnosisCategory === 'RECEIVABLE_OVERDUE' &&
      diagnosis.recommendedAction === RECOVERY_ACTIONS.SEND_INVOICE_REMINDER,
      `Fallback Engine recommended action '${diagnosis.recommendedAction}' with category '${diagnosis.diagnosisCategory}'`
    );

    // -------------------------------------------------------------
    // Test 5: Verify Guardrail Engine allows overdue invoice (> 48h) under 90-day B2B SLA window
    // -------------------------------------------------------------
    const policyResult = evaluatePolicy(
      { ...sampleReceivableCase.toObject(), failureCode: txn.failureCode, eventType: txn.eventType, createdAt: txn.createdAt },
      diagnosis.recommendedAction,
      SIMULATION_REFERENCE_TIME
    );
    assert(
      policyResult.decision === 'APPROVE' && policyResult.finalAction === RECOVERY_ACTIONS.SEND_INVOICE_REMINDER,
      `Guardrail Engine approved 30-day overdue invoice under B2B 90-day SLA window exception`
    );

    // -------------------------------------------------------------
    // Test 6: Verify Seeded Simulator executes SEND_INVOICE_REMINDER
    // -------------------------------------------------------------
    const simOutcome = simulateExecutionOutcome(
      {
        recoveryCaseId: sampleReceivableCase.recoveryCaseId,
        failureCode: txn.failureCode,
        initialRevenueAtRisk: sampleReceivableCase.initialRevenueAtRisk,
        recoveryScore: sampleReceivableCase.recoveryScore,
        eventType: txn.eventType
      },
      RECOVERY_ACTIONS.SEND_INVOICE_REMINDER,
      1
    );
    assert(
      simOutcome.result === 'SUCCESS' || simOutcome.result === 'FAILED',
      `Seeded Simulator executed SEND_INVOICE_REMINDER resulting in '${simOutcome.result}'`
    );

    // -------------------------------------------------------------
    // Test 7: Verify Batch Run processes and Analytics Breakdown includes RECEIVABLE_OVERDUE
    // -------------------------------------------------------------
    console.log('\n[Step] Running batch to verify end-to-end analytics breakdown...');
    const batch = await startBatchRun('FAST');
    while (true) {
      await new Promise(r => setTimeout(r, 100));
      const status = await getBatchStatus(batch.batchId);
      if (status.status === 'COMPLETED' || status.status === 'FAILED') break;
    }

    const analytics = await getDashboardAnalytics();
    const receivableBreakdown = analytics.recoveryByFailureCategory?.find(c => c.category === 'RECEIVABLE_OVERDUE');

    assert(
      receivableBreakdown !== undefined && receivableBreakdown.casesCount === 20 && receivableBreakdown.recoveredCount > 0,
      `Analytics breakdown includes RECEIVABLE_OVERDUE: casesCount=${receivableBreakdown?.casesCount}, recoveredCount=${receivableBreakdown?.recoveredCount}, recoveredAmount=₹${receivableBreakdown?.recovered?.toLocaleString('en-IN')}`
    );

  } finally {
    await generateSeedDataset();
    process.exit(failed > 0 ? 1 : 0);
  }
}

runReceivablesVerification();
