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
      console.log(`PASS: ${message}`);
      passed++;
    } else {
      console.error(`FAIL: ${message}`);
      failed++;
    }
  }

  try {

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

    console.log('\n[Step 2] Initializing fresh batch and simulating mid-run process interruption...');
    await generateSeedDataset();

    const interruptedBatch = await startBatchRun('ANIMATED');

    for (let i = 0; i < 40; i++) {
      await new Promise(r => setTimeout(r, 100));
      const status = await getBatchStatus(interruptedBatch.batchId);
      if (status.processedCases >= 25) {
        break;
      }
    }

    abortActiveBatch();
    await new Promise(r => setTimeout(r, 150));

    const midRunStatus = await getBatchStatus(interruptedBatch.batchId);
    console.log(`Interrupted checkpoint at case ${midRunStatus.processedCases}/100 (Last Case: ${midRunStatus.lastProcessedCaseId})`);

    assert(
      midRunStatus.lastProcessedCaseId !== null && midRunStatus.processedCases > 0 && midRunStatus.processedCases < 100,
      `Checkpoint persisted in DB: lastProcessedCaseId='${midRunStatus.lastProcessedCaseId}', processed=${midRunStatus.processedCases}`
    );

    console.log('\n[Step 3] Resuming batch execution from checkpoint...');
    await resumeBatchRun(interruptedBatch.batchId, 'FAST');

    while (true) {
      await new Promise(r => setTimeout(r, 100));
      const status = await getBatchStatus(interruptedBatch.batchId);
      if (status.status === 'COMPLETED' || status.status === 'FAILED') break;
    }

    const finalResumedBatch = await getBatchStatus(interruptedBatch.batchId);

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

