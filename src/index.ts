import { PrismaClient } from '@prisma/client';
import app from './app';
import { env } from './config/env';
import { logger } from './utils/logger';
import { startSyncScheduler } from './jobs/sync-scheduler.job';
import { startCleanupJob } from './jobs/cleanup.job';
import { autoSeed } from './utils/auto-seed';

const prisma = new PrismaClient();

const server = app.listen(env.PORT, async () => {
  logger.info(`BizVentas API running on port ${env.PORT} [${env.NODE_ENV}]`);

  // Auto-seed si la DB está vacía
  try {
    await autoSeed(prisma);
  } catch (err) {
    logger.error('Auto-seed failed (non-fatal)', err);
  }

  // Iniciar jobs programados
  startSyncScheduler();
  startCleanupJob();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down...');
  server.close(() => process.exit(0));
});
