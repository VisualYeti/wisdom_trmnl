import rateLimit from 'express-rate-limit';
import { config } from '../config.js';
import { apiKeyStore } from '../services/rateLimitStore.js';

function extractKeyPrefix(req: Express.Request): string | null {
  const apiKey = req.get(config.apiKeyHeader);
  if (!apiKey || apiKey.length < 8) return null;
  // Return first 8 chars as prefix (e.g., "wk_abc12")
  return apiKey.substring(0, 8);
}

export const apiRateLimiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMaxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  store: apiKeyStore,
  validate: { xForwardedForHeader: false },
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests. Please try again later.',
    },
  },
  keyGenerator: (req) => {
    // Extract key prefix from header (before auth middleware runs)
    const prefix = extractKeyPrefix(req);
    return prefix || req.ip || 'unknown';
  },
});
