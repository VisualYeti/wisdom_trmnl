import { config } from './config.js';
import { initDb, closeDb } from './db/index.js';
import { syncIfNeeded, startSyncScheduler, stopSyncScheduler } from './services/syncService.js';
import app from './app.js';

async function main() {
  console.log('Starting Wisdom Quote Server...');
  console.log(`Environment: ${config.nodeEnv}`);

  // Initialize database
  initDb();

  // Sync quotes if needed (on startup)
  await syncIfNeeded();

  // Start the sync scheduler
  startSyncScheduler();

  // Start the server
  const server = app.listen(config.port, config.host, () => {
    console.log(`Server listening on http://${config.host}:${config.port}`);
    console.log(`API endpoint: http://${config.host}:${config.port}/api/v1/quote`);
  });

  // Graceful shutdown
  const shutdown = () => {
    console.log('\nShutting down...');
    stopSyncScheduler();
    server.close(() => {
      closeDb();
      console.log('Server stopped.');
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
