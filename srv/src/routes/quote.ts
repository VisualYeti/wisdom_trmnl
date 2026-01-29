import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireApiKey } from '../middleware/auth.js';
import { getTodayQuote, getRandomQuote } from '../services/quoteService.js';
import { config } from '../config.js';
import { publicIpStore } from '../services/rateLimitStore.js';

const router = Router();

// Rate limiter for public endpoint (stricter - by IP)
const publicRateLimiter = rateLimit({
  windowMs: config.publicRateLimitWindowMs,
  max: config.publicRateLimitMaxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  store: publicIpStore,
  validate: { xForwardedForHeader: false },
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests. Please try again later.',
    },
  },
});

// GET /api/v1/quote/public - Public endpoint (no API key required)
router.get('/quote/public', publicRateLimiter, (req, res) => {
  try {
    const quote = getTodayQuote();

    if (!quote) {
      res.status(503).json({
        success: false,
        error: {
          code: 'NO_QUOTES_AVAILABLE',
          message: 'No quotes are currently available.',
        },
      });
      return;
    }

    // Cache for 10 minutes
    res.set('Cache-Control', 'public, max-age=600');

    // Simplified response for public endpoint (no cycle_progress)
    res.json({
      success: true,
      data: {
        quote: quote.quote,
        quote_html: quote.quoteHtml,
        date: quote.date,
      },
      meta: {
        timestamp: new Date().toISOString(),
        cache_until: getNextMidnight().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error getting public quote:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An internal error occurred.',
      },
    });
  }
});

// GET /api/v1/quote - Get today's quote (authenticated)
router.get('/quote', requireApiKey, (req, res) => {
  try {
    const quote = getTodayQuote();

    if (!quote) {
      res.status(503).json({
        success: false,
        error: {
          code: 'NO_QUOTES_AVAILABLE',
          message: 'No quotes are currently available. The server may need to sync.',
        },
      });
      return;
    }

    res.json({
      success: true,
      data: {
        quote: quote.quote,
        quote_html: quote.quoteHtml,
        id: quote.id,
        date: quote.date,
        is_related: quote.isRelated,
        chain_info: quote.chainInfo,
        cycle_progress: quote.cycleProgress,
      },
      meta: {
        timestamp: new Date().toISOString(),
        cache_until: getNextMidnight().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error getting today\'s quote:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An internal error occurred.',
      },
    });
  }
});

// GET /api/v1/quote/random - Get a random quote (doesn't affect daily tracking)
router.get('/quote/random', requireApiKey, (req, res) => {
  try {
    const quote = getRandomQuote();

    if (!quote) {
      res.status(503).json({
        success: false,
        error: {
          code: 'NO_QUOTES_AVAILABLE',
          message: 'No quotes are currently available.',
        },
      });
      return;
    }

    res.json({
      success: true,
      data: {
        quote: quote.quote,
        quote_html: quote.quoteHtml,
        id: quote.id,
        date: quote.date,
        is_related: false,
        chain_info: null,
        cycle_progress: quote.cycleProgress,
      },
    });
  } catch (error) {
    console.error('Error getting random quote:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An internal error occurred.',
      },
    });
  }
});

function getNextMidnight(): Date {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow;
}

export default router;
