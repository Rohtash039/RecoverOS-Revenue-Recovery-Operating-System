import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeWithIdempotency } from '../idempotency.js';
import { RecoveryAction } from '../../../models/RecoveryAction.js';
import * as auditService from '../../audit/auditService.js';

describe('Idempotency Service (executeWithIdempotency)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should call executeFn on first attempt and persist new RecoveryAction', async () => {
    vi.spyOn(RecoveryAction, 'findOne').mockResolvedValue(null);
    vi.spyOn(RecoveryAction.prototype, 'save').mockResolvedValue({});
    vi.spyOn(auditService, 'recordAuditLog').mockResolvedValue({});

    const executeSpy = vi.fn().mockResolvedValue({
      result: 'SUCCESS',
      recoveredAmount: 4500,
      reason: 'Captured on first attempt'
    });

    const result = await executeWithIdempotency({
      recoveryCaseId: 'RC-1001',
      transactionId: 'TXN-8001',
      workflowStep: 'ATTEMPT_1',
      actionType: 'RETRY_PAYMENT',
      attemptNumber: 1,
      executeFn: executeSpy
    });

    expect(executeSpy).toHaveBeenCalledTimes(1);
    expect(result.idempotent).toBe(false);
    expect(result.outcome.result).toBe('SUCCESS');
    expect(result.outcome.recoveredAmount).toBe(4500);
  });

  it('should NOT call executeFn on duplicate attempt and return cached outcome with idempotent: true', async () => {
    const existingAction = {
      idempotencyKey: 'RC-1001:ATTEMPT_1:1:RETRY_PAYMENT',
      recoveryCaseId: 'RC-1001',
      workflowStep: 'ATTEMPT_1',
      actionType: 'RETRY_PAYMENT',
      attemptNumber: 1,
      result: 'SUCCESS',
      recoveredAmount: 4500,
      reason: 'Previously executed capture'
    };

    vi.spyOn(RecoveryAction, 'findOne').mockResolvedValue(existingAction);
    const auditSpy = vi.spyOn(auditService, 'recordAuditLog').mockResolvedValue({});

    const executeSpy = vi.fn();

    const result = await executeWithIdempotency({
      recoveryCaseId: 'RC-1001',
      transactionId: 'TXN-8001',
      workflowStep: 'ATTEMPT_1',
      actionType: 'RETRY_PAYMENT',
      attemptNumber: 1,
      executeFn: executeSpy
    });

    // Key assertions: executeFn MUST NEVER be invoked for a duplicate request
    expect(executeSpy).not.toHaveBeenCalled();
    expect(result.idempotent).toBe(true);
    expect(result.outcome.result).toBe('SUCCESS');
    expect(result.outcome.recoveredAmount).toBe(4500);
    expect(auditSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'DUPLICATE_ACTION_BLOCKED',
        recoveryCaseId: 'RC-1001'
      })
    );
  });
});
