import { FAILURE_CODE_TO_DIAGNOSIS_CATEGORY, RECOVERY_ACTIONS } from '../../config/constants.js';

export function getFallbackDiagnosis(transaction, customer) {
  const failureCode = transaction.failureCode;
  const normCategory = FAILURE_CODE_TO_DIAGNOSIS_CATEGORY[failureCode] || 'UNKNOWN';

  if (normCategory === 'TEMPORARY_PAYMENT_FAILURE') {
    return {
      diagnosisCategory: 'TEMPORARY_PAYMENT_FAILURE',
      rootCauseAnalysis: 'Transient payment failure consistent with a gateway or network timeout.',
      recommendedAction: RECOVERY_ACTIONS.RETRY_PAYMENT,
      waitMinutes: 30,
      confidence: 0.92,
      reasoning: 'Trusted customer pattern with high-yield recoverable network drop; automated retry has strong probability of capture.',
      customerMessage: {
        channel: 'EMAIL',
        headline: 'Payment pending resolution',
        body: 'Your payment encountered a brief bank network delay. Recovery options are being evaluated under active policy guardrails.',
        cta: 'View Status'
      },
      fallbackUsed: true
    };
  }

  if (normCategory === 'CHECKOUT_ABANDONMENT') {
    return {
      diagnosisCategory: 'CHECKOUT_ABANDONMENT',
      rootCauseAnalysis: 'Customer exited during checkout flow with saved cart items prior to completing payment.',
      recommendedAction: RECOVERY_ACTIONS.SEND_CHECKOUT_REMINDER,
      waitMinutes: 45,
      confidence: 0.84,
      reasoning: 'High purchase intent with cart contents preserved; proactive reminder via preferred channel recommended.',
      customerMessage: {
        channel: 'WHATSAPP',
        headline: 'Items waiting in your cart',
        body: 'You left items in your shopping bag. Complete your purchase now before reservation expires.',
        cta: 'Return to Cart'
      },
      fallbackUsed: true
    };
  }

  if (normCategory === 'RECEIVABLE_OVERDUE') {
    return {
      diagnosisCategory: 'RECEIVABLE_OVERDUE',
      rootCauseAnalysis: 'B2B commercial invoice is past due payment terms with outstanding receivables balance.',
      recommendedAction: RECOVERY_ACTIONS.SEND_INVOICE_REMINDER,
      waitMinutes: 120,
      confidence: 0.88,
      reasoning: 'Commercial B2B account with outstanding invoice; structured multi-channel invoice reminder with Razorpay payment link recommended.',
      customerMessage: {
        channel: 'EMAIL',
        headline: 'Commercial Invoice Payment Reminder',
        body: 'Your business invoice is currently overdue. Please review statement details and settle via secure digital invoice link.',
        cta: 'Pay Invoice'
      },
      fallbackUsed: true
    };
  }

  if (normCategory === 'INSUFFICIENT_FUNDS') {
    return {
      diagnosisCategory: 'INSUFFICIENT_FUNDS',
      rootCauseAnalysis: 'Issuing bank returned soft decline due to insufficient account balance or card limit.',
      recommendedAction: RECOVERY_ACTIONS.SUGGEST_ALTERNATE_PAYMENT,
      waitMinutes: 60,
      confidence: 0.78,
      reasoning: 'Direct card retry is likely to decline again; suggesting alternate UPI or Netbanking link optimizes capture.',
      customerMessage: {
        channel: 'SMS',
        headline: 'Try a different payment method',
        body: 'Your card payment could not be processed. Use UPI or Netbanking to complete your order seamlessly.',
        cta: 'Pay with UPI'
      },
      fallbackUsed: true
    };
  }

  if (normCategory === 'FRAUD_RISK' || normCategory === 'HARD_DECLINE' || normCategory === 'ACCOUNT_CLOSED') {
    return {
      diagnosisCategory: normCategory,
      rootCauseAnalysis: 'Issuer rejected transaction due to hard security stop, stolen card alert, or closed account.',
      recommendedAction: RECOVERY_ACTIONS.STOP_RECOVERY,
      waitMinutes: 0,
      confidence: 0.99,
      reasoning: 'Permanent issuer/security block. Automated recovery is prohibited by the configured recovery policy.',
      customerMessage: {
        channel: 'NONE',
        headline: '',
        body: '',
        cta: ''
      },
      fallbackUsed: true
    };
  }

  return {
    diagnosisCategory: 'AUTHENTICATION_FAILURE',
    rootCauseAnalysis: '3DS authentication session timed out or was cancelled by user during OTP verification.',
    recommendedAction: RECOVERY_ACTIONS.SEND_PAYMENT_REMINDER,
    waitMinutes: 15,
    confidence: 0.72,
    reasoning: 'Authentication friction; user reminder with fresh verification session recommended.',
    customerMessage: {
      channel: 'SMS',
      headline: 'Complete your verification',
      body: 'Your payment verification was not finished. Click the secure link to complete authentication.',
      cta: 'Verify Payment'
    },
    fallbackUsed: true
  };
}

