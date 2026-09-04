import { connectDB, disconnectDB } from '../config/db.js';
import { RecoveryCase } from '../models/RecoveryCase.js';
import { RecoveryAction } from '../models/RecoveryAction.js';
import { AuditLog } from '../models/AuditLog.js';
import { Transaction } from '../models/Transaction.js';
import { Customer } from '../models/Customer.js';
import { evaluatePolicy } from '../services/policy/guardrailEngine.js';
import { simulateExecutionOutcome } from '../services/simulation/seededSimulator.js';
import { processCaseWorkflow, handleHumanAction } from '../services/workflow/workflowEngine.js';
import { executeWithIdempotency } from '../services/workflow/idempotency.js';
import { validateStateTransition } from '../services/workflow/stateMachine.js';
import { 
  SIMULATION_REFERENCE_TIME, 
  CASE_STATES, 
  RECOVERY_ACTIONS, 
  AUDIT_ACTORS,
  POLICY_CONFIG 
} from '../config/constants.js';

async function runDetailedHarness() {
  await connectDB();

  console.log('=== DETAILED ADVERSARIAL HARNESS ===\n');

  // Test 1: High Value Escalation on RecoveryCase Object
  console.log('1. High-Value Escalation Test:');
  const rc65k = {
    recoveryCaseId: 'RC-TEST-65K',
    initialRevenueAtRisk: 65000,
    failureCode: 'BANK_TIMEOUT',
    retryCount: 0,
    contactCount: 0,
    createdAt: SIMULATION_REFERENCE_TIME,
    aiDiagnosis: { confidence: 0.95 }
  };
  const pol65k = evaluatePolicy(rc65k, RECOVERY_ACTIONS.RETRY_PAYMENT);
  console.log(`- 65k RecoveryCase Policy: Decision=${pol65k.decision}, FinalAction=${pol65k.finalAction}`);
  console.log(`- Reason: ${pol65k.reasons[0]}`);

  // Test 2: Retry Exhaustion (Crafting Attempt 1 and Attempt 2 failure)
  console.log('\n2. Retry Exhaustion Simulation:');
  // Find an action/score combo where both attempt 1 and 2 fail
  const rcExhaust = {
    recoveryCaseId: 'RC-EXHAUST-FORCED',
    initialRevenueAtRisk: 10000,
    failureCode: 'AUTHENTICATION_FAILED',
    recoveryScore: 10, // low score ensures seedValue > effectiveCutoff for both attempts
    eventType: 'FAILED_PAYMENT'
  };

  const outcome1 = simulateExecutionOutcome(rcExhaust, RECOVERY_ACTIONS.SEND_PAYMENT_REMINDER, 1);
  const outcome2 = simulateExecutionOutcome(rcExhaust, RECOVERY_ACTIONS.SEND_PAYMENT_REMINDER, 2);
  console.log(`- Attempt 1: Result=${outcome1.result}, Recovered=₹${outcome1.recoveredAmount}`);
  console.log(`- Attempt 2: Result=${outcome2.result}, Recovered=₹${outcome2.recoveredAmount}`);

  // Test 3: Public API State Transition Validation
  console.log('\n3. State Machine Strictness Check:');
  const illegalTransitions = [
    { from: 'RECOVERED', to: 'EXECUTING' },
    { from: 'STOPPED', to: 'EXECUTING' },
    { from: 'STOPPED', to: 'RECOVERED' },
    { from: 'ESCALATED', to: 'RECOVERED' },
    { from: 'AT_RISK', to: 'RECOVERED' }
  ];

  for (const t of illegalTransitions) {
    try {
      validateStateTransition(t.from, t.to, AUDIT_ACTORS.SYSTEM);
      console.log(`- ${t.from} -> ${t.to}: ALLOWED (FAIL)`);
    } catch (e) {
      console.log(`- ${t.from} -> ${t.to}: REJECTED (${e.code}) (PASS)`);
    }
  }

  await disconnectDB();
}

runDetailedHarness();
