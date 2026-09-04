import { connectDB } from '../config/db.js';
import { generateSeedDataset } from '../services/simulation/seedDataGenerator.js';
import { startBatchRun, resumeBatchRun, getBatchStatus, abortActiveBatch } from '../services/simulation/batchOrchestrator.js';
import { SimulationBatch } from '../models/SimulationBatch.js';
import { AuditLog } from '../models/AuditLog.js';

async function runBatchResumeVerification() {
  console.log('=== [RecoverOS Verification] Starting P1-4 Resumable Batch Orchestration Verification ===\n');

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
    // -------------------------------------------------------------
    // Step 1: Run uninterrupted golden baseline batch
    // -------------------------------------------------------------
    console.log('[Step 1] Running uninterrupted golden baseline batch...');
    await generateSeedDataset();
    const goldenBatch = await startBatchRun('FAST');

    while (true) {
      await new Promise(r => setTimeout(r, 100));
      const status = await getBatchStatus(goldenBatch.batchId);
      if (status.status === 'COMPLETED' || status.status === 'FAILED') break;
    }

    const baseline = await getBatchStatus(goldenBatch.batchId);
    console.log(`Baseline Result: Recovered ${baseline.recoveredCases} cases, ₹${baseline.recoveredAmount.toLocaleString('en-IN')}`);

    // -------------------------------------------------------------
    // Step 2: Reset DB and start interrupted batch run
    // -------------------------------------------------------------
    console.log('\n[Step 2] Initializing fresh batch and simulating mid-run process interruption...');
    await generateSeedDataset();

    // Start animated batch (slower processing)
    const interruptedBatch = await startBatchRun('ANIMATED');

    // Wait until ~25-35 cases have been processed
    for (let i = 0; i < 40; i++) {
      await new Promise(r => setTimeout(r, 100));
      const status = await getBatchStatus(interruptedBatch.batchId);
      if (status.processedCases >= 25) {
        break;
      }
    }

    // Force abort in-flight background process (simulates immediate process termination)
    abortActiveBatch();
    await new Promise(r => setTimeout(r, 150));

    const midRunStatus = await getBatchStatus(interruptedBatch.batchId);
    console.log(`Interrupted checkpoint at case ${midRunStatus.processedCases}/100 (Last Case: ${midRunStatus.lastProcessedCaseId})`);

    assert(
      midRunStatus.lastProcessedCaseId !== null && midRunStatus.processedCases > 0 && midRunStatus.processedCases < 100,
      `Checkpoint persisted in DB: lastProcessedCaseId='${midRunStatus.lastProcessedCaseId}', processed=${midRunStatus.processedCases}`
    );

    // -------------------------------------------------------------
    // Step 3: Trigger batch resumption from saved checkpoint
    // -------------------------------------------------------------
    console.log('\n[Step 3] Resuming batch execution from checkpoint...');
    await resumeBatchRun(interruptedBatch.batchId, 'FAST');

    // Wait for resumed batch completion
    while (true) {
      await new Promise(r => setTimeout(r, 100));
      const status = await getBatchStatus(interruptedBatch.batchId);
      if (status.status === 'COMPLETED' || status.status === 'FAILED') break;
    }

    const finalResumedBatch = await getBatchStatus(interruptedBatch.batchId);

    // -------------------------------------------------------------
    // Step 4: Verify 100% financial and state equality with baseline
    // -------------------------------------------------------------
    assert(finalResumedBatch.status === 'COMPLETED', 'Resumed batch successfully transitioned to COMPLETED');
    assert(finalResumedBatch.processedCases === 100, 'Resumed batch processed all 100 cases without skipping');
    assert(
      finalResumedBatch.recoveredAmount === baseline.recoveredAmount,
      `Financial Determinism Invariant: Resumed amount ₹${finalResumedBatch.recoveredAmount.toLocaleString('en-IN')} matches baseline ₹${baseline.recoveredAmount.toLocaleString('en-IN')}`
    );
    assert(
      finalResumedBatch.recoveredCases === baseline.recoveredCases,
      `State Determinism Invariant: Resumed recovered cases (${finalResumedBatch.recoveredCases}) matches baseline (${baseline.recoveredCases})`
    );
    assert(
      finalResumedBatch.escalatedCases === baseline.escalatedCases,
      `State Determinism Invariant: Resumed escalated cases (${finalResumedBatch.escalatedCases}) matches baseline (${baseline.escalatedCases})`
    );
    assert(
      finalResumedBatch.stoppedCases === baseline.stoppedCases,
      `State Determinism Invariant: Resumed stopped cases (${finalResumedBatch.stoppedCases}) matches baseline (${baseline.stoppedCases})`
    );

    // -------------------------------------------------------------
    // Step 5: Verify Audit Log has BATCH_RESUME_STARTED entry
    // -------------------------------------------------------------
    const resumeAudit = await AuditLog.findOne({
      event: 'BATCH_RESUME_STARTED',
      'payload.batchId': interruptedBatch.batchId
    });
    assert(resumeAudit !== null, 'Audit trail contains BATCH_RESUME_STARTED entry with checkpoint metadata');

  } finally {
    await generateSeedDataset();
    process.exit(failed > 0 ? 1 : 0);
  }
}

runBatchResumeVerification();
