import app from './app';
import { env } from './config/env';
import { logger } from './utils/logger';
import { startSyncScheduler } from './jobs/sync-scheduler.job';
import { startCleanupJob } from './jobs/cleanup.job';

const server = app.listen(env.PORT, () => {
  logger.info(`BizVentas API running on port ${env.PORT} [${env.NODE_ENV}]`);

  // Iniciar jobs programados
  startSyncScheduler();
  startCleanupJob();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down...');
  server.close(() => process.exit(0));
});
