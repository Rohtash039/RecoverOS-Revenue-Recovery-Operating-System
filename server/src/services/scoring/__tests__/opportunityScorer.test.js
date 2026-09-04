import { describe, it, expect } from 'vitest';
import { calculateROS } from '../opportunityScorer.js';
import { HARD_PROHIBITED_CODES, SIMULATION_REFERENCE_TIME } from '../../../config/constants.js';

describe('Opportunity Scorer (calculateROS)', () => {
  const refTime = new Date(SIMULATION_REFERENCE_TIME);

  it('should force ROS to strictly 0 for hard-prohibited failure codes', () => {
    HARD_PROHIBITED_CODES.forEach((code) => {
      const txn = {
        failureCode: code,
        amount: 5000,
        attempts: 0,
        createdAt: new Date(refTime.getTime() - 1000 * 60 * 30)
      };
      const customer = { previousSuccessfulPayments: 10, previousFailedPayments: 0 };

      const { recoveryScore, scoreFactors } = calculateROS(txn, customer, refTime);
      expect(recoveryScore).toBe(0);
      expect(scoreFactors.failureRecoverability).toBe(0);
    });
  });

  it('should calculate high ROS for optimal high-reliability bank timeout scenario', () => {
    const txn = {
      failureCode: 'BANK_TIMEOUT',
      amount: 5000,
      attempts: 0,
      createdAt: new Date(refTime.getTime() - 1000 * 60 * 30)
    };
    const customer = { previousSuccessfulPayments: 8, previousFailedPayments: 0 };

    const { recoveryScore, scoreFactors } = calculateROS(txn, customer, refTime);

    expect(recoveryScore).toBe(97);
    expect(scoreFactors.failureRecoverability).toBe(95);
    expect(scoreFactors.customerReliability).toBe(100);
    expect(scoreFactors.attemptFatigue).toBe(100);
    expect(scoreFactors.amountTier).toBe(90);
    expect(scoreFactors.recency).toBe(100);
  });

  it('should calculate amount boundaries correctly (₹999 vs ₹1000 vs ₹50,000)', () => {
    const baseTxn = {
      failureCode: 'INSUFFICIENT_FUNDS',
      attempts: 0,
      createdAt: new Date(refTime.getTime() - 1000 * 60 * 30)
    };
    const customer = { previousSuccessfulPayments: 1 };

    const score999 = calculateROS({ ...baseTxn, amount: 999 }, customer, refTime);
    const score1000 = calculateROS({ ...baseTxn, amount: 1000 }, customer, refTime);
    const score50000 = calculateROS({ ...baseTxn, amount: 50000 }, customer, refTime);

    expect(score999.scoreFactors.amountTier).toBe(70);
    expect(score1000.scoreFactors.amountTier).toBe(90);
    expect(score50000.scoreFactors.amountTier).toBe(30);
    expect(score1000.recoveryScore).toBeGreaterThan(score999.recoveryScore);
  });

  it('should decay score properly across recency thresholds', () => {
    const baseTxn = {
      failureCode: 'CART_ABANDONED',
      amount: 2500,
      attempts: 0
    };
    const customer = { previousSuccessfulPayments: 3 };

    const within1h = calculateROS({ ...baseTxn, createdAt: new Date(refTime.getTime() - 1000 * 60 * 30) }, customer, refTime);
    const within6h = calculateROS({ ...baseTxn, createdAt: new Date(refTime.getTime() - 1000 * 60 * 60 * 4) }, customer, refTime);
    const within24h = calculateROS({ ...baseTxn, createdAt: new Date(refTime.getTime() - 1000 * 60 * 60 * 18) }, customer, refTime);
    const after24h = calculateROS({ ...baseTxn, createdAt: new Date(refTime.getTime() - 1000 * 60 * 60 * 36) }, customer, refTime);

    expect(within1h.scoreFactors.recency).toBe(100);
    expect(within6h.scoreFactors.recency).toBe(75);
    expect(within24h.scoreFactors.recency).toBe(40);
    expect(after24h.scoreFactors.recency).toBe(15);

    expect(within1h.recoveryScore).toBeGreaterThan(within6h.recoveryScore);
    expect(within6h.recoveryScore).toBeGreaterThan(within24h.recoveryScore);
    expect(within24h.recoveryScore).toBeGreaterThan(after24h.recoveryScore);
  });

  it('should penalize high attempt fatigue', () => {
    const baseTxn = {
      failureCode: 'INSUFFICIENT_FUNDS',
      amount: 3000,
      createdAt: new Date(refTime.getTime() - 1000 * 60 * 30)
    };
    const customer = { previousSuccessfulPayments: 2 };

    const attempt0 = calculateROS({ ...baseTxn, attempts: 0 }, customer, refTime);
    const attempt1 = calculateROS({ ...baseTxn, attempts: 1 }, customer, refTime);
    const attempt2 = calculateROS({ ...baseTxn, attempts: 2 }, customer, refTime);

    expect(attempt0.scoreFactors.attemptFatigue).toBe(100);
    expect(attempt1.scoreFactors.attemptFatigue).toBe(40);
    expect(attempt2.scoreFactors.attemptFatigue).toBe(0);
    expect(attempt0.recoveryScore).toBeGreaterThan(attempt1.recoveryScore);
    expect(attempt1.recoveryScore).toBeGreaterThan(attempt2.recoveryScore);
  });
});

