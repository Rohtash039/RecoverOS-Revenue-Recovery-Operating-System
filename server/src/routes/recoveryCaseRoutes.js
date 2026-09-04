import express from 'express';
import { 
  getRecoveryCases, 
  getRecoveryCaseById, 
  getWhyNotRetryExplanation, 
  postCaseAction, 
  analyzeCase 
} from '../controllers/recoveryCaseController.js';

const router = express.Router();

router.get('/', getRecoveryCases);
router.get('/:id', getRecoveryCaseById);
router.get('/:id/why-not-retry', getWhyNotRetryExplanation);
router.post('/:id/action', postCaseAction);
router.post('/:id/analyze', analyzeCase);

export default router;
