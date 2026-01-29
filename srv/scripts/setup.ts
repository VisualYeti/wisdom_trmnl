import { initDb, closeDb } from '../src/db/index.js';
import { generateApiKey, hasActiveAdminKey } from '../src/services/apiKeyService.js';
import { syncQuotesFromSource } from '../src/services/syncService.js';

async function setup() {
  console.log('=== Wisdom Quote Server Setup ===\n');

  // Initialize database
  console.log('1. Initializing database...');
  initDb();
  console.log('   Database initialized.\n');

  // Generate admin API key if none exists
  console.log('2. Checking for admin API key...');
  if (hasActiveAdminKey()) {
    console.log('   Admin API key already exists.\n');
  } else {
    console.log('   No admin key found. Generating new admin API key...\n');
    const generated = generateApiKey('Initial Admin Key', true);

    console.log('   ╔════════════════════════════════════════════════════════════╗');
    console.log('   ║                    ADMIN API KEY GENERATED                 ║');
    console.log('   ╠════════════════════════════════════════════════════════════╣');
    console.log(`   ║  Key: ${generated.key}`);
    console.log('   ║                                                            ║');
    console.log('   ║  IMPORTANT: Store this key securely!                       ║');
    console.log('   ║  It will NOT be shown again.                               ║');
    console.log('   ╚════════════════════════════════════════════════════════════╝\n');
  }

  // Sync quotes from source
  console.log('3. Syncing quotes from wisdom.md...');
  const result = await syncQuotesFromSource();

  if (result.success) {
    console.log(`   Sync complete: ${result.quotesAdded} quotes added, ${result.quotesUpdated} updated.\n`);
  } else {
    console.log(`   Sync failed: ${result.error}\n`);
  }

  // Close database
  closeDb();

  console.log('=== Setup Complete ===');
  console.log('\nTo start the server, run:');
  console.log('  npm run dev     (development with hot reload)');
  console.log('  npm start       (production)\n');
}

setup().catch((error) => {
  console.error('Setup failed:', error);
  process.exit(1);
});
