import crypto from 'crypto';
import { RecoveryCase } from '../../models/RecoveryCase.js';
import { Customer } from '../../models/Customer.js';
import { Transaction } from '../../models/Transaction.js';
import { RecoveryAction } from '../../models/RecoveryAction.js';
import { AuditLog } from '../../models/AuditLog.js';
import { SimulationBatch } from '../../models/SimulationBatch.js';
import { CASE_STATES, AUDIT_ACTORS } from '../../config/constants.js';
import { processCaseWorkflow } from '../workflow/workflowEngine.js';
import { recordAuditLog, calculateAuditEntryHash, GENESIS_HASH } from '../audit/auditService.js';
import { invalidateAnalyticsCache } from '../analytics/analyticsService.js';

let activeBatchAbortController = null;
let activeBatchPromise = null;

const CHUNK_SIZE = 10;

export async function startBatchRun(speed = 'FAST') {
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

  const chunkDelayMs = speed === 'ANIMATED' ? 250 : 150;
  activeBatchAbortController = new AbortController();
  const signal = activeBatchAbortController.signal;

  activeBatchPromise = runBatchLoop(batch, cases, 0, chunkDelayMs, signal);

  return batch;
}

export function abortActiveBatch() {
  if (activeBatchAbortController) {
    activeBatchAbortController.abort();
    activeBatchAbortController = null;
  }
  activeBatchPromise = null;
}

export async function resumeBatchRun(batchId, speed = 'FAST') {
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

  const chunkDelayMs = speed === 'ANIMATED' ? 250 : 150;
  activeBatchAbortController = new AbortController();
  const signal = activeBatchAbortController.signal;

  activeBatchPromise = runBatchLoop(batch, cases, startIndex, chunkDelayMs, signal);

  return batch;
}

