import { RecoveryCase } from '../../models/RecoveryCase.js';
import { Customer } from '../../models/Customer.js';
import { Transaction } from '../../models/Transaction.js';
import { SimulationBatch } from '../../models/SimulationBatch.js';
import { CASE_STATES, AUDIT_ACTORS } from '../../config/constants.js';
import { processCaseWorkflow } from '../workflow/workflowEngine.js';
import { recordAuditLog } from '../audit/auditService.js';

let activeBatchAbortController = null;
let activeBatchPromise = null;

/**
 * Initiates or returns an active batch run for all cases.
 */
export async function startBatchRun(speed = 'FAST') {
  // Check if there is an existing running batch
  const existingBatch = await SimulationBatch.findOne({ status: 'RUNNING' });
  if (existingBatch) {
    return existingBatch;
  }

  const batchId = `BATCH-${Date.now()}`;
  const cases = await RecoveryCase.find({}).sort({ recoveryCaseId: 1 });
  
  const batch = new SimulationBatch({
    batchId,
    status: 'RUNNING',
    totalCases: cases.length,
    processedCases: 0,
    recoveredCases: 0,
    escalatedCases: 0,
    stoppedCases: 0,
    recoveredAmount: 0,
    lastProcessedCaseId: null,
    checkpointIndex: 0,
    startedAt: new Date(),
    updatedAt: new Date()
  });
  await batch.save();

  // Run in background / async with abort signal
  const delayMs = speed === 'ANIMATED' ? 80 : 5;
  activeBatchAbortController = new AbortController();
  const signal = activeBatchAbortController.signal;

  activeBatchPromise = runBatchLoop(batch, cases, 0, delayMs, signal);

  return batch;
}

/**
 * Force aborts active in-memory batch process (simulates process crash / restart).
 */
export function abortActiveBatch() {
  if (activeBatchAbortController) {
    activeBatchAbortController.abort();
    activeBatchAbortController = null;
  }
  activeBatchPromise = null;
}

/**
 * Resumes an interrupted or active batch run from its last saved case checkpoint.
 */
export async function resumeBatchRun(batchId, speed = 'FAST') {
  // Abort any existing in-memory running promise before resuming
  abortActiveBatch();

  let batch = null;
  if (batchId) {
    batch = await SimulationBatch.findOne({ batchId });
  } else {
    batch = await SimulationBatch.findOne({ status: { $in: ['RUNNING', 'FAILED'] } }).sort({ startedAt: -1 });
  }

  if (!batch) {
    const error = new Error(`No resumable batch found for ID '${batchId || 'latest'}'`);
    error.statusCode = 404;
    throw error;
  }

  if (batch.status === 'COMPLETED') {
    return batch;
  }

  batch.status = 'RUNNING';
  batch.updatedAt = new Date();
  await batch.save();

  await recordAuditLog({
    recoveryCaseId: batch.lastProcessedCaseId || 'N/A',
    transactionId: 'N/A',
    actor: AUDIT_ACTORS.SYSTEM,
    event: 'BATCH_RESUME_STARTED',
    reason: `Resuming batch run ${batch.batchId} from checkpoint case: ${batch.lastProcessedCaseId || 'START'}`,
    financialImpact: batch.recoveredAmount,
    payload: {
      batchId: batch.batchId,
      lastProcessedCaseId: batch.lastProcessedCaseId,
      processedCases: batch.processedCases
    }
  });

  const cases = await RecoveryCase.find({}).sort({ recoveryCaseId: 1 });
  let startIndex = 0;

  if (batch.lastProcessedCaseId) {
    const lastIndex = cases.findIndex(c => c.recoveryCaseId === batch.lastProcessedCaseId);
    if (lastIndex !== -1) {
      startIndex = lastIndex + 1;
    }
  }

  const delayMs = speed === 'ANIMATED' ? 80 : 5;
  activeBatchAbortController = new AbortController();
  const signal = activeBatchAbortController.signal;

  activeBatchPromise = runBatchLoop(batch, cases, startIndex, delayMs, signal);

  return batch;
}

/**
 * Internal execution loop processing cases sequentially with checkpoints.
 */
async function runBatchLoop(batch, cases, startIndex, delayMs, signal) {
  try {
    const customers = await Customer.find({});
    const transactions = await Transaction.find({});
    const custMap = new Map(customers.map(c => [c.customerId, c]));
    const txnMap = new Map(transactions.map(t => [t.transactionId, t]));

    for (let i = startIndex; i < cases.length; i++) {
      if (signal?.aborted) {
        return;
      }

      const rc = cases[i];

      // Skip if already in terminal state
      if ([CASE_STATES.RECOVERED, CASE_STATES.STOPPED, CASE_STATES.EXPIRED].includes(rc.state)) {
        batch.processedCases++;
        if (rc.state === CASE_STATES.RECOVERED) batch.recoveredCases++;
        if (rc.state === CASE_STATES.STOPPED) batch.stoppedCases++;
        batch.lastProcessedCaseId = rc.recoveryCaseId;
        batch.checkpointIndex = batch.processedCases;
        batch.updatedAt = new Date();
        await batch.save();
        continue;
      }

      const customer = custMap.get(rc.customerId);
      const transaction = txnMap.get(rc.transactionId);

      rc.batchId = batch.batchId;
      const updatedCase = await processCaseWorkflow(rc, customer, transaction);

      if (signal?.aborted) {
        return;
      }

      batch.processedCases++;
      if (updatedCase.state === CASE_STATES.RECOVERED) {
        batch.recoveredCases++;
        batch.recoveredAmount += updatedCase.recoveredAmount;
      } else if (updatedCase.state === CASE_STATES.ESCALATED) {
        batch.escalatedCases++;
      } else if (updatedCase.state === CASE_STATES.STOPPED) {
        batch.stoppedCases++;
      }

      batch.lastProcessedCaseId = rc.recoveryCaseId;
      batch.checkpointIndex = batch.processedCases;
      batch.updatedAt = new Date();
      await batch.save();

      if (delayMs > 0) {
        await new Promise(res => setTimeout(res, delayMs));
      }
    }

    if (signal?.aborted) {
      return;
    }

    batch.status = 'COMPLETED';
    batch.completedAt = new Date();
    batch.updatedAt = new Date();
    await batch.save();
  } catch (err) {
    console.error(`[Batch Orchestrator Error] ${err.message}`, err);
    batch.status = 'FAILED';
    batch.updatedAt = new Date();
    await batch.save();
  } finally {
    activeBatchPromise = null;
  }
}

/**
 * Gets batch status by ID
 */
export async function getBatchStatus(batchId) {
  if (!batchId) {
    return await SimulationBatch.findOne().sort({ startedAt: -1 });
  }
  return await SimulationBatch.findOne({ batchId });
}
