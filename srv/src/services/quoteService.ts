import { getDb } from '../db/index.js';
import { markdownToHtml } from './quoteParser.js';

interface Quote {
  id: number;
  content: string;
  is_active: boolean;
}

interface DailyQuoteRecord {
  id: number;
  quote_id: number;
  quote_date: string;
  is_related: boolean;
  parent_chain_id: number | null;
  chain_position: number;
}

interface RelatedQuote {
  id: number;
  parent_quote_id: number;
  related_quote_id: number;
  relation_order: number;
  content: string;
}

export interface QuoteResponse {
  quote: string;
  quoteHtml: string;
  id: number;
  date: string;
  isRelated: boolean;
  chainInfo: {
    parentQuote: string;
    position: number;
    totalInChain: number;
  } | null;
  cycleProgress: {
    served: number;
    total: number;
  };
}

function getTodayDateString(): string {
  const now = new Date();
  return now.toISOString().slice(0, 10); // "YYYY-MM-DD"
}

function getYesterdayDateString(): string {
  const now = new Date();
  now.setDate(now.getDate() - 1);
  return now.toISOString().slice(0, 10);
}

function getCycleProgress(): { served: number; total: number } {
  const db = getDb();

  const totalResult = db.prepare(`
    SELECT COUNT(*) as count FROM quotes WHERE is_active = TRUE
  `).get() as { count: number };

  const servedResult = db.prepare(`
    SELECT COUNT(DISTINCT quote_id) as count FROM served_quotes
  `).get() as { count: number };

  return {
    served: servedResult.count,
    total: totalResult.count,
  };
}

function getQuoteById(id: number): Quote | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM quotes WHERE id = ?').get(id) as Quote | undefined;
}

function getDailyQuote(date: string): DailyQuoteRecord | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM daily_quote WHERE quote_date = ?').get(date) as DailyQuoteRecord | undefined;
}

