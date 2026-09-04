import { ENV } from '../config/env.js';
import { recordAuditLog } from '../services/audit/auditService.js';
import { AUDIT_ACTORS } from '../config/constants.js';

export async function apiKeyAuth(req, res, next) {
  if (!ENV.API_KEY) {
    return next();
  }

  const providedKey = req.headers['x-api-key'] || req.get('x-api-key');

  if (!providedKey || providedKey !== ENV.API_KEY) {

    await recordAuditLog({
      recoveryCaseId: req.params?.id || 'N/A',
      transactionId: req.params?.id || 'N/A',
      actor: AUDIT_ACTORS.SYSTEM,
      event: 'AUTH_FAILED',
      reason: 'Unauthorized mutating request attempt with missing or invalid x-api-key header',
      stateBefore: null,
      stateAfter: null,
      financialImpact: 0,
      payload: {
        path: req.originalUrl || req.path,
        method: req.method,
        ip: req.ip || req.socket?.remoteAddress
      }
    });

    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid or missing API key in x-api-key header.'
      }
    });
  }

  next();
}

