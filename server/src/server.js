import express from 'express';
import cors from 'cors';
import { ENV } from './config/env.js';
import { connectDB } from './config/db.js';
import { errorHandler } from './middleware/errorHandler.js';

import dashboardRoutes from './routes/dashboardRoutes.js';
import recoveryCaseRoutes from './routes/recoveryCaseRoutes.js';
import simulationRoutes from './routes/simulationRoutes.js';
import auditRoutes from './routes/auditRoutes.js';

import { globalLimiter } from './middleware/rateLimiter.js';

const app = express();

// Security & Middleware
app.use(cors({
  origin: ENV.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(globalLimiter);

// API Routes
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/recovery-cases', recoveryCaseRoutes);
app.use('/api/simulation', simulationRoutes);
app.use('/api/audit-logs', auditRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'HEALTHY',
    service: 'RecoverOS API',
    aiMode: ENV.AI_MODE,
    timestamp: new Date()
  });
});

// Centralized error handler
app.use(errorHandler);

// Start server
async function startServer() {
  await connectDB();
  app.listen(ENV.PORT, '0.0.0.0', () => {
    console.log(`[RecoverOS Server] Listening on http://127.0.0.1:${ENV.PORT} (AI_MODE: ${ENV.AI_MODE})`);
  });
}

startServer();
