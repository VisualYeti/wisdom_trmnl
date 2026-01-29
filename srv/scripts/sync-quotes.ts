import { initDb, closeDb } from '../src/db/index.js';
import { syncQuotesFromSource, getLastSyncTime } from '../src/services/syncService.js';
import { getQuoteStats } from '../src/services/quoteService.js';

async function main() {
  console.log('=== Manual Quote Sync ===\n');

  // Initialize database
  initDb();

  // Show current stats
  const statsBefore = getQuoteStats();
  const lastSync = getLastSyncTime();

  console.log('Current state:');
  console.log(`  Total quotes: ${statsBefore.totalQuotes}`);
  console.log(`  Active quotes: ${statsBefore.activeQuotes}`);
  console.log(`  Served this cycle: ${statsBefore.servedQuotes}`);
  console.log(`  Last sync: ${lastSync?.toISOString() || 'Never'}\n`);

  // Sync
  console.log('Syncing from source...');
  const result = await syncQuotesFromSource();

  if (result.success) {
    console.log(`\nSync complete!`);
    console.log(`  Quotes added: ${result.quotesAdded}`);
    console.log(`  Quotes updated: ${result.quotesUpdated}`);

    // Show updated stats
    const statsAfter = getQuoteStats();
    console.log(`\nUpdated state:`);
    console.log(`  Total quotes: ${statsAfter.totalQuotes}`);
    console.log(`  Active quotes: ${statsAfter.activeQuotes}`);
  } else {
    console.log(`\nSync failed: ${result.error}`);
  }

  // Close database
  closeDb();
}

main().catch((error) => {
  console.error('Sync failed:', error);
  process.exit(1);
});
