import http from 'http';
import { connectDB } from '../config/db.js';
import { ENV } from '../config/env.js';
import { AuditLog } from '../models/AuditLog.js';
import { RecoveryCase } from '../models/RecoveryCase.js';
import { RecoveryAction } from '../models/RecoveryAction.js';
import { generateSeedDataset } from '../services/simulation/seedDataGenerator.js';
import express from 'express';
import recoveryCaseRoutes from '../routes/recoveryCaseRoutes.js';
import simulationRoutes from '../routes/simulationRoutes.js';
import dashboardRoutes from '../routes/dashboardRoutes.js';
import { errorHandler } from '../middleware/errorHandler.js';

async function runAuthVerification() {
  console.log('=== [RecoverOS Verification] Starting P0-1 Authentication & Operator Attribution Verification ===\n');

  await connectDB();
  await generateSeedDataset();

  const app = express();
  app.use(express.json());
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/recovery-cases', recoveryCaseRoutes);
  app.use('/api/simulation', simulationRoutes);
  app.use(errorHandler);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  console.log(`[Test Server] Running on ${baseUrl}`);

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      passed++;
    } else {
      failed++;
    }
  }

  try {

    const getRes = await fetch(`${baseUrl}/api/recovery-cases`);
    const getData = await getRes.json();
    assert(getRes.status === 200 && getData.success === true, 'GET /api/recovery-cases is accessible without authentication');

    ENV.API_KEY = '';
    ENV.NODE_ENV = 'development';
    const devBypassRes = await fetch(`${baseUrl}/api/recovery-cases/RC-1001/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    assert(devBypassRes.status === 200, 'Dev mode with unset API_KEY permits mutating request (dev auto-bypass)');

    ENV.API_KEY = 'secret_test_key_998877';
    const noKeyRes = await fetch(`${baseUrl}/api/recovery-cases/RC-1001/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const noKeyData = await noKeyRes.json();
    assert(
      noKeyRes.status === 401 && noKeyData.error?.code === 'UNAUTHORIZED',
      'Configured API_KEY rejects missing x-api-key header with 401 UNAUTHORIZED'
    );

    const wrongKeyRes = await fetch(`${baseUrl}/api/recovery-cases/RC-1001/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'invalid_secret_key_wrong'
      }
    });
    const wrongKeyData = await wrongKeyRes.json();
    assert(
      wrongKeyRes.status === 401 && wrongKeyData.error?.code === 'UNAUTHORIZED',
      'Configured API_KEY rejects invalid x-api-key header with 401 UNAUTHORIZED'
    );

    const authAuditEntry = await AuditLog.findOne({ event: 'AUTH_FAILED' }).sort({ timestamp: -1 });
    assert(
      authAuditEntry !== null && authAuditEntry.actor === 'SYSTEM',
      'Audit log recorded AUTH_FAILED entry with actor: SYSTEM and client IP/path'
    );

    const validKeyRes = await fetch(`${baseUrl}/api/recovery-cases/RC-1002/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'secret_test_key_998877'
      }
    });
    assert(validKeyRes.status === 200, 'Valid x-api-key successfully executes mutating request');

    ENV.API_KEY = '';
    ENV.NODE_ENV = 'production';
    const prodNoKeyRes = await fetch(`${baseUrl}/api/recovery-cases/RC-1004/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const prodNoKeyData = await prodNoKeyRes.json();
    assert(
      prodNoKeyRes.status === 500 && prodNoKeyData.error?.code === 'SERVER_MISCONFIGURED',
      'Production mode without configured API_KEY returns 500 SERVER_MISCONFIGURED'
    );

    ENV.NODE_ENV = 'development';
    ENV.API_KEY = 'secret_test_key_998877';

    const targetCase = await RecoveryCase.findOne({ recoveryCaseId: 'RC-1003' });
    targetCase.state = 'ESCALATED';
    targetCase.pendingHumanAction = 'RETRY_PAYMENT';
    await targetCase.save();

    const humanActionRes = await fetch(`${baseUrl}/api/recovery-cases/RC-1003/action`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'secret_test_key_998877'
      },
      body: JSON.stringify({
        action: 'APPROVE_ESCALATION',
        operatorId: 'ops_lead_rohtash'
      })
    });
    const humanActionData = await humanActionRes.json();
    assert(humanActionRes.status === 200 && humanActionData.success === true, 'Human approval action executed successfully');

    const humanAuditEntry = await AuditLog.findOne({
      recoveryCaseId: 'RC-1003',
      actor: 'HUMAN',
      event: 'HUMAN_APPROVAL_GRANTED'
    }).sort({ timestamp: -1 });

    assert(
      humanAuditEntry?.payload?.operatorId === 'ops_lead_rohtash' &&
      humanAuditEntry?.reason?.includes('ops_lead_rohtash'),
      `Audit trail attributed human approval directly to operator '${humanAuditEntry?.payload?.operatorId}'`
    );

    const executedActionRecord = await RecoveryAction.findOne({
      recoveryCaseId: 'RC-1003',
      workflowStep: 'HUMAN_APPROVED_ATTEMPT_1'
    });

    assert(
      executedActionRecord?.operatorId === 'ops_lead_rohtash',
      `RecoveryAction model persisted operatorId directly: '${executedActionRecord?.operatorId}'`
    );

  } finally {

    ENV.API_KEY = '';
    ENV.NODE_ENV = 'development';
    await generateSeedDataset();
    await new Promise((resolve) => server.close(resolve));
    process.exit(failed > 0 ? 1 : 0);
  }
}

runAuthVerification();

