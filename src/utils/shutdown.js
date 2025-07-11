// Graceful shutdown utility that handles process termination signals and cleanup.
// Registers handlers for SIGTERM, SIGINT, and uncaught exceptions with timeout protection.
// src/utils/shutdown.js
import { appLogger } from '../services/logger.js';

export function registerGracefulShutdown(stopFn, options = {}) {
  let isShuttingDown = false;
  const FORCE_EXIT_TIMEOUT = options.forceExitTimeoutMs ?? 1_000;

  async function shutdown(signal, _error) {
    if (isShuttingDown) {
      appLogger.info('Shutdown already in progress...');
      return;
    }
    isShuttingDown = true;
    appLogger.info(`${signal} received — shutting down gracefully...`);

    // Prevent duplicate handlers
    process.removeAllListeners('SIGINT');
    process.removeAllListeners('SIGTERM');
    process.removeAllListeners('SIGUSR2');

    try {
      // Race your cleanup against a hard timeout
      await Promise.race([
        stopFn(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Shutdown timeout exceeded')), FORCE_EXIT_TIMEOUT),
        ),
      ]);
      appLogger.info('Graceful shutdown completed');
      process.exit(0);
    } catch (err) {
      appLogger.error({ err, stack: err && err.stack }, 'Error during shutdown:');
      process.exit(1);
    }
  }

  // Primary signals
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));

  // nodemon restarts on SIGUSR2
  process.once('SIGUSR2', () => shutdown('SIGUSR2'));

  // Uncaught failures
  process.once('uncaughtException', (err) => {
    appLogger.error('Uncaught exception:', err);
    shutdown('uncaughtException');
  });
  process.once('unhandledRejection', (reason, promise) => {
    appLogger.error('Unhandled rejection at:', promise, 'reason:', reason);
    shutdown('unhandledRejection');
  });
}
