import { RecoveryAction } from '../../models/RecoveryAction.js';
import { recordAuditLog } from '../audit/auditService.js';
import { AUDIT_ACTORS } from '../../config/constants.js';

/**
 * Idempotency Protection Service
 * Guarantees that identical requests do not duplicate simulator execution or financial attribution.
 */
export async function executeWithIdempotency({
  recoveryCaseId,
  transactionId,
  workflowStep,
  actionType,
  attemptNumber,
  executeFn
}) {
  const idempotencyKey = `${recoveryCaseId}:${workflowStep}:${attemptNumber}:${actionType}`;

  // Check if this action was already executed
  const existingAction = await RecoveryAction.findOne({ idempotencyKey });
  if (existingAction) {
    await recordAuditLog({
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

  // Execute the underlying action function
  const outcome = await executeFn();

  // Store new action with unique idempotencyKey
  const newAction = new RecoveryAction({
    idempotencyKey,
    recoveryCaseId,
    workflowStep,
    actionType,
    attemptNumber,
    result: outcome.result,
    recoveredAmount: outcome.recoveredAmount || 0,
    reason: outcome.reason,
    metadata: outcome.metadata || {}
  });

  await newAction.save();

  return {
    idempotent: false,
    action: newAction,
    outcome
  };
}
