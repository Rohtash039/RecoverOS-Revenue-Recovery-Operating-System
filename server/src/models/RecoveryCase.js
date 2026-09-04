import mongoose from 'mongoose';
import { CASE_STATES, DIAGNOSIS_CATEGORIES, RECOVERY_ACTIONS } from '../config/constants.js';

const recoveryCaseSchema = new mongoose.Schema({
  recoveryCaseId: { type: String, required: true, unique: true, index: true },
  transactionId: { type: String, required: true, unique: true, index: true },
  customerId: { type: String, required: true, index: true },
  batchId: { type: String, index: true },
  initialRevenueAtRisk: { type: Number, required: true },
  normalizedFailureCategory: {
    type: String,
    enum: DIAGNOSIS_CATEGORIES,
    required: true
  },
  recoveryScore: { type: Number, required: true, min: 0, max: 100, index: true },
  scoreFactors: {
    failureRecoverability: { type: Number, required: true },
    customerReliability: { type: Number, required: true },
    attemptFatigue: { type: Number, required: true },
    amountTier: { type: Number, required: true },
    recency: { type: Number, required: true }
  },
  state: {
    type: String,
    enum: Object.values(CASE_STATES),
    default: CASE_STATES.AT_RISK,
    index: true
  },
  aiDiagnosis: {
    diagnosisCategory: { type: String, enum: DIAGNOSIS_CATEGORIES },
    rootCauseAnalysis: String,
    recommendedAction: {
      type: String,
      enum: Object.values(RECOVERY_ACTIONS)
    },
    waitMinutes: Number,
    confidence: Number,
    reasoning: String,
    customerMessage: {
      channel: { type: String, enum: ['EMAIL', 'SMS', 'WHATSAPP', 'NONE'] },
      headline: String,
      body: String,
      cta: String
    },
    fallbackUsed: { type: Boolean, default: false }
  },
  policyEvaluation: {
    decision: { type: String, enum: ['APPROVE', 'MODIFY', 'REJECT'] },
    originalAction: String,
    finalAction: String,
    reasons: [String],
    evaluatedAt: Date
  },
  pendingHumanAction: { type: String, enum: Object.values(RECOVERY_ACTIONS) },
  expectedRecovery: { type: Number, default: 0 },
  recoveredAmount: { type: Number, default: 0 },
  retryCount: { type: Number, default: 0 },
  contactCount: { type: Number, default: 0 },
  terminalReason: { type: String },
  lastActionAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Compound index for hot queue queries filtering by state and sorting by recoveryScore
recoveryCaseSchema.index({ state: 1, recoveryScore: -1 });

export const RecoveryCase = mongoose.model('RecoveryCase', recoveryCaseSchema);
