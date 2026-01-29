import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { config } from './config.js';
import { apiRateLimiter } from './middleware/rateLimit.js';
import routes from './routes/index.js';

const app = express();

// Trust proxy if configured (for nginx)
if (config.trustProxy) {
  app.set('trust proxy', 1);
}

// Security headers
app.use(helmet());

// CORS
app.use(cors({
  origin: config.allowedOrigins.includes('*') ? '*' : config.allowedOrigins,
  credentials: true,
}));

// Parse JSON bodies
app.use(express.json());

// Rate limiting
app.use('/api', apiRateLimiter);

// Health check (no auth required)
app.get('/api/v1/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
    },
  });
});

// API routes
app.use('/api/v1', routes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Endpoint not found.',
    },
  });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: config.isDev ? err.message : 'An internal error occurred.',
    },
  });
});

export default app;
