import { describe, it, expect } from 'vitest';
import { validateStateTransition } from '../stateMachine.js';
import { CASE_STATES, AUDIT_ACTORS } from '../../../config/constants.js';

describe('Workflow State Machine (validateStateTransition)', () => {
  it('should allow valid sequential transitions along the recovery lifecycle', () => {
    expect(() => validateStateTransition(CASE_STATES.AT_RISK, CASE_STATES.SCORING)).not.toThrow();
    expect(() => validateStateTransition(CASE_STATES.SCORING, CASE_STATES.ANALYZING)).not.toThrow();
    expect(() => validateStateTransition(CASE_STATES.ANALYZING, CASE_STATES.ACTION_PLANNED)).not.toThrow();
    expect(() => validateStateTransition(CASE_STATES.ACTION_PLANNED, CASE_STATES.POLICY_CHECK)).not.toThrow();
    expect(() => validateStateTransition(CASE_STATES.POLICY_CHECK, CASE_STATES.EXECUTING)).not.toThrow();
    expect(() => validateStateTransition(CASE_STATES.POLICY_CHECK, CASE_STATES.ESCALATED)).not.toThrow();
    expect(() => validateStateTransition(CASE_STATES.POLICY_CHECK, CASE_STATES.STOPPED)).not.toThrow();
    expect(() => validateStateTransition(CASE_STATES.EXECUTING, CASE_STATES.OBSERVING)).not.toThrow();
    expect(() => validateStateTransition(CASE_STATES.OBSERVING, CASE_STATES.RECOVERED)).not.toThrow();
  });

  it('should allow identical state transition (no-op)', () => {
    expect(() => validateStateTransition(CASE_STATES.AT_RISK, CASE_STATES.AT_RISK)).not.toThrow();
    expect(() => validateStateTransition(CASE_STATES.RECOVERED, CASE_STATES.RECOVERED)).not.toThrow();
  });

  it('should reject invalid illegal state transitions with 400 INVALID_STATE_TRANSITION', () => {
    expect(() => validateStateTransition(CASE_STATES.AT_RISK, CASE_STATES.EXECUTING)).toThrowError(
      /Invalid state transition from 'AT_RISK' to 'EXECUTING'/
    );
    expect(() => validateStateTransition(CASE_STATES.RECOVERED, CASE_STATES.SCORING)).toThrowError(
      /Invalid state transition from 'RECOVERED' to 'SCORING'/
    );
    expect(() => validateStateTransition(CASE_STATES.STOPPED, CASE_STATES.EXECUTING)).toThrowError(
      /Invalid state transition from 'STOPPED' to 'EXECUTING'/
    );
  });

  it('should enforce actor: HUMAN on transition from ESCALATED to EXECUTING or STOPPED', () => {

    expect(() => validateStateTransition(CASE_STATES.ESCALATED, CASE_STATES.EXECUTING, AUDIT_ACTORS.HUMAN)).not.toThrow();
    expect(() => validateStateTransition(CASE_STATES.ESCALATED, CASE_STATES.STOPPED, AUDIT_ACTORS.HUMAN)).not.toThrow();

    expect(() => validateStateTransition(CASE_STATES.ESCALATED, CASE_STATES.EXECUTING, AUDIT_ACTORS.SYSTEM)).toThrowError(
      /requires actor 'HUMAN'/
    );

    expect(() => validateStateTransition(CASE_STATES.ESCALATED, CASE_STATES.EXECUTING, AUDIT_ACTORS.AI_AGENT)).toThrowError(
      /requires actor 'HUMAN'/
    );
  });
});

