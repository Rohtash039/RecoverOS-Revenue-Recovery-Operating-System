import express from 'express';
import { getAuditLogs, getAgentActivityStream, verifyAuditChain } from '../controllers/auditController.js';

const router = express.Router();

router.get('/', getAuditLogs);
router.get('/activity', getAgentActivityStream);
router.get('/verify-chain', verifyAuditChain);

export default router;
