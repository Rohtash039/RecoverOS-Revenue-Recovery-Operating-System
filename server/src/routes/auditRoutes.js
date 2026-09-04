import express from 'express';
import { getAuditLogs, getAgentActivityStream } from '../controllers/auditController.js';

const router = express.Router();

router.get('/', getAuditLogs);
router.get('/activity', getAgentActivityStream);

export default router;
