import { RecoveryCase } from '../../models/RecoveryCase.js';
import { Customer } from '../../models/Customer.js';
import { Transaction } from '../../models/Transaction.js';
import { SimulationBatch } from '../../models/SimulationBatch.js';
import { CASE_STATES } from '../../config/constants.js';
import { processCaseWorkflow } from '../workflow/workflowEngine.js';

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
  const cases = await RecoveryCase.find({});
  
  const batch = new SimulationBatch({
    batchId,
    status: 'RUNNING',
    totalCases: cases.length,
    processedCases: 0,
    recoveredCases: 0,
    escalatedCases: 0,
    stoppedCases: 0,
    recoveredAmount: 0,
    startedAt: new Date()
  });
  await batch.save();

  // Run in background / async
  const delayMs = speed === 'ANIMATED' ? 80 : 5;

  activeBatchPromise = (async () => {
    try {
      // Pre-fetch all customers and transactions into lookup maps for high performance
      const customers = await Customer.find({});
      const transactions = await Transaction.find({});
      const custMap = new Map(customers.map(c => [c.customerId, c]));
      const txnMap = new Map(transactions.map(t => [t.transactionId, t]));

      for (const rc of cases) {
        // Skip if already in terminal state
        if ([CASE_STATES.RECOVERED, CASE_STATES.STOPPED, CASE_STATES.EXPIRED].includes(rc.state)) {
          batch.processedCases++;
          if (rc.state === CASE_STATES.RECOVERED) batch.recoveredCases++;
          if (rc.state === CASE_STATES.STOPPED) batch.stoppedCases++;
          continue;
        }

        const customer = custMap.get(rc.customerId);
        const transaction = txnMap.get(rc.transactionId);

        rc.batchId = batchId;
        const updatedCase = await processCaseWorkflow(rc, customer, transaction);

        batch.processedCases++;
        if (updatedCase.state === CASE_STATES.RECOVERED) {
          batch.recoveredCases++;
          batch.recoveredAmount += updatedCase.recoveredAmount;
        } else if (updatedCase.state === CASE_STATES.ESCALATED) {
          batch.escalatedCases++;
        } else if (updatedCase.state === CASE_STATES.STOPPED) {
          batch.stoppedCases++;
        }

        await batch.save();

        if (delayMs > 0) {
          await new Promise(res => setTimeout(res, delayMs));
        }
      }

      batch.status = 'COMPLETED';
      batch.completedAt = new Date();
      await batch.save();
    } catch (err) {
      console.error(`[Batch Orchestrator Error] ${err.message}`, err);
      batch.status = 'FAILED';
      await batch.save();
    } finally {
      activeBatchPromise = null;
    }
  })();

  return batch;
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