function saveDailyQuote(
  date: string,
  quoteId: number,
  isRelated: boolean,
  parentChainId: number | null,
  chainPosition: number
): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO daily_quote (quote_date, quote_id, is_related, parent_chain_id, chain_position)
    VALUES (?, ?, ?, ?, ?)
  `).run(date, quoteId, isRelated ? 1 : 0, parentChainId, chainPosition);
}

function markAsServed(quoteId: number, date: string): void {
  const db = getDb();
  db.prepare(`
    INSERT OR IGNORE INTO served_quotes (quote_id, served_date)
    VALUES (?, ?)
  `).run(quoteId, date);
}

function getRelatedQuotes(parentQuoteId: number): RelatedQuote[] {
  const db = getDb();
  return db.prepare(`
    SELECT qr.*, q.content
    FROM quote_relations qr
    JOIN quotes q ON qr.related_quote_id = q.id
    WHERE qr.parent_quote_id = ?
    ORDER BY qr.relation_order
  `).all(parentQuoteId) as RelatedQuote[];
}

function resetCycleIfNeeded(): boolean {
  const db = getDb();

  // Count unserved active quotes
  const unservedResult = db.prepare(`
    SELECT COUNT(*) as count FROM quotes q
    WHERE q.is_active = TRUE
    AND q.id NOT IN (SELECT quote_id FROM served_quotes)
  `).get() as { count: number };

  if (unservedResult.count === 0) {
    // Reset the cycle
    db.prepare('DELETE FROM served_quotes').run();
    console.log('Quote cycle reset - all quotes have been served');
    return true;
  }

  return false;
}

function selectRandomUnservedQuote(): Quote | undefined {
  const db = getDb();

  // Select a random unserved quote that is either:
  // 1. Not a related quote (standalone)
  // 2. A parent quote (has related quotes itself)
  // This prevents selecting quotes that only appear as "Related:" entries
  const quote = db.prepare(`
    SELECT q.* FROM quotes q
    WHERE q.is_active = TRUE
    AND q.id NOT IN (SELECT quote_id FROM served_quotes)
    AND (
      q.id NOT IN (SELECT related_quote_id FROM quote_relations)
      OR q.id IN (SELECT parent_quote_id FROM quote_relations)
    )
    ORDER BY RANDOM()
    LIMIT 1
  `).get() as Quote | undefined;

  return quote;
}

export function getTodayQuote(): QuoteResponse | null {
  const db = getDb();
  const today = getTodayDateString();

  // 1. Check if we already have today's quote cached
  const cachedDaily = getDailyQuote(today);
  if (cachedDaily) {
    const quote = getQuoteById(cachedDaily.quote_id);
    if (quote) {
      let chainInfo = null;
      if (cachedDaily.is_related && cachedDaily.parent_chain_id) {
        const parentQuote = getQuoteById(cachedDaily.parent_chain_id);
        const totalInChain = getRelatedQuotes(cachedDaily.parent_chain_id).length;
        chainInfo = {
          parentQuote: parentQuote?.content || '',
          position: cachedDaily.chain_position,
          totalInChain,
        };
      }

      return {
        quote: quote.content,
        quoteHtml: markdownToHtml(quote.content),
        id: quote.id,
        date: today,
        isRelated: cachedDaily.is_related,
        chainInfo,
        cycleProgress: getCycleProgress(),
      };
    }
  }

  // 2. Check if we need to continue a Related: chain from yesterday
  const yesterday = getYesterdayDateString();
  const yesterdayRecord = getDailyQuote(yesterday);

  if (yesterdayRecord) {
    if (!yesterdayRecord.is_related) {
      // Yesterday was a main quote - check if it has related quotes
      const relatedChain = getRelatedQuotes(yesterdayRecord.quote_id);

      if (relatedChain.length > 0) {
        // Start the related chain - serve first related quote
        const nextQuote = relatedChain[0];
        saveDailyQuote(today, nextQuote.related_quote_id, true, yesterdayRecord.quote_id, 1);
        markAsServed(nextQuote.related_quote_id, today);

        const quote = getQuoteById(nextQuote.related_quote_id);
        if (quote) {
          return {
            quote: quote.content,
            quoteHtml: markdownToHtml(quote.content),
            id: quote.id,
            date: today,
            isRelated: true,
            chainInfo: {
              parentQuote: getQuoteById(yesterdayRecord.quote_id)?.content || '',
              position: 1,
              totalInChain: relatedChain.length,
            },
            cycleProgress: getCycleProgress(),
          };
        }
      }
    } else if (yesterdayRecord.parent_chain_id) {
      // We're mid-chain - try to continue
      const nextPosition = yesterdayRecord.chain_position + 1;
      const relatedChain = getRelatedQuotes(yesterdayRecord.parent_chain_id);

      const nextInChain = relatedChain.find((r) => r.relation_order === nextPosition);

      if (nextInChain) {
        // Continue the chain
        saveDailyQuote(today, nextInChain.related_quote_id, true, yesterdayRecord.parent_chain_id, nextPosition);
        markAsServed(nextInChain.related_quote_id, today);

        const quote = getQuoteById(nextInChain.related_quote_id);
        if (quote) {
          return {
            quote: quote.content,
            quoteHtml: markdownToHtml(quote.content),
            id: quote.id,
            date: today,
            isRelated: true,
            chainInfo: {
              parentQuote: getQuoteById(yesterdayRecord.parent_chain_id)?.content || '',
              position: nextPosition,
              totalInChain: relatedChain.length,
            },
            cycleProgress: getCycleProgress(),
          };
        }
      }
      // Chain is complete, fall through to random selection
    }
  }

  // 3. No chain to continue - select a new random quote
  resetCycleIfNeeded();

  const randomQuote = selectRandomUnservedQuote();
  if (!randomQuote) {
    return null; // No quotes available
  }

  saveDailyQuote(today, randomQuote.id, false, null, 0);
  markAsServed(randomQuote.id, today);

  return {
    quote: randomQuote.content,
    quoteHtml: markdownToHtml(randomQuote.content),
    id: randomQuote.id,
    date: today,
    isRelated: false,
    chainInfo: null,
    cycleProgress: getCycleProgress(),
  };
}

export function getRandomQuote(): QuoteResponse | null {
  const db = getDb();
  const today = getTodayDateString();

  // Exclude quotes that only appear as related quotes (not parent quotes)
  const quote = db.prepare(`
    SELECT q.* FROM quotes q
    WHERE q.is_active = TRUE
    AND (
      q.id NOT IN (SELECT related_quote_id FROM quote_relations)
      OR q.id IN (SELECT parent_quote_id FROM quote_relations)
    )
    ORDER BY RANDOM()
    LIMIT 1
  `).get() as Quote | undefined;

  if (!quote) {
    return null;
  }

  return {
    quote: quote.content,
    quoteHtml: markdownToHtml(quote.content),
    id: quote.id,
    date: today,
    isRelated: false,
    chainInfo: null,
    cycleProgress: getCycleProgress(),
  };
}

export function getQuoteStats(): {
  totalQuotes: number;
  activeQuotes: number;
  servedQuotes: number;
  relatedChains: number;
} {
  const db = getDb();

  const total = (db.prepare('SELECT COUNT(*) as count FROM quotes').get() as { count: number }).count;
  const active = (db.prepare('SELECT COUNT(*) as count FROM quotes WHERE is_active = TRUE').get() as { count: number }).count;
  const served = (db.prepare('SELECT COUNT(DISTINCT quote_id) as count FROM served_quotes').get() as { count: number }).count;
  const chains = (db.prepare('SELECT COUNT(DISTINCT parent_quote_id) as count FROM quote_relations').get() as { count: number }).count;

  return {
    totalQuotes: total,
    activeQuotes: active,
    servedQuotes: served,
    relatedChains: chains,
  };
}

export function resetServedQuotes(): void {
  const db = getDb();
  db.prepare('DELETE FROM served_quotes').run();
  db.prepare('DELETE FROM daily_quote').run();
  console.log('Served quotes and daily quote cache reset');
}
