import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { ENV } from './config/env.js';
import { connectDB } from './config/db.js';
import { errorHandler } from './middleware/errorHandler.js';

import dashboardRoutes from './routes/dashboardRoutes.js';
import recoveryCaseRoutes from './routes/recoveryCaseRoutes.js';
import simulationRoutes from './routes/simulationRoutes.js';
import auditRoutes from './routes/auditRoutes.js';

import { globalLimiter } from './middleware/rateLimiter.js';
import { requestLogger } from './middleware/requestLogger.js';
import metricsRoutes from './routes/metricsRoutes.js';

const app = express();

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

const allowedOrigins = (ENV.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map(url => url.trim().replace(/\/$/, ''));

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const cleanOrigin = origin.replace(/\/$/, '');
    if (
      allowedOrigins.includes(cleanOrigin) ||
      allowedOrigins.includes('*') ||
      ENV.NODE_ENV !== 'production'
    ) {
      return callback(null, true);
    }
    return callback(new Error(`CORS policy violation: Origin '${origin}' not allowed.`));
  },
  credentials: true
}));
app.use(express.json());
app.use(requestLogger);
app.use(globalLimiter);

app.use('/api/dashboard', dashboardRoutes);
app.use('/api/recovery-cases', recoveryCaseRoutes);
app.use('/api/simulation', simulationRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/metrics', metricsRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'HEALTHY',
    service: 'RecoverOS API',
    aiMode: ENV.AI_MODE,
    timestamp: new Date()
  });
});

app.use(errorHandler);

async function startServer() {
  await connectDB();
  app.listen(ENV.PORT, '0.0.0.0', () => {
    console.log(`server is listening on ${ENV.PORT} (AI_MODE: ${ENV.AI_MODE})`);
  });
}

startServer();

