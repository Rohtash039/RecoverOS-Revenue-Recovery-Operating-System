import crypto from 'crypto';
import { HARD_PROHIBITED_CODES, RECOVERY_ACTIONS } from '../../config/constants.js';
import { ENV } from '../../config/env.js';

export function simulateExecutionOutcome(recoveryCase, actionType, attemptNumber = 1) {
  const recoveryCaseId = recoveryCase.recoveryCaseId;
  const failureCode = recoveryCase.failureCode || recoveryCase.transaction?.failureCode;
  const initialRevenueAtRisk = recoveryCase.initialRevenueAtRisk || recoveryCase.transaction?.amount || 0;
  const recoveryScore = recoveryCase.recoveryScore ?? 50;
  const eventType = recoveryCase.eventType || recoveryCase.transaction?.eventType || 'FAILED_PAYMENT';

  if (HARD_PROHIBITED_CODES.includes(failureCode)) {
    return {
      result: 'FAILED',
      recoveredAmount: 0,
      reason: `Card network confirmed permanent issuer stop for code ${failureCode}.`
    };
  }

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

  const globalSeed = ENV.SIMULATION_SEED || 'RECOVEROS_BUILDATHON_2026';
  const hashString = `${globalSeed}:${recoveryCaseId}:${actionType}:${attemptNumber}:v3`;
  const hash = crypto.createHash('md5').update(hashString).digest('hex');
  const seedValue = parseInt(hash.substring(0, 4), 16) % 100;

  let actionMultiplier = 1.0;

  if (eventType === 'INVOICE_OVERDUE') {
    if (actionType === RECOVERY_ACTIONS.SEND_INVOICE_REMINDER) {
      actionMultiplier = failureCode === 'INVOICE_OVERDUE_30D' ? 0.95 : (failureCode === 'INVOICE_OVERDUE_60D' ? 0.80 : 0.60);
    } else {
      actionMultiplier = 0.65;
    }
  } else if (eventType === 'CHECKOUT_ABANDONED') {
    if (actionType === RECOVERY_ACTIONS.SEND_CHECKOUT_REMINDER) {
      actionMultiplier = 0.85;
    } else {
      actionMultiplier = 0.60;
    }
  } else {

    if (actionType === RECOVERY_ACTIONS.RETRY_PAYMENT) {
      actionMultiplier = failureCode === 'BANK_TIMEOUT' ? 1.05 : 0.70;
    } else if (actionType === RECOVERY_ACTIONS.SUGGEST_ALTERNATE_PAYMENT) {
      actionMultiplier = failureCode === 'INSUFFICIENT_FUNDS' ? 0.95 : 0.75;
    } else if (actionType === RECOVERY_ACTIONS.SEND_PAYMENT_REMINDER) {
      actionMultiplier = failureCode === 'AUTHENTICATION_FAILED' ? 0.85 : 0.70;
    }
  }

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

