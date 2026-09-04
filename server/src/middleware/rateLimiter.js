import rateLimit from 'express-rate-limit';
import { recordAuditLog } from '../services/audit/auditService.js';
import { AUDIT_ACTORS } from '../config/constants.js';

function createRateLimitHandler(limiterName) {
  return async (req, res) => {

    await recordAuditLog({
      recoveryCaseId: req.params?.id || 'N/A',
      transactionId: req.params?.id || 'N/A',
      actor: AUDIT_ACTORS.SYSTEM,
      event: 'RATE_LIMIT_EXCEEDED',
      reason: `Rate limit (${limiterName}) threshold exceeded by client IP`,
      stateBefore: null,
      stateAfter: null,
      financialImpact: 0,
      payload: {
        limiter: limiterName,
        path: req.originalUrl || req.path,
        method: req.method,
        ip: req.ip || req.socket?.remoteAddress
      }
    });

    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: `Too many requests on ${limiterName}. Please slow down and retry after the rate limit window resets.`
      }
    });
  };
}

export const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 1200,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('global')
});

export const strictSimulationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('simulation_mutation')
});

