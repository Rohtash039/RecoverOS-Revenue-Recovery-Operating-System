import { DIAGNOSIS_CATEGORIES, RECOVERY_ACTIONS } from '../../config/constants.js';

export function buildSystemPrompt() {
  return `You are RecoverOS AI Diagnostician, an expert payment operations agent for fintech revenue recovery.
Your job is to analyze failed payments and abandoned checkouts and return structured JSON diagnosis.

Allowed diagnosis categories:
${JSON.stringify(DIAGNOSIS_CATEGORIES)}

Allowed recommended actions:
${JSON.stringify(Object.values(RECOVERY_ACTIONS))}

CRITICAL RULES:
1. Return ONLY valid JSON adhering strictly to the schema. No markdown backticks, no markdown fence, no preamble.
2. If failure indicates fraud, stolen card, or closed account, you MUST recommend STOP_RECOVERY and confidence close to 1.0.
3. If failure is temporary bank timeout and customer has good history, recommend RETRY_PAYMENT.
4. If failure is insufficient funds, recommend SUGGEST_ALTERNATE_PAYMENT.
5. If failure is checkout abandonment, recommend SEND_CHECKOUT_REMINDER.
6. Provide concise, expert rootCauseAnalysis and reasoning.`;
}

export function buildUserPrompt(transaction, customer, score) {
  return JSON.stringify({
    transaction: {
      id: transaction.transactionId,
      amount: transaction.amount,
      currency: transaction.currency || 'INR',
      eventType: transaction.eventType,
      paymentMethod: transaction.paymentMethod,
      failureCode: transaction.failureCode,
      failureReason: transaction.failureReason,
      attempts: transaction.attempts,
      createdAt: transaction.createdAt
    },
    customer: {
      id: customer?.customerId,
      tier: customer?.tier,
      successfulPayments: customer?.previousSuccessfulPayments,
      failedPayments: customer?.previousFailedPayments,
      lifetimeValue: customer?.lifetimeValue
    },
    recoveryOpportunityScore: score
  });
}
