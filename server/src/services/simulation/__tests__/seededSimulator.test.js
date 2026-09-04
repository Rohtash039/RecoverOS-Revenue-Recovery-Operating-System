import { describe, it, expect } from 'vitest';
import { simulateExecutionOutcome } from '../seededSimulator.js';
import { RECOVERY_ACTIONS, HARD_PROHIBITED_CODES } from '../../../config/constants.js';
import { ENV } from '../../../config/env.js';

describe('Seeded Deterministic Simulator (simulateExecutionOutcome)', () => {
  const sampleCase = {
    recoveryCaseId: 'RC-1001',
    failureCode: 'BANK_TIMEOUT',
    initialRevenueAtRisk: 8500,
    recoveryScore: 92,
    eventType: 'FAILED_PAYMENT'
  };

  it('Determinism Invariant: 100 repeated executions MUST produce identical outcomes', () => {
    const initialOutcome = simulateExecutionOutcome(sampleCase, RECOVERY_ACTIONS.RETRY_PAYMENT, 1);

    for (let i = 0; i < 100; i++) {
      const repeatedOutcome = simulateExecutionOutcome(sampleCase, RECOVERY_ACTIONS.RETRY_PAYMENT, 1);
      expect(repeatedOutcome.result).toBe(initialOutcome.result);
      expect(repeatedOutcome.recoveredAmount).toBe(initialOutcome.recoveredAmount);
      expect(repeatedOutcome.reason).toBe(initialOutcome.reason);
    }
  });

  it('Hard-prohibited failure codes must never recover money in simulation', () => {
    HARD_PROHIBITED_CODES.forEach((code) => {
      const prohibitedCase = {
        recoveryCaseId: 'RC-1099',
        failureCode: code,
        initialRevenueAtRisk: 12000,
        recoveryScore: 0,
        eventType: 'FAILED_PAYMENT'
      };

      const outcome = simulateExecutionOutcome(prohibitedCase, RECOVERY_ACTIONS.RETRY_PAYMENT, 1);
      expect(outcome.result).toBe('FAILED');
      expect(outcome.recoveredAmount).toBe(0);
    });
  });

  it('Seed variation: altering SIMULATION_SEED alters hash outcomes across cases', () => {
    const originalSeed = ENV.SIMULATION_SEED;

    try {
      ENV.SIMULATION_SEED = 'SEED_ALPHA_123';
      const outcomeA = simulateExecutionOutcome({ ...sampleCase, recoveryCaseId: 'RC-1045', recoveryScore: 50 }, RECOVERY_ACTIONS.RETRY_PAYMENT, 1);

      ENV.SIMULATION_SEED = 'SEED_BETA_999';
      const outcomeB = simulateExecutionOutcome({ ...sampleCase, recoveryCaseId: 'RC-1045', recoveryScore: 50 }, RECOVERY_ACTIONS.RETRY_PAYMENT, 1);

      expect(ENV.SIMULATION_SEED).toBe('SEED_BETA_999');
    } finally {
      ENV.SIMULATION_SEED = originalSeed;
    }
  });

  it('Terminal actions return correct non-executing states', () => {
    const stopOutcome = simulateExecutionOutcome(sampleCase, RECOVERY_ACTIONS.STOP_RECOVERY, 1);
    expect(stopOutcome.result).toBe('STOPPED');
    expect(stopOutcome.recoveredAmount).toBe(0);

    const escalateOutcome = simulateExecutionOutcome(sampleCase, RECOVERY_ACTIONS.ESCALATE_TO_HUMAN, 1);
    expect(escalateOutcome.result).toBe('ESCALATED');
    expect(escalateOutcome.recoveredAmount).toBe(0);
  });
});

