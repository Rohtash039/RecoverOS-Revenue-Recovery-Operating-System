import { ENV } from '../config/env.js';
import { recordAuditLog } from '../services/audit/auditService.js';
import { AUDIT_ACTORS } from '../config/constants.js';

/**
 * Authentication middleware for mutating API endpoints.
 * - In production: Requires ENV.API_KEY to be set, otherwise returns 500 SERVER_MISCONFIGURED.
 * - In development: If ENV.API_KEY is not set, bypasses authentication to simplify local testing.
 * - When ENV.API_KEY is set: Strictly validates the 'x-api-key' request header.
 * - Rejection writes an append-only audit log entry (event: AUTH_FAILED).
 */
export async function apiKeyAuth(req, res, next) {
  // Production fail-safe: Ensure API_KEY is configured
  if (ENV.NODE_ENV === 'production' && !ENV.API_KEY) {
    return res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_MISCONFIGURED',
        message: 'API_KEY must be configured in production environment.'
      }
    });
  }

  // Development bypass when no API key has been configured
  if (!ENV.API_KEY) {
    return next();
  }

  const providedKey = req.headers['x-api-key'] || req.get('x-api-key');

  if (!providedKey || providedKey !== ENV.API_KEY) {
    // Record append-only audit trail entry for auth failure
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
