import { SIMULATION_REFERENCE_TIME, HARD_PROHIBITED_CODES } from '../../config/constants.js';

export function calculateROS(transaction, customer, referenceTime = SIMULATION_REFERENCE_TIME) {
  const isHardProhibited = HARD_PROHIBITED_CODES.includes(transaction.failureCode);

  const failureMap = {
    BANK_TIMEOUT: 95,
    CART_ABANDONED: 80,
    AUTHENTICATION_FAILED: 75,
    INSUFFICIENT_FUNDS: 50,
    INVOICE_OVERDUE_30D: 85,
    INVOICE_OVERDUE_60D: 65,
    INVOICE_OVERDUE_90D: 40,
    FRAUD_SUSPECTED: 0,
    CARD_STOLEN: 0,
    CARD_LOST: 0,
    ACCOUNT_CLOSED: 0,
    DO_NOT_HONOR_PERMANENT: 0
  };
  const failureRecoverability = failureMap[transaction.failureCode] ?? 20;

  let customerReliability = 40;
  const successCount = customer?.previousSuccessfulPayments || 0;
  const failCount = customer?.previousFailedPayments || 0;

  if (successCount >= 5) {
    customerReliability = 100;
  } else if (successCount >= 2) {
    customerReliability = 75;
  } else if (successCount === 1) {
    customerReliability = 50;
  } else if (failCount >= 3 && successCount === 0) {
    customerReliability = 10;
  }

  const attempts = transaction.attempts || 0;
  let attemptFatigue = 0;
  if (attempts === 0) attemptFatigue = 100;
  else if (attempts === 1) attemptFatigue = 40;
  else attemptFatigue = 0;

  let amountTier = 50;
  const amt = transaction.amount || 0;
  if (amt >= 1000 && amt <= 15000) {
    amountTier = 90;
  } else if (amt >= 500 && amt < 1000) {
    amountTier = 70;
  } else if (amt > 15000 && amt < 50000) {
    amountTier = 60;
  } else if (amt >= 50000) {
    amountTier = 30;
  } else {
    amountTier = 50;
  }

  const refMs = referenceTime instanceof Date ? referenceTime.getTime() : new Date(referenceTime).getTime();
  const txMs = new Date(transaction.createdAt).getTime();
  const elapsedHours = Math.max(0, (refMs - txMs) / (1000 * 60 * 60));

  let recency = 15;
  const isReceivable = transaction.eventType === 'INVOICE_OVERDUE' || transaction.failureCode?.startsWith('INVOICE_OVERDUE');

  if (isReceivable) {

    const elapsedDays = elapsedHours / 24;
    if (elapsedDays <= 15) recency = 100;
    else if (elapsedDays <= 30) recency = 80;
    else if (elapsedDays <= 60) recency = 55;
    else recency = 30;
  } else {
    if (elapsedHours <= 1) recency = 100;
    else if (elapsedHours <= 6) recency = 75;
    else if (elapsedHours <= 24) recency = 40;
    else recency = 15;
  }

  const rawScore = (
    0.30 * failureRecoverability +
    0.25 * customerReliability +
    0.15 * attemptFatigue +
    0.15 * amountTier +
    0.15 * recency
  );

  const recoveryScore = isHardProhibited
    ? 0
    : Math.min(100, Math.max(0, Math.round(rawScore)));

  return {
    recoveryScore,
    scoreFactors: {
      failureRecoverability: isHardProhibited ? 0 : failureRecoverability,
      customerReliability,
      attemptFatigue,
      amountTier,
      recency
    }
  };
}

