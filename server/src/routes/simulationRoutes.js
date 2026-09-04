import express from 'express';
import { 
  runBatchSimulation, 
  getSimulationBatchStatus, 
  resetSimulation 
} from '../controllers/simulationController.js';

const router = express.Router();

router.post('/batch-run', runBatchSimulation);
router.get('/batch/:batchId/status', getSimulationBatchStatus);
router.post('/reset', resetSimulation);

export default router;
