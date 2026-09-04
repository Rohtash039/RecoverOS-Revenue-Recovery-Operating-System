import crypto from 'crypto';
import { Customer } from '../../models/Customer.js';
import { Transaction } from '../../models/Transaction.js';
import { RecoveryCase } from '../../models/RecoveryCase.js';
import { RecoveryAction } from '../../models/RecoveryAction.js';
import { AuditLog } from '../../models/AuditLog.js';
import { SimulationBatch } from '../../models/SimulationBatch.js';
import {
  SIMULATION_REFERENCE_TIME,
  DEFAULT_SIMULATION_SEED,
  FAILURE_CODE_TO_DIAGNOSIS_CATEGORY,
  CASE_STATES,
  AUDIT_ACTORS
} from '../../config/constants.js';
import { calculateROS } from '../scoring/opportunityScorer.js';
import { recordAuditLog } from '../audit/auditService.js';
import { invalidateAnalyticsCache } from '../analytics/analyticsService.js';

function createPrng(seedStr) {
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = (Math.imul(31, hash) + seedStr.charCodeAt(i)) | 0;
  }
  let s = hash;
  return function next() {
    s |= 0;
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST_NAMES = ['Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Ayaan', 'Krishna', 'Ishaan', 'Shaurya', 'Atharv', 'Ananya', 'Diya', 'Myra', 'Sara', 'Aditi', 'Navya', 'Avani', 'Kiara'];
const LAST_NAMES = ['Sharma', 'Verma', 'Patel', 'Reddy', 'Mehta', 'Nair', 'Iyer', 'Gupta', 'Singh', 'Chopra', 'Malhotra', 'Mukherjee', 'Bose', 'Rao', 'Deshmukh', 'Joshi'];

export async function generateSeedDataset(seedKey = DEFAULT_SIMULATION_SEED) {
  invalidateAnalyticsCache();
  const prng = createPrng(seedKey);

  await Customer.deleteMany({});
  await Transaction.deleteMany({});
  await RecoveryCase.deleteMany({});
  await RecoveryAction.deleteMany({});
  await AuditLog.deleteMany({});
  await SimulationBatch.deleteMany({});

  const failureDistributions = [
    { code: 'BANK_TIMEOUT', reason: 'Issuing bank gateway response timeout (91)', eventType: 'FAILED_PAYMENT', count: 25 },
    { code: 'INSUFFICIENT_FUNDS', reason: 'Card balance or account limit exceeded (51)', eventType: 'FAILED_PAYMENT', count: 20 },
    { code: 'INVOICE_OVERDUE_30D', reason: 'Commercial B2B invoice overdue by 30 days', eventType: 'INVOICE_OVERDUE', count: 12 },
    { code: 'INVOICE_OVERDUE_60D', reason: 'Commercial B2B invoice overdue by 60 days', eventType: 'INVOICE_OVERDUE', count: 8 },
    { code: 'CART_ABANDONED', reason: 'User dropped off during checkout step', eventType: 'CHECKOUT_ABANDONED', count: 15 },
    { code: 'AUTHENTICATION_FAILED', reason: '3DS OTP session expired or failed (32)', eventType: 'FAILED_PAYMENT', count: 12 },
    { code: 'FRAUD_SUSPECTED', reason: 'Security algorithm blocked transaction (59)', eventType: 'FAILED_PAYMENT', count: 4 },
    { code: 'CARD_STOLEN', reason: 'Issuer confirmed stolen card instrument (43)', eventType: 'FAILED_PAYMENT', count: 2 },
    { code: 'ACCOUNT_CLOSED', reason: 'Customer account flagged as closed (14)', eventType: 'FAILED_PAYMENT', count: 2 }
  ];

  let caseIndex = 1;
  const customers = [];
  const transactions = [];
  const recoveryCases = [];

  const refMs = SIMULATION_REFERENCE_TIME.getTime();

  for (const dist of failureDistributions) {
    for (let i = 0; i < dist.count; i++) {
      const caseId = `RC-${String(1000 + caseIndex).padStart(4, '0')}`;
      const txnId = `TXN-${String(8000 + caseIndex).padStart(4, '0')}`;
      const custId = `CUST-${String(500 + caseIndex).padStart(4, '0')}`;

      const fName = FIRST_NAMES[Math.floor(prng() * FIRST_NAMES.length)];
      const lName = LAST_NAMES[Math.floor(prng() * LAST_NAMES.length)];
      const name = `${fName} ${lName}`;
      const email = `${fName.toLowerCase()}.${lName.toLowerCase()}${caseIndex}@example.in`;
      const phone = `+91 98${Math.floor(10000000 + prng() * 90000000)}`;

      let tier = 'STANDARD';
      let succPay = 0;
      let failPay = 0;
      let ltv = 0;

      if (caseIndex <= 30) {
        tier = 'PREMIUM';
        succPay = 5 + Math.floor(prng() * 12);
        failPay = Math.floor(prng() * 2);
        ltv = 25000 + Math.floor(prng() * 75000);
      } else if (caseIndex <= 75) {
        tier = 'STANDARD';
        succPay = 1 + Math.floor(prng() * 4);
        failPay = Math.floor(prng() * 2);
        ltv = 5000 + Math.floor(prng() * 18000);
      } else {
        tier = 'STANDARD';
        succPay = 0;
        failPay = Math.floor(prng() * 3);
        ltv = 0;
      }

      const customerObj = {
        customerId: custId,
        name,
        email,
        phone,
        tier,
        previousSuccessfulPayments: succPay,
        previousFailedPayments: failPay,
        lifetimeValue: ltv,
        createdAt: new Date(refMs - 30 * 24 * 3600 * 1000)
      };
      customers.push(customerObj);

      let amount = 0;
      if (caseIndex === 3 || caseIndex === 17 || caseIndex === 42 || caseIndex === 68) {

        amount = 52000 + Math.floor(prng() * 30000);
      } else if (dist.eventType === 'INVOICE_OVERDUE') {
        amount = 18000 + Math.floor(prng() * 32000);
      } else if (caseIndex <= 20) {
        amount = 15000 + Math.floor(prng() * 25000);
      } else if (caseIndex <= 80) {
        amount = 1200 + Math.floor(prng() * 9000);
      } else {
        amount = 499 + Math.floor(prng() * 500);
      }

      let createdAt;
      let paymentMethod;
      let invoiceMetadata = {};

      if (dist.eventType === 'INVOICE_OVERDUE') {
        const daysOverdue = dist.code === 'INVOICE_OVERDUE_30D' ? (20 + Math.floor(prng() * 10)) : (45 + Math.floor(prng() * 20));
        createdAt = new Date(refMs - daysOverdue * 24 * 3600 * 1000);
        paymentMethod = 'BANK_TRANSFER';
        const dueDate = new Date(createdAt.getTime() + 15 * 24 * 3600 * 1000);
        invoiceMetadata = {
          invoiceNumber: `INV-2026-${String(2000 + caseIndex)}`,
          dueDate,
          daysOverdue,
          cartItemsCount: 0,
          gatewayLatencyMs: 0
        };
      } else {
        const hoursAgo = 0.2 + prng() * 34;
        createdAt = new Date(refMs - hoursAgo * 3600 * 1000);
        const paymentMethods = ['UPI', 'CARD', 'NETBANKING', 'WALLET'];
        paymentMethod = dist.eventType === 'CHECKOUT_ABANDONED' ? 'UPI' : paymentMethods[Math.floor(prng() * paymentMethods.length)];
        invoiceMetadata = {
          cartItemsCount: dist.eventType === 'CHECKOUT_ABANDONED' ? Math.floor(1 + prng() * 5) : 0,
          gatewayLatencyMs: Math.floor(200 + prng() * 2500)
        };
      }

      const txnObj = {
        transactionId: txnId,
        customerId: custId,
        amount,
        currency: 'INR',
        eventType: dist.eventType,
        paymentMethod,
        failureCode: dist.code,
        failureReason: dist.reason,
        attempts: 0,
        metadata: invoiceMetadata,
        createdAt
      };
      transactions.push(txnObj);

      const { recoveryScore, scoreFactors } = calculateROS(txnObj, customerObj, SIMULATION_REFERENCE_TIME);
      const normCategory = FAILURE_CODE_TO_DIAGNOSIS_CATEGORY[dist.code] || 'UNKNOWN';

      const caseObj = {
        recoveryCaseId: caseId,
        transactionId: txnId,
        customerId: custId,
        batchId: null,
        initialRevenueAtRisk: amount,
        normalizedFailureCategory: normCategory,
        recoveryScore,
        scoreFactors,
        state: CASE_STATES.AT_RISK,
        expectedRecovery: 0,
        recoveredAmount: 0,
        retryCount: 0,
        contactCount: 0,
        createdAt
      };
      recoveryCases.push(caseObj);

      caseIndex++;
    }
  }

  await Customer.insertMany(customers);
  await Transaction.insertMany(transactions);
  await RecoveryCase.insertMany(recoveryCases);

  for (const rc of recoveryCases) {
    await recordAuditLog({
      recoveryCaseId: rc.recoveryCaseId,
      transactionId: rc.transactionId,
      actor: AUDIT_ACTORS.SYSTEM,
      event: 'CASE_CREATED',
      reason: `Revenue risk event detected: ₹${rc.initialRevenueAtRisk.toLocaleString('en-IN')} exposed via ${rc.normalizedFailureCategory}`,
      stateBefore: null,
      stateAfter: CASE_STATES.AT_RISK,
      financialImpact: 0,
      payload: { initialRevenueAtRisk: rc.initialRevenueAtRisk, failureCode: transactions.find(t => t.transactionId === rc.transactionId)?.failureCode }
    });
  }

  console.log(`[Seed Data] Generated ${recoveryCases.length} deterministic synthetic cases in clean AT_RISK state.`);
  return {
    success: true,
    totalCases: recoveryCases.length,
    totalAtRisk: recoveryCases.reduce((acc, c) => acc + c.initialRevenueAtRisk, 0)
  };
}

