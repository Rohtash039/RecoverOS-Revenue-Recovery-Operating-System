
export const metricsStore = {
  totalRequests: 0,
  successfulRequests: 0,
  errorRequests: 0,
  totalLatencyMs: 0,
  requestsByMethod: {},
  requestsByRoute: {},
  requestsByStatus: {},
  startTime: Date.now()
};

export function requestLogger(req, res, next) {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1e6;

    const routeKey = req.baseUrl || req.path || '/';
    const statusCode = res.statusCode;
    const method = req.method;

    metricsStore.totalRequests++;
    metricsStore.totalLatencyMs += durationMs;
    metricsStore.requestsByMethod[method] = (metricsStore.requestsByMethod[method] || 0) + 1;
    metricsStore.requestsByRoute[routeKey] = (metricsStore.requestsByRoute[routeKey] || 0) + 1;
    metricsStore.requestsByStatus[statusCode] = (metricsStore.requestsByStatus[statusCode] || 0) + 1;

    if (statusCode >= 400) {
      metricsStore.errorRequests++;
    } else {
      metricsStore.successfulRequests++;
    }

    if (req.path !== '/api/health' && req.path !== '/api/metrics') {
      const logEntry = {
        level: statusCode >= 500 ? 'error' : (statusCode >= 400 ? 'warn' : 'info'),
        timestamp: new Date().toISOString(),
        method,
        path: req.originalUrl || req.path,
        status: statusCode,
        durationMs: Number(durationMs.toFixed(2)),
        ip: req.ip || req.socket?.remoteAddress,
        operatorId: req.body?.operatorId || null
      };

      console.log(JSON.stringify(logEntry));
    }
  });

  next();
}

