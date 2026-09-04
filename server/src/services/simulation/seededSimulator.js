import crypto from 'crypto';
import { HARD_PROHIBITED_CODES, RECOVERY_ACTIONS } from '../../config/constants.js';
import { ENV } from '../../config/env.js';

/**
 * Seeded Deterministic Simulator
 * Reproducibly resolves recovery execution attempts without moving real money or calling live gateways.
 * Formula incorporates caseId, actionType, attemptNumber, and global seed.
 */
export function simulateExecutionOutcome(recoveryCase, actionType, attemptNumber = 1) {
  const recoveryCaseId = recoveryCase.recoveryCaseId;
  const failureCode = recoveryCase.failureCode || recoveryCase.transaction?.failureCode;
  const initialRevenueAtRisk = recoveryCase.initialRevenueAtRisk || recoveryCase.transaction?.amount || 0;
  const recoveryScore = recoveryCase.recoveryScore ?? 50;
  const eventType = recoveryCase.eventType || recoveryCase.transaction?.eventType || 'FAILED_PAYMENT';

  // 1. Prohibited error codes ALWAYS produce failure on automated recovery attempts
  if (HARD_PROHIBITED_CODES.includes(failureCode)) {
    return {
      result: 'FAILED',
      recoveredAmount: 0,
      reason: `Card network confirmed permanent issuer stop for code ${failureCode}.`
    };
  }

  // 2. Terminal or Escalation Action Handling
  if (actionType === RECOVERY_ACTIONS.STOP_RECOVERY) {
    return {
      result: 'STOPPED',
      recoveredAmount: 0,
      reason: 'Recovery terminated by policy rule or operator.'
    };
  }

  if (actionType === RECOVERY_ACTIONS.ESCALATE_TO_HUMAN) {
    return {
      result: 'ESCALATED',
      recoveredAmount: 0,
      reason: 'Held in human authorization queue for operator action.'
    };
  }

  // 3. Composite deterministic hash integer [0, 99]
  const globalSeed = ENV.SIMULATION_SEED || 'RECOVEROS_BUILDATHON_2026';
  const hashString = `${globalSeed}:${recoveryCaseId}:${actionType}:${attemptNumber}:v3`;
  const hash = crypto.createHash('md5').update(hashString).digest('hex');
  const seedValue = parseInt(hash.substring(0, 4), 16) % 100; // Deterministic value 0 to 99

  // 4. Action & Failure Code Multipliers
  let actionMultiplier = 1.0;

  if (eventType === 'CHECKOUT_ABANDONED') {
    if (actionType === RECOVERY_ACTIONS.SEND_CHECKOUT_REMINDER) {
      actionMultiplier = 0.85;
    } else {
      actionMultiplier = 0.60;
    }
  } else {
    // FAILED_PAYMENT
    if (actionType === RECOVERY_ACTIONS.RETRY_PAYMENT) {
      actionMultiplier = failureCode === 'BANK_TIMEOUT' ? 1.05 : 0.70;
    } else if (actionType === RECOVERY_ACTIONS.SUGGEST_ALTERNATE_PAYMENT) {
      actionMultiplier = failureCode === 'INSUFFICIENT_FUNDS' ? 0.95 : 0.75;
    } else if (actionType === RECOVERY_ACTIONS.SEND_PAYMENT_REMINDER) {
      actionMultiplier = failureCode === 'AUTHENTICATION_FAILED' ? 0.85 : 0.70;
    }
  }

  // Attempt penalty: Attempt 1 is 1.0x, Attempt 2 is 0.70x
  const attemptPenalty = attemptNumber === 1 ? 1.0 : 0.70;
  const effectiveCutoff = Math.min(95, recoveryScore * actionMultiplier * attemptPenalty);

  if (seedValue < effectiveCutoff) {
    return {
      result: 'SUCCESS',
      recoveredAmount: initialRevenueAtRisk,
      reason: `Simulated capture succeeded via ${actionType} on attempt ${attemptNumber}.`
    };
  } else {
    return {
      result: 'FAILED',
      recoveredAmount: 0,
      reason: `Attempt ${attemptNumber} declined by secondary rail or customer did not complete action.`
    };
  }
}
