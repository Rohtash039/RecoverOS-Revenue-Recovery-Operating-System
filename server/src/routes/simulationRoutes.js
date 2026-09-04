import express from 'express';
import { 
  runBatchSimulation, 
  getSimulationBatchStatus, 
  resetSimulation,
  resumeSimulationBatch
} from '../controllers/simulationController.js';
import { apiKeyAuth } from '../middleware/apiKeyAuth.js';
import { validateBody } from '../middleware/validateBody.js';
import { batchRunSchema, resetSchema } from '../schemas/requestSchemas.js';

const router = express.Router();

router.post('/batch-run', apiKeyAuth, validateBody(batchRunSchema), runBatchSimulation);
router.get('/batch/:batchId/status', getSimulationBatchStatus);
router.post('/batch/:batchId/resume', apiKeyAuth, resumeSimulationBatch);
router.post('/reset', apiKeyAuth, validateBody(resetSchema), resetSimulation);

export default router;
