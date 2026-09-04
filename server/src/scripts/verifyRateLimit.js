import http from 'http';
import express from 'express';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import { rateLimit } from 'express-rate-limit';
import { AuditLog } from '../models/AuditLog.js';
import { recordAuditLog } from '../services/audit/auditService.js';
import { AUDIT_ACTORS } from '../config/constants.js';

async function runRateLimitVerification() {
  console.log('=== [RecoverOS Verification] Starting P1-5 Rate Limiting Verification ===\n');

  await connectDB();

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

  const testLimiter = rateLimit({
    windowMs: 5000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    handler: async (req, res) => {
      await recordAuditLog({
        recoveryCaseId: 'N/A',
        transactionId: 'N/A',
        actor: AUDIT_ACTORS.SYSTEM,
        event: 'RATE_LIMIT_EXCEEDED',
        reason: 'Test rate limit threshold exceeded',
        payload: { path: req.path, ip: req.ip }
      });

      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests. Please slow down and retry after rate limit window resets.'
        }
      });
    }
  });

  const app = express();
  app.use(express.json());
  app.post('/api/test-action', testLimiter, (req, res) => {
    res.json({ success: true, message: 'Request accepted' });
  });

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {

    for (let i = 1; i <= 5; i++) {
      const res = await fetch(`${baseUrl}/api/test-action`, { method: 'POST' });
      assert(res.status === 200, `Request ${i}/5 within rate limit succeeded (200 OK)`);
    }

    const exceededRes = await fetch(`${baseUrl}/api/test-action`, { method: 'POST' });
    const exceededData = await exceededRes.json();

    assert(
      exceededRes.status === 429 && exceededData.error?.code === 'RATE_LIMIT_EXCEEDED',
      'Request 6/5 exceeding rate limit returns 429 RATE_LIMIT_EXCEEDED'
    );

    const rateLimitAudit = await AuditLog.findOne({ event: 'RATE_LIMIT_EXCEEDED' }).sort({ timestamp: -1 });
    assert(
      rateLimitAudit !== null && rateLimitAudit.actor === 'SYSTEM',
      'Audit log recorded RATE_LIMIT_EXCEEDED entry with actor: SYSTEM'
    );

  } finally {
    await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
    process.exitCode = failed > 0 ? 1 : 0;
  }
}

runRateLimitVerification();

