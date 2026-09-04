import { CASE_STATES, RECOVERY_ACTIONS, AUDIT_ACTORS, POLICY_CONFIG, HARD_PROHIBITED_CODES } from '../../config/constants.js';
import { calculateROS } from '../scoring/opportunityScorer.js';
import { diagnoseRecoveryCase } from '../ai/recoveryAgent.js';
import { evaluatePolicy } from '../policy/guardrailEngine.js';
import { simulateExecutionOutcome } from '../simulation/seededSimulator.js';
import { executeWithIdempotency } from './idempotency.js';
import { recordAuditLog } from '../audit/auditService.js';
import { validateStateTransition } from './stateMachine.js';

/**
 * Executes the complete bounded recovery lifecycle for a single case.
 * Runs through scoring, AI diagnosis, policy check, and bounded execution loop.
 */
export async function processCaseWorkflow(recoveryCase, customer, transaction) {
  const caseId = recoveryCase.recoveryCaseId;
  const txnId = transaction?.transactionId || recoveryCase.transactionId;

  // 1. SCORING
  validateStateTransition(recoveryCase.state, CASE_STATES.SCORING);
  recoveryCase.state = CASE_STATES.SCORING;
  const { recoveryScore, scoreFactors } = calculateROS(transaction, customer);
  recoveryCase.recoveryScore = recoveryScore;
  recoveryCase.scoreFactors = scoreFactors;

  // Deterministic estimated recovery calculation
  const probMultiplier = HARD_PROHIBITED_CODES.includes(transaction.failureCode) ? 0 : 0.85;
  const estimatedProb = (recoveryScore / 100) * probMultiplier;
  recoveryCase.expectedRecovery = Math.round(recoveryCase.initialRevenueAtRisk * estimatedProb);

  await recordAuditLog({
    recoveryCaseId: caseId,
    transactionId: txnId,
    actor: AUDIT_ACTORS.SYSTEM,
    event: 'ROS_CALCULATED',
    reason: `Calculated Recovery Opportunity Score: ${recoveryScore}/100`,
    stateBefore: CASE_STATES.AT_RISK,
    stateAfter: CASE_STATES.SCORING,
    payload: { scoreFactors, recoveryScore, expectedRecovery: recoveryCase.expectedRecovery }
  });

  // 2. ANALYZING (AI / Fallback)
  validateStateTransition(recoveryCase.state, CASE_STATES.ANALYZING);
  recoveryCase.state = CASE_STATES.ANALYZING;
  
  const diagnosis = await diagnoseRecoveryCase(transaction, customer, recoveryScore);
  recoveryCase.aiDiagnosis = diagnosis;
  
  await recordAuditLog({
    recoveryCaseId: caseId,
    transactionId: txnId,
    actor: AUDIT_ACTORS.AI_AGENT,
    event: diagnosis.fallbackUsed ? 'AI_FALLBACK_USED' : 'AI_ANALYZED',
    actionTaken: diagnosis.recommendedAction,
    reason: diagnosis.reasoning,
    stateBefore: CASE_STATES.SCORING,
    stateAfter: CASE_STATES.ACTION_PLANNED,
    payload: diagnosis
  });

  recoveryCase.state = CASE_STATES.ACTION_PLANNED;

  // 3. POLICY CHECK
  validateStateTransition(recoveryCase.state, CASE_STATES.POLICY_CHECK);
  recoveryCase.state = CASE_STATES.POLICY_CHECK;
  const policyResult = evaluatePolicy(
    { ...recoveryCase.toObject(), failureCode: transaction.failureCode },
    diagnosis.recommendedAction
  );
  recoveryCase.policyEvaluation = policyResult;

  await recordAuditLog({
    recoveryCaseId: caseId,
    transactionId: txnId,
    actor: AUDIT_ACTORS.POLICY_ENGINE,
    event: 'POLICY_EVALUATED',
    actionTaken: policyResult.finalAction,
    reason: policyResult.reasons.join(' | '),
    payload: policyResult
  });

  // Handle Policy Decision
  if (policyResult.decision === 'REJECT') {
    validateStateTransition(recoveryCase.state, CASE_STATES.STOPPED);
    recoveryCase.state = CASE_STATES.STOPPED;
    recoveryCase.terminalReason = policyResult.reasons.join(' | ');

    await recordAuditLog({
      recoveryCaseId: caseId,
      transactionId: txnId,
      actor: AUDIT_ACTORS.POLICY_ENGINE,
      event: 'CASE_STOPPED',
      actionTaken: RECOVERY_ACTIONS.STOP_RECOVERY,
      reason: recoveryCase.terminalReason,
      stateBefore: CASE_STATES.POLICY_CHECK,
      stateAfter: CASE_STATES.STOPPED
    });

    recoveryCase.updatedAt = new Date();
    await recoveryCase.save();
    return recoveryCase;
  }

  if (policyResult.finalAction === RECOVERY_ACTIONS.ESCALATE_TO_HUMAN) {
    validateStateTransition(recoveryCase.state, CASE_STATES.ESCALATED);
    recoveryCase.state = CASE_STATES.ESCALATED;
    recoveryCase.pendingHumanAction = policyResult.originalAction || diagnosis.recommendedAction;
    recoveryCase.terminalReason = policyResult.reasons.join(' | ');

    await recordAuditLog({
      recoveryCaseId: caseId,
      transactionId: txnId,
      actor: AUDIT_ACTORS.POLICY_ENGINE,
      event: 'CASE_ESCALATED',
      actionTaken: RECOVERY_ACTIONS.ESCALATE_TO_HUMAN,
      reason: recoveryCase.terminalReason,
      stateBefore: CASE_STATES.POLICY_CHECK,
      stateAfter: CASE_STATES.ESCALATED,
      payload: { pendingHumanAction: recoveryCase.pendingHumanAction }
    });

    recoveryCase.updatedAt = new Date();
    await recoveryCase.save();
    return recoveryCase;
  }

  // 4. BOUNDED EXECUTION LOOP (Max 2 Attempts)
  let currentAction = policyResult.finalAction;

  while (
    recoveryCase.retryCount < POLICY_CONFIG.MAX_PAYMENT_RETRIES &&
    recoveryCase.state !== CASE_STATES.RECOVERED &&
    recoveryCase.state !== CASE_STATES.STOPPED
  ) {
    const attemptNumber = recoveryCase.retryCount + 1;
    const workflowStep = `ATTEMPT_${attemptNumber}`;

    recoveryCase.state = CASE_STATES.EXECUTING;

    await recordAuditLog({
      recoveryCaseId: caseId,
      transactionId: txnId,
      actor: AUDIT_ACTORS.SYSTEM,
      event: 'ACTION_EXECUTED',
      actionTaken: currentAction,
      reason: `Executing attempt ${attemptNumber} with action ${currentAction}`,
      stateBefore: CASE_STATES.POLICY_CHECK,
      stateAfter: CASE_STATES.EXECUTING
    });

    recoveryCase.state = CASE_STATES.OBSERVING;

    // Idempotent execution wrapper
    const { outcome } = await executeWithIdempotency({
      recoveryCaseId: caseId,
      transactionId: txnId,
      workflowStep,
      actionType: currentAction,
      attemptNumber,
      executeFn: async () => {
        return simulateExecutionOutcome(
          {
            recoveryCaseId: caseId,
            failureCode: transaction.failureCode,
            initialRevenueAtRisk: recoveryCase.initialRevenueAtRisk,
            recoveryScore: recoveryCase.recoveryScore,
            eventType: transaction.eventType
          },
          currentAction,
          attemptNumber
        );
      }
    });

    recoveryCase.retryCount = attemptNumber;
    recoveryCase.lastActionAt = new Date();

    if ([RECOVERY_ACTIONS.SEND_PAYMENT_REMINDER, RECOVERY_ACTIONS.SEND_CHECKOUT_REMINDER, RECOVERY_ACTIONS.SEND_INVOICE_REMINDER].includes(currentAction)) {
      recoveryCase.contactCount++;
    }

    if (outcome.result === 'SUCCESS') {
      validateStateTransition(recoveryCase.state, CASE_STATES.RECOVERED);
      recoveryCase.state = CASE_STATES.RECOVERED;
      recoveryCase.recoveredAmount = outcome.recoveredAmount;
      recoveryCase.terminalReason = outcome.reason;

      await recordAuditLog({
        recoveryCaseId: caseId,
        transactionId: txnId,
        actor: AUDIT_ACTORS.SIMULATOR,
        event: 'REVENUE_RECOVERED',
        actionTaken: currentAction,
        reason: outcome.reason,
        stateBefore: CASE_STATES.OBSERVING,
        stateAfter: CASE_STATES.RECOVERED,
        financialImpact: outcome.recoveredAmount
      });
      break;
    } else {
      await recordAuditLog({
        recoveryCaseId: caseId,
        transactionId: txnId,
        actor: AUDIT_ACTORS.SIMULATOR,
        event: 'ATTEMPT_FAILED',
        actionTaken: currentAction,
        reason: outcome.reason,
        stateBefore: CASE_STATES.OBSERVING,
        stateAfter: CASE_STATES.ANALYZING,
        financialImpact: 0
      });

      // Bounded retry ceiling check
      if (recoveryCase.retryCount >= POLICY_CONFIG.MAX_PAYMENT_RETRIES) {
        validateStateTransition(recoveryCase.state, CASE_STATES.STOPPED);
        recoveryCase.state = CASE_STATES.STOPPED;
        recoveryCase.terminalReason = `Maximum retry ceiling (${POLICY_CONFIG.MAX_PAYMENT_RETRIES}) exhausted.`;

        await recordAuditLog({
          recoveryCaseId: caseId,
          transactionId: txnId,
          actor: AUDIT_ACTORS.POLICY_ENGINE,
          event: 'MAX_RETRIES_STOP',
          actionTaken: currentAction,
          reason: recoveryCase.terminalReason,
          stateBefore: CASE_STATES.OBSERVING,
          stateAfter: CASE_STATES.STOPPED
        });
      } else {
        // Attempt 2 adaptive action switch if appropriate
        if (currentAction === RECOVERY_ACTIONS.RETRY_PAYMENT && transaction.failureCode === 'INSUFFICIENT_FUNDS') {
          currentAction = RECOVERY_ACTIONS.SUGGEST_ALTERNATE_PAYMENT;
        }
      }
    }
  }

  recoveryCase.updatedAt = new Date();
  await recoveryCase.save();
  return recoveryCase;
}

