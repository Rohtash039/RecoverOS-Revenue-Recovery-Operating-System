import express from 'express';
import { 
  getRecoveryCases, 
  getRecoveryCaseById, 
  getWhyNotRetryExplanation, 
  postCaseAction, 
  analyzeCase 
} from '../controllers/recoveryCaseController.js';
import { apiKeyAuth } from '../middleware/apiKeyAuth.js';

const router = express.Router();

router.get('/', getRecoveryCases);
router.get('/:id', getRecoveryCaseById);
router.get('/:id/why-not-retry', getWhyNotRetryExplanation);
router.post('/:id/action', apiKeyAuth, postCaseAction);
router.post('/:id/analyze', apiKeyAuth, analyzeCase);

export default router;
