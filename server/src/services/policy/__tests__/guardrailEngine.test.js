import { describe, it, expect } from 'vitest';
import { evaluatePolicy } from '../guardrailEngine.js';
import { RECOVERY_ACTIONS, SIMULATION_REFERENCE_TIME, POLICY_CONFIG } from '../../../config/constants.js';

describe('Policy & Guardrail Engine (evaluatePolicy)', () => {
  const refTime = new Date(SIMULATION_REFERENCE_TIME);

  it('Precedence 1: should reject case when recovery SLA window (> 48h) has elapsed', () => {
    const expiredCase = {
      failureCode: 'BANK_TIMEOUT',
      initialRevenueAtRisk: 5000,
      createdAt: new Date(refTime.getTime() - 1000 * 60 * 60 * 49),
      retryCount: 0,
      contactCount: 0
    };

    const res = evaluatePolicy(expiredCase, RECOVERY_ACTIONS.RETRY_PAYMENT, refTime);
    expect(res.decision).toBe('REJECT');
    expect(res.finalAction).toBe(RECOVERY_ACTIONS.STOP_RECOVERY);
    expect(res.reasons[0]).toContain('SLA window');
  });

  it('Precedence 2: should reject hard-prohibited failure codes unconditionally', () => {
    const fraudCase = {
      failureCode: 'FRAUD_SUSPECTED',
      initialRevenueAtRisk: 2500,
      createdAt: new Date(refTime.getTime() - 1000 * 60 * 60 * 2),
      retryCount: 0,
      contactCount: 0
    };

    const res = evaluatePolicy(fraudCase, RECOVERY_ACTIONS.RETRY_PAYMENT, refTime);
    expect(res.decision).toBe('REJECT');
    expect(res.finalAction).toBe(RECOVERY_ACTIONS.STOP_RECOVERY);
    expect(res.reasons[0]).toContain('hard prohibited');
  });

  it('Precedence 3: should modify action to SUGGEST_ALTERNATE_PAYMENT when retry limit reached', () => {
    const retryExhaustedCase = {
      failureCode: 'INSUFFICIENT_FUNDS',
      initialRevenueAtRisk: 4000,
      createdAt: new Date(refTime.getTime() - 1000 * 60 * 60 * 4),
      retryCount: 2,
      contactCount: 0
    };

    const res = evaluatePolicy(retryExhaustedCase, RECOVERY_ACTIONS.RETRY_PAYMENT, refTime);
    expect(res.decision).toBe('MODIFY');
    expect(res.finalAction).toBe(RECOVERY_ACTIONS.SUGGEST_ALTERNATE_PAYMENT);
    expect(res.reasons[0]).toContain('retry ceiling');
  });

  it('Precedence 4: should reject reminder when customer contact ceiling is reached', () => {
    const contactCeilingCase = {
      failureCode: 'AUTHENTICATION_FAILED',
      initialRevenueAtRisk: 3000,
      createdAt: new Date(refTime.getTime() - 1000 * 60 * 60 * 3),
      retryCount: 0,
      contactCount: 2
    };

    const res = evaluatePolicy(contactCeilingCase, RECOVERY_ACTIONS.SEND_PAYMENT_REMINDER, refTime);
    expect(res.decision).toBe('REJECT');
    expect(res.finalAction).toBe(RECOVERY_ACTIONS.STOP_RECOVERY);
    expect(res.reasons[0]).toContain('customer contact ceiling');
  });

  it('Precedence 5: should escalate high-value tickets (>= ₹50,000) to human review', () => {
    const highValueCase = {
      failureCode: 'BANK_TIMEOUT',
      initialRevenueAtRisk: 75000,
      createdAt: new Date(refTime.getTime() - 1000 * 60 * 60 * 2),
      retryCount: 0,
      contactCount: 0
    };

    const res = evaluatePolicy(highValueCase, RECOVERY_ACTIONS.RETRY_PAYMENT, refTime);
    expect(res.decision).toBe('MODIFY');
    expect(res.finalAction).toBe(RECOVERY_ACTIONS.ESCALATE_TO_HUMAN);
    expect(res.reasons[0]).toContain('high-value threshold');
  });

  it('Precedence 6: should escalate to human review when AI diagnostic confidence is low (< 0.65)', () => {
    const lowConfidenceCase = {
      failureCode: 'BANK_TIMEOUT',
      initialRevenueAtRisk: 8000,
      createdAt: new Date(refTime.getTime() - 1000 * 60 * 60 * 2),
      retryCount: 0,
      contactCount: 0,
      aiDiagnosis: { confidence: 0.52 }
    };

    const res = evaluatePolicy(lowConfidenceCase, RECOVERY_ACTIONS.RETRY_PAYMENT, refTime);
    expect(res.decision).toBe('MODIFY');
    expect(res.finalAction).toBe(RECOVERY_ACTIONS.ESCALATE_TO_HUMAN);
    expect(res.reasons[0]).toContain('diagnostic confidence');
  });

  it('Precedence 7: should approve compliant action within all operational bounds', () => {
    const compliantCase = {
      failureCode: 'BANK_TIMEOUT',
      initialRevenueAtRisk: 6500,
      createdAt: new Date(refTime.getTime() - 1000 * 60 * 60 * 2),
      retryCount: 0,
      contactCount: 0,
      aiDiagnosis: { confidence: 0.92 }
    };

    const res = evaluatePolicy(compliantCase, RECOVERY_ACTIONS.RETRY_PAYMENT, refTime);
    expect(res.decision).toBe('APPROVE');
    expect(res.finalAction).toBe(RECOVERY_ACTIONS.RETRY_PAYMENT);
  });

  it('Strict Precedence Invariant: Hard prohibited + High Value MUST resolve to STOP (not ESCALATE)', () => {
    const conflictCase = {
      failureCode: 'CARD_STOLEN',
      initialRevenueAtRisk: 150000,
      createdAt: new Date(refTime.getTime() - 1000 * 60 * 60 * 2),
      retryCount: 0,
      contactCount: 0
    };

    const res = evaluatePolicy(conflictCase, RECOVERY_ACTIONS.RETRY_PAYMENT, refTime);
    expect(res.decision).toBe('REJECT');
    expect(res.finalAction).toBe(RECOVERY_ACTIONS.STOP_RECOVERY);
    expect(res.finalAction).not.toBe(RECOVERY_ACTIONS.ESCALATE_TO_HUMAN);
  });
});

