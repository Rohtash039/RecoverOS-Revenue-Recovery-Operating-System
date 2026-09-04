import { AuditLog } from '../../models/AuditLog.js';
import crypto from 'crypto';

export const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

export function calculateAuditEntryHash({
  previousHash,
  auditId,
  recoveryCaseId,
  transactionId,
  actor,
  event,
  actionTaken = '',
  reason = '',
  stateBefore = '',
  stateAfter = '',
  financialImpact = 0,
  payload = null
}) {
  const content = [
    previousHash,
    auditId,
    recoveryCaseId,
    transactionId,
    actor,
    event,
    actionTaken || '',
    reason || '',
    stateBefore || '',
    stateAfter || '',
    Number(financialImpact) || 0,
    payload ? JSON.stringify(payload) : ''
  ].join('|');

  return crypto.createHash('sha256').update(content).digest('hex');
}

export async function recordAuditLog({
  recoveryCaseId,
  transactionId,
  actor,
  event,
  actionTaken = null,
  reason = null,
  stateBefore = null,
  stateAfter = null,
  financialImpact = 0,
  payload = null
}) {
  const MAX_CONCURRENCY_RETRIES = 25;
  const targetTxnId = transactionId || recoveryCaseId;

  for (let attempt = 0; attempt < MAX_CONCURRENCY_RETRIES; attempt++) {
    try {
      const auditId = `AUD-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

      const lastEntry = await AuditLog.findOne().sort({ sequence: -1, timestamp: -1, _id: -1 });
      const sequence = lastEntry ? ((lastEntry.sequence || 0) + 1) : 1;
      const previousHash = lastEntry?.entryHash || GENESIS_HASH;

      const entryHash = calculateAuditEntryHash({
        previousHash,
        auditId,
        recoveryCaseId,
        transactionId: targetTxnId,
        actor,
        event,
        actionTaken,
        reason,
        stateBefore,
        stateAfter,
        financialImpact,
        payload
      });

      const log = new AuditLog({
        auditId,
        sequence,
        recoveryCaseId,
        transactionId: targetTxnId,
        actor,
        event,
        actionTaken,
        reason,
        stateBefore,
        stateAfter,
        financialImpact,
        payload,
        previousHash,
        entryHash,
        timestamp: new Date()
      });

      await log.save();
      return log;
    } catch (error) {

      const isDuplicateKey = error.code === 11000 ||
                             (error.name === 'MongoServerError' && error.code === 11000) ||
                             (error.message && error.message.includes('E11000'));

      if (isDuplicateKey && attempt < MAX_CONCURRENCY_RETRIES - 1) {

        const backoffMs = Math.floor(Math.random() * 25) + (attempt * 5);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
        continue;
      }

      console.error(`[Audit Log Error] Failed to write audit event ${event}: ${error.message}`);

      return null;
    }
  }

  return null;
}

export async function verifyAuditChainIntegrity() {
  const entries = await AuditLog.find({}).sort({ sequence: 1, timestamp: 1, _id: 1 });
  let expectedPrevHash = GENESIS_HASH;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const expectedSequence = i + 1;

    if (entry.sequence !== undefined && entry.sequence !== expectedSequence) {
      return {
        valid: false,
        totalEntries: entries.length,
        verifiedCount: i,
        brokenAtAuditId: entry.auditId,
        reason: `Sequence break at entry #${i + 1} (${entry.auditId}). Expected sequence ${expectedSequence}, found ${entry.sequence}`
      };
    }

    if (entry.previousHash !== expectedPrevHash) {
      return {
        valid: false,
        totalEntries: entries.length,
        verifiedCount: i,
        brokenAtAuditId: entry.auditId,
        reason: `Previous hash mismatch at entry #${i + 1} (${entry.auditId}). Expected '${expectedPrevHash}', found '${entry.previousHash}'`
      };
    }

    const computedHash = calculateAuditEntryHash({
      previousHash: entry.previousHash,
      auditId: entry.auditId,
      recoveryCaseId: entry.recoveryCaseId,
      transactionId: entry.transactionId,
      actor: entry.actor,
      event: entry.event,
      actionTaken: entry.actionTaken,
      reason: entry.reason,
      stateBefore: entry.stateBefore,
      stateAfter: entry.stateAfter,
      financialImpact: entry.financialImpact,
      payload: entry.payload
    });

    if (entry.entryHash !== computedHash) {
      return {
        valid: false,
        totalEntries: entries.length,
        verifiedCount: i,
        brokenAtAuditId: entry.auditId,
        reason: `Payload tamper detected at entry #${i + 1} (${entry.auditId}). Entry hash '${entry.entryHash}' does not match computed hash '${computedHash}'`
      };
    }

    expectedPrevHash = entry.entryHash;
  }

  return {
    valid: true,
    totalEntries: entries.length,
    verifiedCount: entries.length,
    genesisHash: GENESIS_HASH,
    latestHash: expectedPrevHash
  };
}

