import mongoose from 'mongoose';
import { AUDIT_ACTORS } from '../config/constants.js';

const auditLogSchema = new mongoose.Schema({
  auditId: { type: String, required: true, unique: true, index: true },
  recoveryCaseId: { type: String, required: true, index: true },
  transactionId: { type: String, required: true, index: true },
  actor: { 
    type: String, 
    enum: Object.values(AUDIT_ACTORS), 
    required: true 
  },
  event: { type: String, required: true },
  actionTaken: { type: String },
  reason: { type: String },
  stateBefore: { type: String },
  stateAfter: { type: String },
  financialImpact: { type: Number, default: 0 },
  payload: { type: mongoose.Schema.Types.Mixed },
  timestamp: { type: Date, default: Date.now, index: true }
});

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
