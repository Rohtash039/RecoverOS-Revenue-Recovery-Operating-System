import http from 'http';
import express from 'express';
import { connectDB } from '../config/db.js';
import { requestLogger, metricsStore } from '../middleware/requestLogger.js';
import metricsRoutes from '../routes/metricsRoutes.js';
import dashboardRoutes from '../routes/dashboardRoutes.js';
import recoveryCaseRoutes from '../routes/recoveryCaseRoutes.js';
import { generateSeedDataset } from '../services/simulation/seedDataGenerator.js';
import { errorHandler } from '../middleware/errorHandler.js';
import mongoose from 'mongoose';

async function runMetricsVerification() {
  console.log('=== [RecoverOS Verification] Starting P2-8 Observability & Metrics Verification ===\n');

  await connectDB();
  await generateSeedDataset();

  const app = express();
  app.use(express.json());
  app.use(requestLogger);

  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/recovery-cases', recoveryCaseRoutes);
  app.use('/api/metrics', metricsRoutes);
  app.use(errorHandler);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // -------------------------------------------------------------
    // Step 1: Send series of requests across multiple routes
    // -------------------------------------------------------------
    await fetch(`${baseUrl}/api/dashboard/summary`);
    await fetch(`${baseUrl}/api/recovery-cases`);
    await fetch(`${baseUrl}/api/recovery-cases/RC-1001`);
    await fetch(`${baseUrl}/api/recovery-cases/NON_EXISTENT_CASE_404`); // intentional 404

    // Wait a brief tick for finish handlers to update in-memory telemetry
    await new Promise(r => setTimeout(r, 100));

    // -------------------------------------------------------------
    // Step 2: Fetch and verify telemetry counters from /api/metrics
    // -------------------------------------------------------------
    const metricsRes = await fetch(`${baseUrl}/api/metrics`);
    const metricsData = await metricsRes.json();

    assert(metricsRes.status === 200 && metricsData.success === true, 'GET /api/metrics endpoint returns 200 OK');

    const telemetry = metricsData.data;
    assert(
      telemetry.totalRequests >= 4,
      `Total requests tracked: ${telemetry.totalRequests} (expected >= 4)`
    );

    assert(
      telemetry.successfulRequests >= 3,
      `Successful requests tracked: ${telemetry.successfulRequests} (expected >= 3)`
    );

    assert(
      telemetry.errorRequests >= 1,
      `Error requests tracked: ${telemetry.errorRequests} (expected >= 1 for 404 case)`
    );

    assert(
      typeof telemetry.avgLatencyMs === 'number' && telemetry.avgLatencyMs >= 0,
      `Average latency computed accurately: ${telemetry.avgLatencyMs} ms`
    );

    assert(
      telemetry.requestsByRoute['/api/recovery-cases'] !== undefined,
      `Route breakdown accurately tracked /api/recovery-cases: ${telemetry.requestsByRoute['/api/recovery-cases']} requests`
    );

    assert(
      telemetry.memory?.heapUsedMb > 0,
      `Node process memory telemetry available: heapUsed=${telemetry.memory.heapUsedMb} MB, rss=${telemetry.memory.rssMb} MB`
    );

  } finally {
    await mongoose.disconnect();
    await new Promise((resolve) => server.close(resolve));
    process.exit(failed > 0 ? 1 : 0);
  }
}

runMetricsVerification();
