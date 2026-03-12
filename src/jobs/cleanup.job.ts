import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { cleanupTempFiles } from '../services/import.service';

const prisma = new PrismaClient();

export function startCleanupJob() {
  // Todos los días a las 3 AM
  cron.schedule('0 3 * * *', async () => {
    logger.info('Cleanup job: starting');

    // 1. Borrar GPS points > 90 días
    try {
      const gpsCutoff = new Date();
      gpsCutoff.setDate(gpsCutoff.getDate() - 90);
      const gpsResult = await prisma.gpsPoint.deleteMany({ where: { timestamp: { lt: gpsCutoff } } });
      logger.info(`Cleanup: deleted ${gpsResult.count} old GPS points`);
    } catch (err) {
      logger.error('Cleanup GPS points failed', err);
    }

    // 2. Borrar sync logs > 30 días
    try {
      const syncCutoff = new Date();
      syncCutoff.setDate(syncCutoff.getDate() - 30);
      const syncResult = await prisma.syncLog.deleteMany({ where: { startedAt: { lt: syncCutoff } } });
      logger.info(`Cleanup: deleted ${syncResult.count} old sync logs`);
    } catch (err) {
      logger.error('Cleanup sync logs failed', err);
    }

    // 3. Recalcular saldos de clientes
    try {
      const clientes = await prisma.cliente.findMany({
        where: { activo: true },
        select: { id: true, tenantId: true },
      });

      let updated = 0;
      for (const cliente of clientes) {
        const movimientos = await prisma.cuentaCorriente.aggregate({
          where: { clienteId: cliente.id, tenantId: cliente.tenantId },
          _sum: { debe: true, haber: true },
        });

        const debe = movimientos._sum.debe || 0;
        const haber = movimientos._sum.haber || 0;
        const saldo = debe - haber;

        await prisma.cliente.update({
          where: { id: cliente.id },
          data: { saldoCuenta: saldo },
        });
        updated++;
      }
      logger.info(`Cleanup: recalculated ${updated} client balances`);
    } catch (err) {
      logger.error('Cleanup recalculate balances failed', err);
    }

    // 4. Limpiar archivos temporales de importación (> 1 hora)
    try {
      cleanupTempFiles();
    } catch (err) {
      logger.error('Cleanup import temp files failed', err);
    }

    // 5. Borrar import logs > 90 días
    try {
      const importCutoff = new Date();
      importCutoff.setDate(importCutoff.getDate() - 90);
      const importResult = await prisma.importLog.deleteMany({ where: { createdAt: { lt: importCutoff } } });
      if (importResult.count > 0) {
        logger.info(`Cleanup: deleted ${importResult.count} old import logs`);
      }
    } catch (err) {
      logger.error('Cleanup import logs failed', err);
    }

    logger.info('Cleanup job: finished');
  });

  // Limpiar archivos temporales de importación cada hora
  cron.schedule('0 * * * *', () => {
    cleanupTempFiles();
  });

  logger.info('Cleanup job started (daily at 3 AM + hourly import cleanup)');
}
