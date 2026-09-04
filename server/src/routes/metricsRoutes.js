import express from 'express';
import { metricsStore } from '../middleware/requestLogger.js';

const router = express.Router();

router.get('/', (req, res) => {
  const uptimeSeconds = Math.floor((Date.now() - metricsStore.startTime) / 1000);
  const avgLatencyMs = metricsStore.totalRequests > 0 
    ? Number((metricsStore.totalLatencyMs / metricsStore.totalRequests).toFixed(2)) 
    : 0;

  const errorRatePercent = metricsStore.totalRequests > 0
    ? Number(((metricsStore.errorRequests / metricsStore.totalRequests) * 100).toFixed(2))
    : 0;

  const mem = process.memoryUsage();

  res.json({
    success: true,
    data: {
      uptimeSeconds,
      totalRequests: metricsStore.totalRequests,
      successfulRequests: metricsStore.successfulRequests,
      errorRequests: metricsStore.errorRequests,
      errorRatePercent,
      avgLatencyMs,
      requestsByMethod: metricsStore.requestsByMethod,
      requestsByRoute: metricsStore.requestsByRoute,
      requestsByStatus: metricsStore.requestsByStatus,
      memory: {
        heapUsedMb: Number((mem.heapUsed / 1024 / 1024).toFixed(2)),
        heapTotalMb: Number((mem.heapTotal / 1024 / 1024).toFixed(2)),
        rssMb: Number((mem.rss / 1024 / 1024).toFixed(2))
      },
      timestamp: new Date()
    }
  });
});

export default router;
