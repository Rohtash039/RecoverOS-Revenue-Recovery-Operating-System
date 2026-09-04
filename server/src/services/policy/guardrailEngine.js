import { 
  POLICY_CONFIG, 
  HARD_PROHIBITED_CODES, 
  RECOVERY_ACTIONS, 
  SIMULATION_REFERENCE_TIME 
} from '../../config/constants.js';

/**
 * Policy & Guardrail Engine
 * Evaluates proposed actions against deterministic business policies in strict precedence order.
 * Returns tri-state decision: APPROVE, MODIFY, or REJECT with human-readable reason strings.
 */
export function evaluatePolicy(recoveryCase, recommendedAction, referenceTime = SIMULATION_REFERENCE_TIME) {
  const failureCode = recoveryCase.failureCode || recoveryCase.transaction?.failureCode;
  const initialRevenueAtRisk = recoveryCase.initialRevenueAtRisk || recoveryCase.transaction?.amount || 0;
  const retryCount = recoveryCase.retryCount || 0;
  const contactCount = recoveryCase.contactCount || 0;
  const createdAt = recoveryCase.createdAt || recoveryCase.transaction?.createdAt || referenceTime;
  const aiDiagnosis = recoveryCase.aiDiagnosis;

  const refMs = referenceTime instanceof Date ? referenceTime.getTime() : new Date(referenceTime).getTime();
  const createdMs = new Date(createdAt).getTime();
  const elapsedHours = Math.max(0, (refMs - createdMs) / (1000 * 60 * 60));

  // 1. Precedence 1: Recovery Window Expired (> 48h for checkout/payments, > 90d for B2B commercial receivables)
  const isReceivable = recoveryCase.eventType === 'INVOICE_OVERDUE' || 
                       failureCode?.startsWith('INVOICE_OVERDUE') || 
                       recoveryCase.transaction?.eventType === 'INVOICE_OVERDUE';
  const maxWindowHours = isReceivable ? (90 * 24) : POLICY_CONFIG.MAX_RECOVERY_WINDOW_HOURS;

  if (elapsedHours > maxWindowHours) {
    return {
      decision: 'REJECT',
      originalAction: recommendedAction,
      finalAction: RECOVERY_ACTIONS.STOP_RECOVERY,
      reasons: [`Recovery SLA window of ${maxWindowHours} hours (${isReceivable ? '90 days for B2B commercial receivables' : '48 hours'}) has elapsed.`],
      evaluatedAt: new Date()
    };
  }

  // 2. Precedence 2: Hard Prohibited Failure (Fraud / Stolen Card)
  // Hard prohibited codes are NEVER overridden by subsequent rules (even if high value)
  if (HARD_PROHIBITED_CODES.includes(failureCode)) {
    return {
      decision: 'REJECT',
      originalAction: recommendedAction,
      finalAction: RECOVERY_ACTIONS.STOP_RECOVERY,
      reasons: [`Failure code ${failureCode} is classified as hard prohibited. Automated recovery blocked.`],
      evaluatedAt: new Date()
    };
  }

  // 3. Precedence 3: Retry Limit Breached (>= 2)
  if (recommendedAction === RECOVERY_ACTIONS.RETRY_PAYMENT && retryCount >= POLICY_CONFIG.MAX_PAYMENT_RETRIES) {
    return {
      decision: 'MODIFY',
      originalAction: recommendedAction,
      finalAction: RECOVERY_ACTIONS.SUGGEST_ALTERNATE_PAYMENT,
      reasons: [`Maximum automated payment retry ceiling (${POLICY_CONFIG.MAX_PAYMENT_RETRIES}) reached. Switched to alternate payment link.`],
      evaluatedAt: new Date()
    };
  }

  // 4. Precedence 4: Contact Limit Breached (>= 2)
  if (
    [RECOVERY_ACTIONS.SEND_PAYMENT_REMINDER, RECOVERY_ACTIONS.SEND_CHECKOUT_REMINDER, RECOVERY_ACTIONS.SEND_INVOICE_REMINDER].includes(recommendedAction) &&
    contactCount >= POLICY_CONFIG.MAX_CUSTOMER_CONTACTS
  ) {
    return {
      decision: 'REJECT',
      originalAction: recommendedAction,
      finalAction: RECOVERY_ACTIONS.STOP_RECOVERY,
      reasons: [`Maximum customer contact ceiling (${POLICY_CONFIG.MAX_CUSTOMER_CONTACTS}) reached to prevent customer dunning fatigue.`],
      evaluatedAt: new Date()
    };
  }

  // 5. Precedence 5: High-Value Escalation (>= ₹50,000)
  if (initialRevenueAtRisk >= POLICY_CONFIG.HIGH_VALUE_THRESHOLD) {
    return {
      decision: 'MODIFY',
      originalAction: recommendedAction,
      finalAction: RECOVERY_ACTIONS.ESCALATE_TO_HUMAN,
      reasons: [`Transaction value ₹${initialRevenueAtRisk.toLocaleString('en-IN')} meets or exceeds high-value threshold (₹${POLICY_CONFIG.HIGH_VALUE_THRESHOLD.toLocaleString('en-IN')}). Human approval required.`],
      evaluatedAt: new Date()
    };
  }

  // 6. Precedence 6: Low Diagnostic Confidence (< 0.65)
  if (aiDiagnosis?.confidence && aiDiagnosis.confidence < POLICY_CONFIG.CONFIDENCE_THRESHOLD) {
    return {
      decision: 'MODIFY',
      originalAction: recommendedAction,
      finalAction: RECOVERY_ACTIONS.ESCALATE_TO_HUMAN,
      reasons: [`AI diagnostic confidence (${(aiDiagnosis.confidence * 100).toFixed(1)}%) is below operational threshold (${(POLICY_CONFIG.CONFIDENCE_THRESHOLD * 100).toFixed(0)}%). Human review required.`],
      evaluatedAt: new Date()
    };
  }

  // 7. Precedence 7: Default Approval
  return {
    decision: 'APPROVE',
    originalAction: recommendedAction,
    finalAction: recommendedAction,
    reasons: ['All compliance guardrails and policy constraints successfully validated.'],
    evaluatedAt: new Date()
  };
}
