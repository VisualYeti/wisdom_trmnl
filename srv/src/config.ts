import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.join(__dirname, '..', '.env') });

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '127.0.0.1',

  databasePath: process.env.DATABASE_PATH || './data/wisdom.db',

  wisdomSourceUrl: process.env.WISDOM_SOURCE_URL ||
    'https://raw.githubusercontent.com/merlinmann/wisdom/master/wisdom.md',
  syncHour: parseInt(process.env.SYNC_HOUR || '3', 10),

  apiKeyHeader: process.env.API_KEY_HEADER || 'X-API-Key',
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
  rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '60', 10),
  publicRateLimitWindowMs: parseInt(process.env.PUBLIC_RATE_LIMIT_WINDOW_MS || '60000', 10),
  publicRateLimitMaxRequests: parseInt(process.env.PUBLIC_RATE_LIMIT_MAX_REQUESTS || '10', 10),

  allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['*'],
  trustProxy: process.env.TRUST_PROXY === 'true',

  isDev: process.env.NODE_ENV !== 'production',
};
