import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { ErpBridgeService } from '../services/erp-bridge.service';
import { SyncService } from '../services/sync.service';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();
const erpBridge = new ErpBridgeService();
const syncService = new SyncService();

async function getLastSyncDate(tenantId: string, entityType: string): Promise<Date | undefined> {
  const lastLog = await prisma.syncLog.findFirst({
    where: { tenantId, entityType, status: 'success', direction: 'pull' },
    orderBy: { finishedAt: 'desc' },
    select: { finishedAt: true },
  });
  return lastLog?.finishedAt ?? undefined;
}

async function syncTenant(tenantId: string) {
  // 1. Pull desde ERP por entidad con lastSync
  const entityTypes = ['productos', 'clientes', 'stock'] as const;
  for (const entityType of entityTypes) {
    try {
      const lastSync = await getLastSyncDate(tenantId, entityType);
      await erpBridge.syncFromErp(tenantId, entityType, lastSync);
    } catch (err) {
      logger.error(`Sync pull ${entityType} failed for tenant ${tenantId}`, err);
    }
  }

  // 2. Push pendientes (pedidos, cobranzas, devoluciones)
  try {
    await syncService.pushPendingToErp(tenantId);
  } catch (err) {
    logger.error(`Sync push failed for tenant ${tenantId}`, err);
  }

  // 3. Reintentar pedidos que fallaron previamente
  try {
    const failedPedidos = await prisma.pedido.findMany({
      where: { tenantId, erpSynced: false, erpError: { not: null }, estado: 'confirmado' },
      select: { id: true },
      take: 10,
    });
    for (const pedido of failedPedidos) {
      try {
        await erpBridge.syncPedidoToErp(tenantId, pedido.id);
        logger.info(`Retry pedido ${pedido.id} succeeded`);
      } catch (err) {
        logger.warn(`Retry pedido ${pedido.id} failed again`, err);
      }
    }
  } catch (err) {
    logger.error(`Retry pedidos failed for tenant ${tenantId}`, err);
  }

  // 4. Reintentar cobranzas que fallaron previamente
  try {
    const failedCobranzas = await prisma.cobranza.findMany({
      where: { tenantId, erpSynced: false },
      select: { id: true },
      take: 10,
    });
    for (const cobranza of failedCobranzas) {
      try {
        await erpBridge.syncCobranzaToErp(tenantId, cobranza.id);
        logger.info(`Retry cobranza ${cobranza.id} succeeded`);
      } catch (err) {
        logger.warn(`Retry cobranza ${cobranza.id} failed again`, err);
      }
    }
  } catch (err) {
    logger.error(`Retry cobranzas failed for tenant ${tenantId}`, err);
  }
}

export function startSyncScheduler() {
  // Cada 30 minutos: sync completo por tenant
  cron.schedule('*/30 * * * *', async () => {
    logger.info('Sync scheduler: starting');
    const tenants = await prisma.tenant.findMany({
      where: { estado: 'activo', erpTipo: { not: 'standalone' } },
    });

    for (const tenant of tenants) {
      try {
        await syncTenant(tenant.id);
      } catch (err) {
        logger.error(`Sync scheduler failed for tenant ${tenant.id}`, err);
      }
    }
    logger.info('Sync scheduler: finished');
  });

  logger.info('Sync scheduler started (every 30 min)');
}
