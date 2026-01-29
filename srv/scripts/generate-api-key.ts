import { initDb, closeDb } from '../src/db/index.js';
import { generateApiKey } from '../src/services/apiKeyService.js';

function printUsage() {
  console.log('Usage: npm run generate-key -- [options]');
  console.log('');
  console.log('Options:');
  console.log('  --name <name>    Name/description for the key');
  console.log('  --admin          Generate an admin key');
  console.log('  --help           Show this help message');
}

function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help')) {
    printUsage();
    process.exit(0);
  }

  let name: string | undefined;
  let isAdmin = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--name' && args[i + 1]) {
      name = args[i + 1];
      i++;
    } else if (args[i] === '--admin') {
      isAdmin = true;
    }
  }

  // Initialize database
  initDb();

  // Generate the key
  const generated = generateApiKey(name, isAdmin);

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                    NEW API KEY GENERATED                   ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║  ID:     ${generated.id}`);
  console.log(`║  Name:   ${name || '(none)'}`);
  console.log(`║  Admin:  ${isAdmin ? 'Yes' : 'No'}`);
  console.log(`║  Prefix: ${generated.prefix}`);
  console.log('║                                                            ║');
  console.log(`║  Key: ${generated.key}`);
  console.log('║                                                            ║');
  console.log('║  IMPORTANT: Store this key securely!                       ║');
  console.log('║  It will NOT be shown again.                               ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Close database
  closeDb();
}

main();
