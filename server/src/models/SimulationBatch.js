import mongoose from 'mongoose';

const simulationBatchSchema = new mongoose.Schema({
  batchId: { type: String, required: true, unique: true, index: true },
  status: { type: String, enum: ['PENDING', 'RUNNING', 'COMPLETED', 'FAILED'], default: 'PENDING' },
  totalCases: { type: Number, default: 100 },
  processedCases: { type: Number, default: 0 },
  recoveredCases: { type: Number, default: 0 },
  escalatedCases: { type: Number, default: 0 },
  stoppedCases: { type: Number, default: 0 },
  recoveredAmount: { type: Number, default: 0 },
  lastProcessedCaseId: { type: String, default: null },
  checkpointIndex: { type: Number, default: 0 },
  startedAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  completedAt: { type: Date }
});

export const SimulationBatch = mongoose.model('SimulationBatch', simulationBatchSchema);
