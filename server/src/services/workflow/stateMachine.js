import { CASE_STATES, AUDIT_ACTORS } from '../../config/constants.js';

const VALID_TRANSITIONS = {
  [CASE_STATES.AT_RISK]: [CASE_STATES.SCORING],
  [CASE_STATES.SCORING]: [CASE_STATES.ANALYZING],
  [CASE_STATES.ANALYZING]: [CASE_STATES.ACTION_PLANNED],
  [CASE_STATES.ACTION_PLANNED]: [CASE_STATES.POLICY_CHECK],
  [CASE_STATES.POLICY_CHECK]: [CASE_STATES.EXECUTING, CASE_STATES.ESCALATED, CASE_STATES.STOPPED],
  [CASE_STATES.ESCALATED]: [CASE_STATES.EXECUTING, CASE_STATES.STOPPED],
  [CASE_STATES.EXECUTING]: [CASE_STATES.OBSERVING],
  [CASE_STATES.OBSERVING]: [
    CASE_STATES.RECOVERED,
    CASE_STATES.ANALYZING,
    CASE_STATES.STOPPED,
    CASE_STATES.EXPIRED
  ],
  [CASE_STATES.RECOVERED]: [],
  [CASE_STATES.STOPPED]: [],
  [CASE_STATES.EXPIRED]: []
};

export function validateStateTransition(currentState, nextState, actor = AUDIT_ACTORS.SYSTEM) {
  if (currentState === nextState) return true;

  const allowedNextStates = VALID_TRANSITIONS[currentState];
  if (!allowedNextStates || !allowedNextStates.includes(nextState)) {
    const error = new Error(`Invalid state transition from '${currentState}' to '${nextState}'`);
    error.statusCode = 400;
    error.code = 'INVALID_STATE_TRANSITION';
    throw error;
  }

  if (currentState === CASE_STATES.ESCALATED && actor !== AUDIT_ACTORS.HUMAN) {
    const error = new Error(`Transition from ESCALATED to ${nextState} requires actor 'HUMAN'`);
    error.statusCode = 403;
    error.code = 'HUMAN_AUTHORIZATION_REQUIRED';
    throw error;
  }

  return true;
}

