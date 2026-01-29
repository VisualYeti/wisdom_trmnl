import { Router } from 'express';
import { requireAdminKey } from '../middleware/auth.js';
import {
  generateApiKey,
  listApiKeys,
  invalidateApiKey,
} from '../services/apiKeyService.js';
import { syncQuotesFromSource, getLastSyncTime } from '../services/syncService.js';
import { getQuoteStats, resetServedQuotes } from '../services/quoteService.js';
import { apiKeyStore, publicIpStore } from '../services/rateLimitStore.js';

const router = Router();

// POST /api/v1/admin/keys - Generate a new API key
router.post('/keys', requireAdminKey, (req, res) => {
  try {
    const { name, is_admin } = req.body || {};

    const generated = generateApiKey(name, is_admin === true);

    res.status(201).json({
      success: true,
      data: {
        id: generated.id,
        key: generated.key, // Only shown once!
        prefix: generated.prefix,
        name: name || null,
        is_admin: is_admin === true,
        message: 'Store this key securely. It will not be shown again.',
      },
    });
  } catch (error) {
    console.error('Error generating API key:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to generate API key.',
      },
    });
  }
});

// GET /api/v1/admin/keys - List all API keys
router.get('/keys', requireAdminKey, (req, res) => {
  try {
    const keys = listApiKeys();

    res.json({
      success: true,
      data: keys.map((k) => ({
        id: k.id,
        prefix: k.key_prefix,
        name: k.name,
        is_admin: k.is_admin,
        is_active: k.is_active,
        created_at: k.created_at,
        last_used_at: k.last_used_at,
        invalidated_at: k.invalidated_at,
      })),
    });
  } catch (error) {
    console.error('Error listing API keys:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to list API keys.',
      },
    });
  }
});

// DELETE /api/v1/admin/keys/:id - Invalidate an API key
router.delete('/keys/:id', requireAdminKey, (req, res) => {
  try {
    const id = parseInt(req.params.id as string, 10);

    if (isNaN(id)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ID',
          message: 'Invalid key ID.',
        },
      });
      return;
    }

    // Prevent invalidating your own key
    if (req.apiKey?.id === id) {
      res.status(400).json({
        success: false,
        error: {
          code: 'CANNOT_INVALIDATE_SELF',
          message: 'You cannot invalidate your own API key.',
        },
      });
      return;
    }

    const success = invalidateApiKey(id);

    if (!success) {
      res.status(404).json({
        success: false,
        error: {
          code: 'KEY_NOT_FOUND',
          message: 'API key not found.',
        },
      });
      return;
    }

    res.json({
      success: true,
      data: { message: 'API key invalidated successfully.' },
    });
  } catch (error) {
    console.error('Error invalidating API key:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to invalidate API key.',
      },
    });
  }
});

// POST /api/v1/admin/sync - Force re-sync quotes from source
router.post('/sync', requireAdminKey, async (req, res) => {
  try {
    const result = await syncQuotesFromSource();

    res.json({
      success: result.success,
      data: {
        quotes_added: result.quotesAdded,
        quotes_updated: result.quotesUpdated,
        error: result.error,
      },
    });
  } catch (error) {
    console.error('Error syncing quotes:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to sync quotes.',
      },
    });
  }
});

// GET /api/v1/admin/stats - Get quote statistics
router.get('/stats', requireAdminKey, (req, res) => {
  try {
    const stats = getQuoteStats();
    const lastSync = getLastSyncTime();

    res.json({
      success: true,
      data: {
        ...stats,
        lastSyncTime: lastSync?.toISOString() || null,
      },
    });
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get statistics.',
      },
    });
  }
});

// POST /api/v1/admin/reset-cycle - Reset the served quotes cycle
router.post('/reset-cycle', requireAdminKey, (req, res) => {
  try {
    resetServedQuotes();

    res.json({
      success: true,
      data: { message: 'Quote cycle reset successfully.' },
    });
  } catch (error) {
    console.error('Error resetting cycle:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to reset cycle.',
      },
    });
  }
});

// GET /api/v1/admin/rate-limits/keys - Get rate limit status for API keys
router.get('/rate-limits/keys', requireAdminKey, (req, res) => {
  try {
    const limitedOnly = req.query.limited === 'true';
    const status = limitedOnly ? apiKeyStore.getLimitedOnly() : apiKeyStore.getStatus();

    res.json({
      success: true,
      data: {
        entries: status,
        total: status.length,
        limited_count: status.filter((s) => s.isLimited).length,
      },
    });
  } catch (error) {
    console.error('Error getting API key rate limits:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get rate limit status.',
      },
    });
  }
});

// GET /api/v1/admin/rate-limits/public - Get rate limit status for public IPs
router.get('/rate-limits/public', requireAdminKey, (req, res) => {
  try {
    const limitedOnly = req.query.limited === 'true';
    const status = limitedOnly ? publicIpStore.getLimitedOnly() : publicIpStore.getStatus();

    res.json({
      success: true,
      data: {
        entries: status,
        total: status.length,
        limited_count: status.filter((s) => s.isLimited).length,
      },
    });
  } catch (error) {
    console.error('Error getting public rate limits:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get rate limit status.',
      },
    });
  }
});

export default router;
