import crypto from 'crypto';
import cron from 'node-cron';
import { getDb } from '../db/index.js';
import { config } from '../config.js';
import { parseWisdomMarkdown, type ParsedQuote } from './quoteParser.js';

interface SyncResult {
  success: boolean;
  quotesAdded: number;
  quotesUpdated: number;
  error?: string;
}

export async function fetchWisdomMarkdown(): Promise<string> {
  const response = await fetch(config.wisdomSourceUrl);

  if (!response.ok) {
    throw new Error(`Failed to fetch wisdom.md: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

export async function syncQuotesFromSource(): Promise<SyncResult> {
  const db = getDb();
  let quotesAdded = 0;
  let quotesUpdated = 0;

  try {
    const markdown = await fetchWisdomMarkdown();
    const { quotes, stats } = parseWisdomMarkdown(markdown);

    if (config.isDev) {
      console.log(`Parsed ${stats.quotesFound} quotes (${stats.relatedChains} with related chains)`);
    }

    // Begin transaction
    const insertQuote = db.prepare(`
      INSERT INTO quotes (content, content_hash, is_active)
      VALUES (?, ?, TRUE)
      ON CONFLICT(content_hash) DO UPDATE SET
        content = excluded.content,
        is_active = TRUE
    `);

    const insertRelation = db.prepare(`
      INSERT OR IGNORE INTO quote_relations (parent_quote_id, related_quote_id, relation_order)
      VALUES (?, ?, ?)
    `);

    const getQuoteByHash = db.prepare(`
      SELECT id FROM quotes WHERE content_hash = ?
    `);

    const transaction = db.transaction((quotes: ParsedQuote[]) => {
      // First, mark all quotes as potentially inactive
      // (we'll reactivate them as we process)
      // Skip this on first sync when table is empty
      const countResult = db.prepare('SELECT COUNT(*) as count FROM quotes').get() as { count: number };
      if (countResult.count > 0) {
        db.prepare('UPDATE quotes SET is_active = FALSE').run();
      }

      for (const quote of quotes) {
        // Insert or update the main quote
        const result = insertQuote.run(quote.content, quote.contentHash);

        if (result.changes > 0) {
          if (result.lastInsertRowid) {
            quotesAdded++;
          } else {
            quotesUpdated++;
          }
        }

        // Get the quote ID
        const quoteRow = getQuoteByHash.get(quote.contentHash) as { id: number } | undefined;
        if (!quoteRow) continue;

        const parentQuoteId = quoteRow.id;

        // Process related quotes
        for (let i = 0; i < quote.relatedQuotes.length; i++) {
          const relatedContent = quote.relatedQuotes[i];
          const relatedHash = crypto
            .createHash('sha256')
            .update(relatedContent)
            .digest('hex');

          // Insert the related quote
          insertQuote.run(relatedContent, relatedHash);

          // Get the related quote ID
          const relatedRow = getQuoteByHash.get(relatedHash) as { id: number } | undefined;
          if (!relatedRow) continue;

          // Create the relation
          insertRelation.run(parentQuoteId, relatedRow.id, i + 1);
        }
      }
    });

    transaction(quotes);

    // Log the sync
    db.prepare(`
      INSERT INTO sync_log (source_url, quotes_added, quotes_updated, success)
      VALUES (?, ?, ?, TRUE)
    `).run(config.wisdomSourceUrl, quotesAdded, quotesUpdated);

    if (config.isDev) {
      console.log(`Sync complete: ${quotesAdded} added, ${quotesUpdated} updated`);
    }

    return { success: true, quotesAdded, quotesUpdated };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Log the failed sync
    db.prepare(`
      INSERT INTO sync_log (source_url, success, error_message)
      VALUES (?, FALSE, ?)
    `).run(config.wisdomSourceUrl, errorMessage);

    console.error('Sync failed:', errorMessage);

    return { success: false, quotesAdded: 0, quotesUpdated: 0, error: errorMessage };
  }
}

export function getLastSyncTime(): Date | null {
  const db = getDb();
  const row = db.prepare(`
    SELECT sync_timestamp FROM sync_log
    WHERE success = TRUE
    ORDER BY sync_timestamp DESC
    LIMIT 1
  `).get() as { sync_timestamp: string } | undefined;

  return row ? new Date(row.sync_timestamp) : null;
}

export function shouldSync(): boolean {
  const lastSync = getLastSyncTime();

  if (!lastSync) {
    return true; // Never synced
  }

  // Check if last sync was more than 24 hours ago
  const hoursSinceSync = (Date.now() - lastSync.getTime()) / (1000 * 60 * 60);
  return hoursSinceSync >= 24;
}

export async function syncIfNeeded(): Promise<void> {
  if (shouldSync()) {
    console.log('Syncing quotes from source...');
    await syncQuotesFromSource();
  }
}

let cronJob: cron.ScheduledTask | null = null;

export function startSyncScheduler(): void {
  if (cronJob) {
    return; // Already started
  }

  // Schedule daily sync at configured hour
  const cronExpression = `0 ${config.syncHour} * * *`;

  cronJob = cron.schedule(cronExpression, async () => {
    console.log('Running scheduled sync...');
    await syncQuotesFromSource();
  });

  console.log(`Sync scheduler started (runs daily at ${config.syncHour}:00)`);
}

export function stopSyncScheduler(): void {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
  }
}
