import mongoose from 'mongoose';
import { RAW_FAILURE_CODES } from '../config/constants.js';

const transactionSchema = new mongoose.Schema({
  transactionId: { type: String, required: true, unique: true, index: true },
  customerId: { type: String, required: true, index: true },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'INR' },
  eventType: { type: String, enum: ['FAILED_PAYMENT', 'CHECKOUT_ABANDONED', 'INVOICE_OVERDUE'], required: true },
  paymentMethod: { type: String, enum: ['CARD', 'UPI', 'NETBANKING', 'WALLET', 'BANK_TRANSFER'] },
  failureCode: {
    type: String,
    enum: RAW_FAILURE_CODES,
    required: true
  },
  failureReason: { type: String, required: true },
  attempts: { type: Number, default: 0 },
  metadata: {
    cartItemsCount: { type: Number, default: 0 },
    gatewayLatencyMs: { type: Number, default: 0 },
    clientIpLocation: { type: String, default: 'IN' },
    invoiceNumber: { type: String },
    dueDate: { type: Date },
    daysOverdue: { type: Number }
  },
  createdAt: { type: Date, required: true, index: true }
});

export const Transaction = mongoose.model('Transaction', transactionSchema);

