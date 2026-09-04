import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema({
  customerId: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  tier: { type: String, enum: ['STANDARD', 'PREMIUM', 'ENTERPRISE'], default: 'STANDARD' },
  previousSuccessfulPayments: { type: Number, default: 0 },
  previousFailedPayments: { type: Number, default: 0 },
  lifetimeValue: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

export const Customer = mongoose.model('Customer', customerSchema);

