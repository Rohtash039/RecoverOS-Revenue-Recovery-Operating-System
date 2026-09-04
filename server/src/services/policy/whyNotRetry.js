import { HARD_PROHIBITED_CODES, POLICY_CONFIG } from '../../config/constants.js';

/**
 * Generates structured, deterministic explanation for why a case was NOT retried or was stopped.
 */
export function explainWhyNotRetry(recoveryCase) {
  const failureCode = recoveryCase.failureCode || recoveryCase.transaction?.failureCode;
  const retryCount = recoveryCase.retryCount || 0;
  const score = recoveryCase.recoveryScore || 0;
  const state = recoveryCase.state;

  const reasons = [];
  let canRetry = true;

  if (HARD_PROHIBITED_CODES.includes(failureCode)) {
    canRetry = false;
    reasons.push(`Failure code '${failureCode}' is classified as permanent issuer decline / fraud risk.`);
    reasons.push('Automated recovery is prohibited by the configured recovery policy.');
    reasons.push('Historical recovery probability for this failure category is 0%.');
  }

  if (retryCount >= POLICY_CONFIG.MAX_PAYMENT_RETRIES) {
    canRetry = false;
    reasons.push(`Maximum automated retry limit (${POLICY_CONFIG.MAX_PAYMENT_RETRIES}) has been fully exhausted.`);
    reasons.push('Further card retries would result in issuing bank velocity blocks.');
  }

  if (state === 'STOPPED') {
    canRetry = false;
    if (recoveryCase.terminalReason) {
      reasons.push(`Workflow reached terminal stop: ${recoveryCase.terminalReason}`);
    }
  }

  if (score < 30 && reasons.length === 0) {
    reasons.push(`Recovery Opportunity Score (${score}/100) is low due to customer history and attempt fatigue.`);
    reasons.push('Automated recovery ROI does not justify further friction.');
  }

  if (reasons.length === 0) {
    reasons.push('Case is eligible for intervention under active policy guardrails.');
  }

  return {
    canRetry,
    failureCode,
    retryCount,
    maxRetries: POLICY_CONFIG.MAX_PAYMENT_RETRIES,
    recoveryScore: score,
    reasons
  };
}
