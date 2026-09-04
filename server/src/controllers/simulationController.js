import { startBatchRun, getBatchStatus, resumeBatchRun } from '../services/simulation/batchOrchestrator.js';
import { generateSeedDataset } from '../services/simulation/seedDataGenerator.js';
import { ENV } from '../config/env.js';

export async function runBatchSimulation(req, res, next) {
  try {
    const { speed = 'ANIMATED' } = req.body;
    const batch = await startBatchRun(speed);

    res.json({
      success: true,
      data: batch
    });
  } catch (error) {
    next(error);
  }
}

export async function resumeSimulationBatch(req, res, next) {
  try {
    const { batchId } = req.params;
    const { speed = 'FAST' } = req.body || {};
    const batch = await resumeBatchRun(batchId, speed);

    res.json({
      success: true,
      data: batch
    });
  } catch (error) {
    next(error);
  }
}

export async function getSimulationBatchStatus(req, res, next) {
  try {
    const { batchId } = req.params;
    const batch = await getBatchStatus(batchId);

    if (!batch) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Batch not found' }
      });
    }

    res.json({
      success: true,
      data: batch
    });
  } catch (error) {
    next(error);
  }
}

export async function resetSimulation(req, res, next) {
  try {
    const seed = req.body.seed || ENV.SIMULATION_SEED;
    const result = await generateSeedDataset(seed);

    res.json({
      success: true,
      message: 'Simulation reset complete. 100 cases initialized in clean AT_RISK state.',
      data: result
    });
  } catch (error) {
    next(error);
  }
}
