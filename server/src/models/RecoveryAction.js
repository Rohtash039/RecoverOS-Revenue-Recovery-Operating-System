import mongoose from 'mongoose';
import { RECOVERY_ACTIONS } from '../config/constants.js';

const recoveryActionSchema = new mongoose.Schema({
  idempotencyKey: { type: String, required: true, unique: true, index: true },
  recoveryCaseId: { type: String, required: true, index: true },
  workflowStep: { type: String, required: true },
  actionType: {
    type: String,
    enum: Object.values(RECOVERY_ACTIONS),
    required: true
  },
  attemptNumber: { type: Number, required: true },
  executedAt: { type: Date, default: Date.now },
  result: { type: String, enum: ['SUCCESS', 'FAILED', 'ESCALATED', 'STOPPED'], required: true },
  recoveredAmount: { type: Number, default: 0 },
  reason: { type: String },
  operatorId: { type: String, default: null },
  metadata: { type: mongoose.Schema.Types.Mixed }
});

export const RecoveryAction = mongoose.model('RecoveryAction', recoveryActionSchema);