/**
 * Handles explicit Human Actions on ESCALATED cases
 */
export async function handleHumanAction(recoveryCase, transaction, actionType, operatorId = 'ops_lead_default') {
  const caseId = recoveryCase.recoveryCaseId;
  const txnId = transaction?.transactionId || recoveryCase.transactionId;

  if (recoveryCase.state !== CASE_STATES.ESCALATED) {
    if ([CASE_STATES.EXECUTING, CASE_STATES.OBSERVING, CASE_STATES.RECOVERED, CASE_STATES.STOPPED].includes(recoveryCase.state)) {
      // Idempotent return for in-flight or already resolved human action
      return recoveryCase;
    }
    const error = new Error(`Cannot perform human action on case in state '${recoveryCase.state}'. Case must be 'ESCALATED'.`);
    error.statusCode = 400;
    throw error;
  }

  if (actionType === 'REJECT_ESCALATION' || actionType === 'FORCE_STOP') {
    validateStateTransition(recoveryCase.state, CASE_STATES.STOPPED, AUDIT_ACTORS.HUMAN);
    recoveryCase.state = CASE_STATES.STOPPED;
    recoveryCase.terminalReason = `Escalation rejected / stopped by human operator (${operatorId}).`;

    await recordAuditLog({
      recoveryCaseId: caseId,
      transactionId: txnId,
      actor: AUDIT_ACTORS.HUMAN,
      event: 'HUMAN_APPROVAL_REJECTED',
      actionTaken: RECOVERY_ACTIONS.STOP_RECOVERY,
      reason: recoveryCase.terminalReason,
      stateBefore: CASE_STATES.ESCALATED,
      stateAfter: CASE_STATES.STOPPED,
      payload: { operatorId }
    });

    recoveryCase.updatedAt = new Date();
    await recoveryCase.save();
    return recoveryCase;
  }

  if (actionType === 'APPROVE_ESCALATION') {
    validateStateTransition(recoveryCase.state, CASE_STATES.EXECUTING, AUDIT_ACTORS.HUMAN);
    recoveryCase.state = CASE_STATES.EXECUTING;

    const actionToExecute = recoveryCase.pendingHumanAction || RECOVERY_ACTIONS.RETRY_PAYMENT;
    const attemptNumber = (recoveryCase.retryCount || 0) + 1;

    // 1. Log Human Approval Granted (Actor: HUMAN) with operatorId attribution
    await recordAuditLog({
      recoveryCaseId: caseId,
      transactionId: txnId,
      actor: AUDIT_ACTORS.HUMAN,
      event: 'HUMAN_APPROVAL_GRANTED',
      actionTaken: actionToExecute,
      reason: `Human operator '${operatorId}' authorized action '${actionToExecute}' on high-value/escalated case.`,
      stateBefore: CASE_STATES.ESCALATED,
      stateAfter: CASE_STATES.EXECUTING,
      payload: { operatorId, pendingHumanAction: actionToExecute }
    });

    // 2. Transition to OBSERVING and log ACTION_EXECUTED (Actor: SYSTEM) BEFORE simulator execution
    recoveryCase.state = CASE_STATES.OBSERVING;

    await recordAuditLog({
      recoveryCaseId: caseId,
      transactionId: txnId,
      actor: AUDIT_ACTORS.SYSTEM,
      event: 'ACTION_EXECUTED',
      actionTaken: actionToExecute,
      reason: 'Human-approved bounded recovery action dispatched',
      stateBefore: CASE_STATES.EXECUTING,
      stateAfter: CASE_STATES.OBSERVING,
      financialImpact: 0,
      payload: { attemptNumber }
    });

    const workflowStep = `HUMAN_APPROVED_ATTEMPT_${attemptNumber}`;

    const { outcome } = await executeWithIdempotency({
      recoveryCaseId: caseId,
      transactionId: txnId,
      workflowStep,
      actionType: actionToExecute,
      attemptNumber,
      executeFn: async () => {
        return simulateExecutionOutcome(
          {
            recoveryCaseId: caseId,
            failureCode: transaction.failureCode,
            initialRevenueAtRisk: recoveryCase.initialRevenueAtRisk,
            recoveryScore: recoveryCase.recoveryScore,
            eventType: transaction.eventType
          },
          actionToExecute,
          attemptNumber
        );
      }
    });

    recoveryCase.retryCount = attemptNumber;
    recoveryCase.lastActionAt = new Date();

    if (outcome.result === 'SUCCESS') {
      validateStateTransition(recoveryCase.state, CASE_STATES.RECOVERED);
      recoveryCase.state = CASE_STATES.RECOVERED;
      recoveryCase.recoveredAmount = outcome.recoveredAmount;
      recoveryCase.terminalReason = outcome.reason;

      await recordAuditLog({
        recoveryCaseId: caseId,
        transactionId: txnId,
        actor: AUDIT_ACTORS.SIMULATOR,
        event: 'REVENUE_RECOVERED',
        actionTaken: actionToExecute,
        reason: outcome.reason,
        stateBefore: CASE_STATES.OBSERVING,
        stateAfter: CASE_STATES.RECOVERED,
        financialImpact: outcome.recoveredAmount
      });
    } else {
      validateStateTransition(recoveryCase.state, CASE_STATES.STOPPED);
      recoveryCase.state = CASE_STATES.STOPPED;
      recoveryCase.terminalReason = outcome.reason;

      await recordAuditLog({
        recoveryCaseId: caseId,
        transactionId: txnId,
        actor: AUDIT_ACTORS.SIMULATOR,
        event: 'ATTEMPT_FAILED',
        actionTaken: actionToExecute,
        reason: outcome.reason,
        stateBefore: CASE_STATES.OBSERVING,
        stateAfter: CASE_STATES.STOPPED
      });
    }

    recoveryCase.updatedAt = new Date();
    await recoveryCase.save();
    return recoveryCase;
  }

  const error = new Error(`Unsupported human action '${actionType}'. Allowed: APPROVE_ESCALATION, REJECT_ESCALATION, FORCE_STOP`);
  error.statusCode = 400;
  throw error;
}