async function runBatchLoop(batch, cases, startIndex, chunkDelayMs, signal) {
  try {
    const [customers, transactions, existingActions, lastAuditEntry] = await Promise.all([
      Customer.find({}),
      Transaction.find({}),
      RecoveryAction.find({}),
      AuditLog.findOne().sort({ sequence: -1, timestamp: -1, _id: -1 })
    ]);

    const custMap = new Map(customers.map(c => [c.customerId, c]));
    const txnMap = new Map(transactions.map(t => [t.transactionId, t]));
    const actionMap = new Map(existingActions.map(a => [a.idempotencyKey, a]));

    let currentSequence = lastAuditEntry ? (lastAuditEntry.sequence || 0) : 0;
    let currentPrevHash = lastAuditEntry?.entryHash || GENESIS_HASH;

    for (let i = startIndex; i < cases.length; i += CHUNK_SIZE) {
      if (signal?.aborted) {
        return;
      }

      const chunkEnd = Math.min(i + CHUNK_SIZE, cases.length);
      const chunk = cases.slice(i, chunkEnd);

      const chunkAuditDocs = [];
      const chunkActionDocs = [];
      const chunkCaseOps = [];

      let chunkProcessed = 0;
      let chunkRecovered = 0;
      let chunkEscalated = 0;
      let chunkStopped = 0;
      let chunkRecoveredAmt = 0;
      let lastCaseIdInChunk = null;

      for (const rc of chunk) {
        if (signal?.aborted) {
          return;
        }

        lastCaseIdInChunk = rc.recoveryCaseId;

        if ([CASE_STATES.RECOVERED, CASE_STATES.STOPPED, CASE_STATES.EXPIRED].includes(rc.state)) {
          chunkProcessed++;
          if (rc.state === CASE_STATES.RECOVERED) {
            chunkRecovered++;
            chunkRecoveredAmt += (rc.recoveredAmount || 0);
          } else if (rc.state === CASE_STATES.STOPPED) {
            chunkStopped++;
          }
          continue;
        }

        const customer = custMap.get(rc.customerId);
        const transaction = txnMap.get(rc.transactionId);
        rc.batchId = batch.batchId;

        const batchContext = {
          recordAudit: (entry) => {
            currentSequence++;
            const targetTxnId = entry.transactionId || entry.recoveryCaseId;
            const auditId = `AUD-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}-${String(currentSequence).padStart(4, '0')}`;
            const entryHash = calculateAuditEntryHash({
              previousHash: currentPrevHash,
              auditId,
              recoveryCaseId: entry.recoveryCaseId,
              transactionId: targetTxnId,
              actor: entry.actor,
              event: entry.event,
              actionTaken: entry.actionTaken || '',
              reason: entry.reason || '',
              stateBefore: entry.stateBefore || '',
              stateAfter: entry.stateAfter || '',
              financialImpact: Number(entry.financialImpact) || 0,
              payload: entry.payload || null
            });

            const doc = {
              auditId,
              sequence: currentSequence,
              recoveryCaseId: entry.recoveryCaseId,
              transactionId: targetTxnId,
              actor: entry.actor,
              event: entry.event,
              actionTaken: entry.actionTaken || null,
              reason: entry.reason || null,
              stateBefore: entry.stateBefore || null,
              stateAfter: entry.stateAfter || null,
              financialImpact: Number(entry.financialImpact) || 0,
              payload: entry.payload || null,
              previousHash: currentPrevHash,
              entryHash,
              timestamp: new Date()
            };

            chunkAuditDocs.push(doc);
            currentPrevHash = entryHash;
            return doc;
          },

          executeWithIdempotency: async ({
            recoveryCaseId,
            transactionId,
            workflowStep,
            actionType,
            attemptNumber,
            operatorId = null,
            executeFn
          }) => {
            const idempotencyKey = `${recoveryCaseId}:${workflowStep}:${attemptNumber}:${actionType}`;
            if (actionMap.has(idempotencyKey)) {
              const existingAction = actionMap.get(idempotencyKey);
              batchContext.recordAudit({
                recoveryCaseId,
                transactionId,
                actor: AUDIT_ACTORS.SYSTEM,
                event: 'DUPLICATE_ACTION_BLOCKED',
                actionTaken: actionType,
                reason: `Action with idempotency key ${idempotencyKey} already executed. Returning cached result.`
              });
              return {
                idempotent: true,
                action: existingAction,
                outcome: {
                  result: existingAction.result,
                  recoveredAmount: existingAction.recoveredAmount,
                  reason: existingAction.reason
                }
              };
            }

            const outcome = await executeFn();
            const newAction = {
              idempotencyKey,
              recoveryCaseId,
              workflowStep,
              actionType,
              attemptNumber,
              operatorId,
              result: outcome.result,
              recoveredAmount: outcome.recoveredAmount || 0,
              reason: outcome.reason,
              metadata: outcome.metadata || {},
              createdAt: new Date()
            };
            actionMap.set(idempotencyKey, newAction);
            chunkActionDocs.push(newAction);

            return {
              idempotent: false,
              action: newAction,
              outcome
            };
          }
        };

        const updatedCase = await processCaseWorkflow(rc, customer, transaction, batchContext);

        chunkProcessed++;
        if (updatedCase.state === CASE_STATES.RECOVERED) {
          chunkRecovered++;
          chunkRecoveredAmt += updatedCase.recoveredAmount;
        } else if (updatedCase.state === CASE_STATES.ESCALATED) {
          chunkEscalated++;
        } else if (updatedCase.state === CASE_STATES.STOPPED) {
          chunkStopped++;
        }

        chunkCaseOps.push({
          updateOne: {
            filter: { recoveryCaseId: rc.recoveryCaseId },
            update: {
              $set: {
                batchId: batch.batchId,
                state: updatedCase.state,
                recoveryScore: updatedCase.recoveryScore,
                scoreFactors: updatedCase.scoreFactors,
                expectedRecovery: updatedCase.expectedRecovery,
                aiDiagnosis: updatedCase.aiDiagnosis,
                policyEvaluation: updatedCase.policyEvaluation,
                retryCount: updatedCase.retryCount,
                contactCount: updatedCase.contactCount,
                recoveredAmount: updatedCase.recoveredAmount,
                terminalReason: updatedCase.terminalReason,
                pendingHumanAction: updatedCase.pendingHumanAction,
                lastActionAt: updatedCase.lastActionAt,
                updatedAt: updatedCase.updatedAt || new Date()
              }
            }
          }
        });
      }

      if (signal?.aborted) {
        return;
      }

      if (chunkAuditDocs.length > 0) {
        await AuditLog.insertMany(chunkAuditDocs, { ordered: true });
      }
      if (chunkActionDocs.length > 0) {
        await RecoveryAction.insertMany(chunkActionDocs, { ordered: false });
      }
      if (chunkCaseOps.length > 0) {
        await RecoveryCase.bulkWrite(chunkCaseOps);
      }

      batch.processedCases += chunkProcessed;
      batch.recoveredCases += chunkRecovered;
      batch.escalatedCases += chunkEscalated;
      batch.stoppedCases += chunkStopped;
      batch.recoveredAmount += chunkRecoveredAmt;
      batch.lastProcessedCaseId = lastCaseIdInChunk;
      batch.checkpointIndex = batch.processedCases;
      batch.updatedAt = new Date();
      await batch.save();
      invalidateAnalyticsCache();

      if (chunkDelayMs > 0 && chunkEnd < cases.length) {
        await new Promise(res => setTimeout(res, chunkDelayMs));
      }
    }

    if (signal?.aborted) {
      return;
    }

    batch.status = 'COMPLETED';
    batch.completedAt = new Date();
    batch.updatedAt = new Date();
    await batch.save();
    invalidateAnalyticsCache();
  } catch (err) {
    console.error(`[Batch Orchestrator Error] ${err.message}`, err);
    batch.status = 'FAILED';
    batch.updatedAt = new Date();
    await batch.save();
    invalidateAnalyticsCache();
  } finally {
    activeBatchPromise = null;
  }
}

export async function getBatchStatus(batchId) {
  if (!batchId || batchId === 'undefined' || batchId === 'null' || batchId === 'latest') {
    return await SimulationBatch.findOne().sort({ startedAt: -1 });
  }
  return await SimulationBatch.findOne({ batchId });
}

