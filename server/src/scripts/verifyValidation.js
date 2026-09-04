import http from 'http';
import { connectDB } from '../config/db.js';
import { ENV } from '../config/env.js';
import { RecoveryCase } from '../models/RecoveryCase.js';
import { generateSeedDataset } from '../services/simulation/seedDataGenerator.js';
import express from 'express';
import recoveryCaseRoutes from '../routes/recoveryCaseRoutes.js';
import simulationRoutes from '../routes/simulationRoutes.js';
import { errorHandler } from '../middleware/errorHandler.js';

async function runValidationVerification() {
  console.log('=== [RecoverOS Verification] Starting P0-2 Request Body Validation Verification ===\n');

  await connectDB();
  await generateSeedDataset();

  const app = express();
  app.use(express.json());
  app.use('/api/recovery-cases', recoveryCaseRoutes);
  app.use('/api/simulation', simulationRoutes);
  app.use(errorHandler);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`PASS: ${message}`);
      passed++;
    } else {
      console.error(`FAIL: ${message}`);
      failed++;
    }
  }

  try {

    const invalidActionRes = await fetch(`${baseUrl}/api/recovery-cases/RC-1001/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'SUPER_FORCE_APPROVE_UNKNOWN',
        operatorId: 'ops_lead_test'
      })
    });
    const invalidActionData = await invalidActionRes.json();
    assert(
      invalidActionRes.status === 400 &&
      invalidActionData.error?.code === 'VALIDATION_ERROR' &&
      Array.isArray(invalidActionData.error?.details) &&
      invalidActionData.error.details.some(d => d.field === 'action'),
      'Invalid action enum returns 400 VALIDATION_ERROR with structured details for field "action"'
    );

    const missingOpRes = await fetch(`${baseUrl}/api/recovery-cases/RC-1001/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'APPROVE_ESCALATION'
      })
    });
    const missingOpData = await missingOpRes.json();
    assert(
      missingOpRes.status === 400 &&
      missingOpData.error?.details?.some(d => d.field === 'operatorId'),
      'Missing operatorId returns 400 VALIDATION_ERROR for required field "operatorId"'
    );

    const emptyOpRes = await fetch(`${baseUrl}/api/recovery-cases/RC-1001/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'APPROVE_ESCALATION',
        operatorId: '   '
      })
    });
    const emptyOpData = await emptyOpRes.json();
    assert(
      emptyOpRes.status === 400 &&
      emptyOpData.error?.details?.some(d => d.field === 'operatorId'),
      'Empty/whitespace operatorId returns 400 VALIDATION_ERROR'
    );

    const invalidSpeedRes = await fetch(`${baseUrl}/api/simulation/batch-run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        speed: 'LIGHTSPEED_INVALID'
      })
    });
    const invalidSpeedData = await invalidSpeedRes.json();
    assert(
      invalidSpeedRes.status === 400 &&
      invalidSpeedData.error?.code === 'VALIDATION_ERROR' &&
      invalidSpeedData.error.details.some(d => d.field === 'speed'),
      'Invalid batch speed enum returns 400 VALIDATION_ERROR with structured details for field "speed"'
    );

    const validBatchRes = await fetch(`${baseUrl}/api/simulation/batch-run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        speed: 'FAST'
      })
    });
    const validBatchData = await validBatchRes.json();
    assert(
      validBatchRes.status === 200 && validBatchData.success === true,
      'Valid batch request body successfully passes schema validation'
    );

    const batchId = validBatchData.data?.batchId;
    if (batchId) {
      for (let i = 0; i < 40; i++) {
        await new Promise(r => setTimeout(r, 100));
        const statusRes = await fetch(`${baseUrl}/api/simulation/batch/${batchId}/status`);
        const statusData = await statusRes.json();
        if (statusData.data?.status === 'COMPLETED' || statusData.data?.status === 'FAILED') {
          break;
        }
      }
    }

    const targetCase = await RecoveryCase.findOne({ recoveryCaseId: 'RC-1003' });
    if (targetCase) {
      targetCase.state = 'ESCALATED';
      targetCase.pendingHumanAction = 'RETRY_PAYMENT';
      await targetCase.save();
    }

    const validActionRes = await fetch(`${baseUrl}/api/recovery-cases/RC-1003/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'APPROVE_ESCALATION',
        operatorId: 'ops_lead_rohtash'
      })
    });
    const validActionData = await validActionRes.json();
    assert(
      validActionRes.status === 200 && validActionData.success === true,
      'Valid human action payload passes schema validation and executes'
    );

  } finally {

    await new Promise(r => setTimeout(r, 200));
    await generateSeedDataset();
    await new Promise((resolve) => server.close(resolve));
    process.exit(failed > 0 ? 1 : 0);
  }
}

runValidationVerification();

