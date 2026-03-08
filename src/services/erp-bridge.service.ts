import { PrismaClient } from '@prisma/client';
import { createAdapter } from '../erp-adapters/adapter-factory';
import { ErpAdapter } from '../erp-adapters/erp-adapter.interface';
import { logger } from '../utils/logger';
import { NotFoundError, SyncError } from '../utils/errors';

const prisma = new PrismaClient();

export class ErpBridgeService {

  // ─── Helper ─────────────────────────────────────────────

  private async getAdapter(tenantId: string): Promise<{ tenant: { id: string; erpTipo: string }; adapter: ErpAdapter }> {
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    const adapter = await createAdapter(tenant);
    return { tenant, adapter };
  }

  // ─── Conexión ─────────────────────────────────────────

  async testConnection(tenantId: string): Promise<boolean> {
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    if (tenant.erpTipo === 'standalone') return true;

    const adapter = await createAdapter(tenant);
    const ok = await adapter.testConnection();
    logger.info(`ERP connection test tenant=${tenantId} type=${tenant.erpTipo} result=${ok}`);
    return ok;
  }

  async getAdapterInfo(tenantId: string) {
    const tenant = await prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { erpTipo: true, erpUrl: true },
    });
    return { erpTipo: tenant.erpTipo, erpUrl: tenant.erpUrl };
  }

  // ─── Sync genérico desde ERP ──────────────────────────

  async syncFromErp(tenantId: string, entityType: 'productos' | 'clientes' | 'precios' | 'stock', since?: Date) {
    const { adapter } = await this.getAdapter(tenantId);
    let count = 0;

    const syncLog = await prisma.syncLog.create({
      data: { tenantId, userId: 'system', direction: 'pull', entityType, status: 'success' },
    });

    try {
      switch (entityType) {
        case 'productos': {
          const items = await adapter.fetchProductos(since);
          for (const p of items) {
            await prisma.producto.upsert({
              where: { tenantId_codigo: { tenantId, codigo: p.codigo } },
              update: {
                nombre: p.nombre, descripcion: p.descripcion, precioLista: p.precio,
                stockUnidad: p.stock, unidadMedida: p.unidad || 'UN', categoria: p.categoria, erpId: p.erpId,
              },
              create: {
                tenantId, erpId: p.erpId, codigo: p.codigo, nombre: p.nombre,
                descripcion: p.descripcion, precioLista: p.precio, stockUnidad: p.stock,
                unidadMedida: p.unidad || 'UN', categoria: p.categoria,
              },
            });
            count++;
          }
          break;
        }
        case 'clientes': {
          const items = await adapter.fetchClientes(since);
          for (const c of items) {
            await prisma.cliente.upsert({
              where: { tenantId_codigo: { tenantId, codigo: c.codigo } },
              update: {
                nombre: c.razonSocial, cuit: c.cuit, direccion: c.direccion,
                telefono: c.telefono, email: c.email, listaPrecioId: c.listaPrecio, erpId: c.erpId,
              },
              create: {
                tenantId, erpId: c.erpId, codigo: c.codigo, nombre: c.razonSocial,
                cuit: c.cuit, direccion: c.direccion, telefono: c.telefono, email: c.email,
                listaPrecioId: c.listaPrecio,
              },
            });
            count++;
          }
          break;
        }
        case 'precios': {
          const items = await adapter.fetchPrecios(since);
          count = items.length;
          break;
        }
        case 'stock': {
          const items = await adapter.fetchStock();
          for (const s of items) {
            const producto = await prisma.producto.findFirst({
              where: { tenantId, erpId: s.productoErpId },
            });
            if (producto) {
              await prisma.producto.update({
                where: { id: producto.id },
                data: { stockUnidad: s.cantidad },
              });
              count++;
            }
          }
          break;
        }
      }

      await prisma.syncLog.update({
        where: { id: syncLog.id },
        data: { recordCount: count, finishedAt: new Date() },
      });
    } catch (err) {
      await prisma.syncLog.update({
        where: { id: syncLog.id },
        data: { status: 'error', errorDetail: (err as Error).message, finishedAt: new Date() },
      });
      throw new SyncError(`Error al sincronizar ${entityType} desde ERP: ${(err as Error).message}`);
    }

    logger.info(`ERP sync pull ${entityType} tenant=${tenantId}: ${count} registros`);
    return { entityType, count };
  }

  // ─── Push individual: Pedido ──────────────────────────

  async syncPedidoToErp(tenantId: string, pedidoId: string) {
    const { adapter } = await this.getAdapter(tenantId);

    const pedido = await prisma.pedido.findFirst({
      where: { id: pedidoId, tenantId },
      include: { items: true, cliente: true },
    });
    if (!pedido) throw new NotFoundError('Pedido no encontrado');

    try {
      const result = await adapter.pushPedido({
        clienteErpId: pedido.cliente.erpId || pedido.cliente.codigo,
        observacion: pedido.observaciones || undefined,
        items: pedido.items.map((i) => ({
          productoErpId: i.productoId,
          cantidad: i.cantidad,
          precio: i.precioUnitario,
          descuento: i.descuentoPorcentaje,
        })),
      });
      await prisma.pedido.update({
        where: { id: pedido.id },
        data: { erpSynced: true, erpId: result.erpId, estado: 'enviado_erp', erpError: null },
      });
      return result;
    } catch (err) {
      await prisma.pedido.update({
        where: { id: pedido.id },
        data: { erpError: (err as Error).message },
      });
      throw new SyncError(`Error al enviar pedido al ERP: ${(err as Error).message}`);
    }
  }

  // ─── Push individual: Cobranza ────────────────────────

  async syncCobranzaToErp(tenantId: string, cobranzaId: string) {
    const { adapter } = await this.getAdapter(tenantId);

    const cobranza = await prisma.cobranza.findFirst({
      where: { id: cobranzaId, tenantId },
      include: { cliente: true, medios: true },
    });
    if (!cobranza) throw new NotFoundError('Cobranza no encontrada');

    const medioPrincipal = cobranza.medios[0];
    const result = await adapter.pushCobranza({
      clienteErpId: cobranza.cliente.erpId || cobranza.cliente.codigo,
      monto: cobranza.total,
      medioPago: medioPrincipal?.tipo || 'efectivo',
      referencia: undefined,
    });

    await prisma.cobranza.update({
      where: { id: cobranza.id },
      data: { erpSynced: true, erpId: result.erpId },
    });

    return result;
  }

  // ─── Push individual: Devolución ──────────────────────

  async syncDevolucionToErp(tenantId: string, devolucionId: string) {
    const { adapter } = await this.getAdapter(tenantId);

    const devolucion = await prisma.devolucion.findFirst({
      where: { id: devolucionId, tenantId },
      include: { items: true },
    });
    if (!devolucion) throw new NotFoundError('Devolución no encontrada');

    // Lookup del erpId del cliente
    const cliente = await prisma.cliente.findFirst({
      where: { id: devolucion.clienteId, tenantId },
      select: { erpId: true, codigo: true },
    });

    const result = await adapter.pushDevolucion({
      clienteErpId: cliente?.erpId || cliente?.codigo || devolucion.clienteId,
      tipo: devolucion.tipo,
      facturaNumero: devolucion.facturaNumero || undefined,
      items: devolucion.items.map((i) => ({
        productoErpId: i.productoId,
        cantidad: i.cantidadDevuelta,
        precio: i.precioUnitario,
        motivo: i.motivo || undefined,
      })),
    });

    await prisma.devolucion.update({
      where: { id: devolucion.id },
      data: { erpSynced: true, erpId: result.erpId },
    });

    return result;
  }

  // ─── Cuenta corriente read-through ────────────────────

  async getCuentaCorrienteFromErp(tenantId: string, clienteId: string) {
    const { adapter } = await this.getAdapter(tenantId);

    const cliente = await prisma.cliente.findFirst({
      where: { id: clienteId, tenantId },
      select: { erpId: true, codigo: true },
    });
    if (!cliente) throw new NotFoundError('Cliente no encontrado');

    const clienteErpId = cliente.erpId || cliente.codigo;
    return adapter.fetchCuentaCorriente(clienteErpId);
  }
}
