import { AuditLog } from '../../models/AuditLog.js';
import crypto from 'crypto';

export const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

/**
 * Computes a deterministic SHA-256 hash over an audit entry and its prior link.
 */
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

/**
 * Append-only tamper-evident audit logger service.
 * Records all micro-decisions with cryptographic hash-chain linkage.
 */
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
  try {
    const auditId = `AUD-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const targetTxnId = transactionId || recoveryCaseId;

    // Fetch previous audit log entry to establish continuous hash chain
    const lastEntry = await AuditLog.findOne().sort({ timestamp: -1, _id: -1 });
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
    console.error(`[Audit Log Error] Failed to write audit event ${event}: ${error.message}`);
    // Non-fatal to prevent crashing primary operations
    return null;
  }
}

/**
 * Cryptographically verifies the unbroken integrity of the entire audit ledger.
 */
export async function verifyAuditChainIntegrity() {
  const entries = await AuditLog.find({}).sort({ timestamp: 1, _id: 1 });
  let expectedPrevHash = GENESIS_HASH;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];

    // Check 1: previousHash must match expected previous hash
    if (entry.previousHash !== expectedPrevHash) {
      return {
        valid: false,
        totalEntries: entries.length,
        verifiedCount: i,
        brokenAtAuditId: entry.auditId,
        reason: `Previous hash mismatch at entry #${i + 1} (${entry.auditId}). Expected '${expectedPrevHash}', found '${entry.previousHash}'`
      };
    }

    // Check 2: entryHash must match computed hash of this entry's content
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
