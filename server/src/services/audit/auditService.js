import { AuditLog } from '../../models/AuditLog.js';
import crypto from 'crypto';

/**
 * Append-only audit logger service.
 * Records all micro-decisions and lifecycle milestones.
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
    const log = new AuditLog({
      auditId,
      recoveryCaseId,
      transactionId: transactionId || recoveryCaseId,
      actor,
      event,
      actionTaken,
      reason,
      stateBefore,
      stateAfter,
      financialImpact,
      payload,
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
