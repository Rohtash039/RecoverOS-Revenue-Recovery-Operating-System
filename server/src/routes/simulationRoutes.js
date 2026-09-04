import express from 'express';
import { 
  runBatchSimulation, 
  getSimulationBatchStatus, 
  resetSimulation 
} from '../controllers/simulationController.js';
import { apiKeyAuth } from '../middleware/apiKeyAuth.js';

const router = express.Router();

router.post('/batch-run', apiKeyAuth, runBatchSimulation);
router.get('/batch/:batchId/status', getSimulationBatchStatus);
router.post('/reset', apiKeyAuth, resetSimulation);

export default router;
