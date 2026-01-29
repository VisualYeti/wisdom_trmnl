import type { Request, Response, NextFunction } from 'express';
import { config } from '../config.js';
import { validateApiKey, type ApiKey } from '../services/apiKeyService.js';

// Extend Express Request type to include apiKey
declare global {
  namespace Express {
    interface Request {
      apiKey?: ApiKey;
    }
  }
}

export function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  const apiKeyHeader = req.header(config.apiKeyHeader);

  if (!apiKeyHeader) {
    res.status(401).json({
      success: false,
      error: {
        code: 'MISSING_API_KEY',
        message: `API key required. Include it in the ${config.apiKeyHeader} header.`,
      },
    });
    return;
  }

  const apiKey = validateApiKey(apiKeyHeader);

  if (!apiKey) {
    res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_API_KEY',
        message: 'The provided API key is invalid or has been revoked.',
      },
    });
    return;
  }

  req.apiKey = apiKey;
  next();
}

export function requireAdminKey(req: Request, res: Response, next: NextFunction): void {
  // First, require a valid API key
  requireApiKey(req, res, () => {
    if (!req.apiKey?.is_admin) {
      res.status(403).json({
        success: false,
        error: {
          code: 'ADMIN_REQUIRED',
          message: 'This endpoint requires an admin API key.',
        },
      });
      return;
    }
    next();
  });
}
