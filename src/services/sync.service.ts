import { PrismaClient } from '@prisma/client';
import { createAdapter } from '../erp-adapters/adapter-factory';
import { logger } from '../utils/logger';
import { SyncError } from '../utils/errors';

const prisma = new PrismaClient();

// Helper: parsear since de query string
function parseSince(since?: string): Date | undefined {
  if (!since) return undefined;
  const d = new Date(since);
  return isNaN(d.getTime()) ? undefined : d;
}

// Wrapper para respuesta estándar de pull
function pullResponse(data: unknown[], timestamp: Date) {
  return { data, count: data.length, serverTimestamp: timestamp.toISOString() };
}

export class SyncService {

  // ─── PULL ENDPOINTS ──────────────────────────────────────

  async pullProductos(tenantId: string, since?: string) {
    const sinceDate = parseSince(since);
    const timestamp = new Date();

    const data = await prisma.producto.findMany({
      where: {
        tenantId,
        activo: true,
        ...(sinceDate && { updatedAt: { gt: sinceDate } }),
      },
      orderBy: { updatedAt: 'asc' },
    });

    return pullResponse(data, timestamp);
  }

  async pullClientes(tenantId: string, since?: string, vendedorId?: string, rol?: string) {
    const sinceDate = parseSince(since);
    const timestamp = new Date();

    const data = await prisma.cliente.findMany({
      where: {
        tenantId,
        activo: true,
        ...(sinceDate && { updatedAt: { gt: sinceDate } }),
        // Si es vendedor, solo sus clientes asignados
        ...(rol === 'vendedor' && vendedorId && { vendedorId }),
      },
      orderBy: { updatedAt: 'asc' },
    });

    return pullResponse(data, timestamp);
  }

  async pullPreciosCliente(tenantId: string, since?: string) {
    const sinceDate = parseSince(since);
    const timestamp = new Date();

    const data = await prisma.precioCliente.findMany({
      where: {
        tenantId,
        activo: true,
        ...(sinceDate && { updatedAt: { gt: sinceDate } }),
      },
      orderBy: { updatedAt: 'asc' },
    });

    return pullResponse(data, timestamp);
  }

  async pullRutas(tenantId: string, vendedorId?: string) {
    const timestamp = new Date();

    const data = await prisma.ruta.findMany({
      where: {
        tenantId,
        ...(vendedorId && { vendedorId }),
      },
      include: {
        clientes: {
          orderBy: { orden: 'asc' },
        },
      },
    });

    return pullResponse(data, timestamp);
  }

  async pullCondicionesVenta(tenantId: string) {
    const timestamp = new Date();

    const data = await prisma.condicionVenta.findMany({
      where: { tenantId, activo: true },
      orderBy: { nombre: 'asc' },
    });

    return pullResponse(data, timestamp);
  }

  async pullMotivosNoCompra(tenantId: string) {
    const timestamp = new Date();

    const data = await prisma.motivoNoCompra.findMany({
      where: { tenantId, activo: true },
      orderBy: { descripcion: 'asc' },
    });

    return pullResponse(data, timestamp);
  }

  async pullObjetivos(tenantId: string, vendedorId?: string) {
    const timestamp = new Date();
    const now = new Date();

    const data = await prisma.objetivo.findMany({
      where: {
        tenantId,
        activo: true,
        periodoInicio: { lte: now },
        periodoFin: { gte: now },
        OR: [
          { vendedorId: null },          // objetivos generales (aplican a todos)
          ...(vendedorId ? [{ vendedorId }] : []),
        ],
      },
      orderBy: { periodoFin: 'asc' },
    });

    return pullResponse(data, timestamp);
  }

  async pullPoliticas(tenantId: string) {
    const timestamp = new Date();

    const data = await prisma.politicaComercial.findMany({
      where: { tenantId, activo: true },
      orderBy: { prioridad: 'desc' },
    });

    return pullResponse(data, timestamp);
  }

  async pullConfig(tenantId: string) {
    const timestamp = new Date();

    const tenant = await prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: {
        id: true,
        codigo: true,
        razonSocial: true,
        nombreApp: true,
        colorPrimario: true,
        colorSecundario: true,
        logo: true,
        moduloGps: true,
        moduloMp: true,
        moduloFirma: true,
        moduloEmail: true,
        config: true,
      },
    });

    const billeteras = await prisma.billetera.findMany({
      where: { tenantId, activo: true },
    });

    const denominaciones = await prisma.denominacion.findMany({
      where: { tenantId, activo: true },
      orderBy: { valor: 'desc' },
    });

    const condicionesVenta = await prisma.condicionVenta.findMany({
      where: { tenantId, activo: true },
    });

    return {
      data: {
        tenant: {
          id: tenant.id,
          codigo: tenant.codigo,
          razonSocial: tenant.razonSocial,
          nombreApp: tenant.nombreApp,
          colorPrimario: tenant.colorPrimario,
          colorSecundario: tenant.colorSecundario,
          logo: tenant.logo,
          modulos: {
            gps: tenant.moduloGps,
            mp: tenant.moduloMp,
            firma: tenant.moduloFirma,
            email: tenant.moduloEmail,
          },
        },
        config: tenant.config,
        billeteras,
        denominaciones,
        condicionesVenta,
      },
      serverTimestamp: timestamp.toISOString(),
    };
  }

  async pullMensajes(tenantId: string, vendedorId: string, since?: string) {
    const sinceDate = parseSince(since);
    const timestamp = new Date();

    const data = await prisma.mensaje.findMany({
      where: {
        tenantId,
        OR: [
          { vendedorId: null },     // broadcast
          { vendedorId },           // dirigido al vendedor
        ],
        ...(sinceDate && { updatedAt: { gt: sinceDate } }),
      },
      orderBy: { createdAt: 'desc' },
    });

    return pullResponse(data, timestamp);
  }

  async pullCuentaCorriente(tenantId: string, clienteId: string) {
    const timestamp = new Date();

    const data = await prisma.cuentaCorriente.findMany({
      where: { tenantId, clienteId },
      orderBy: { fecha: 'desc' },
    });

    return pullResponse(data, timestamp);
  }

  async pullAll(tenantId: string, since?: string, vendedorId?: string, rol?: string) {
    const timestamp = new Date();

    const [
      productos,
      clientes,
      preciosCliente,
      rutas,
      condicionesVenta,
      motivosNoCompra,
      objetivos,
      politicas,
      config,
      mensajes,
    ] = await Promise.all([
      this.pullProductos(tenantId, since),
      this.pullClientes(tenantId, since, vendedorId, rol),
      this.pullPreciosCliente(tenantId, since),
      this.pullRutas(tenantId, vendedorId),
      this.pullCondicionesVenta(tenantId),
      this.pullMotivosNoCompra(tenantId),
      this.pullObjetivos(tenantId, vendedorId),
      this.pullPoliticas(tenantId),
      this.pullConfig(tenantId),
      vendedorId
        ? this.pullMensajes(tenantId, vendedorId, since)
        : Promise.resolve(pullResponse([], timestamp)),
    ]);

    return {
      data: {
        productos: productos.data,
        clientes: clientes.data,
        preciosCliente: preciosCliente.data,
        rutas: rutas.data,
        condicionesVenta: condicionesVenta.data,
        motivosNoCompra: motivosNoCompra.data,
        objetivos: objetivos.data,
        politicas: politicas.data,
        config: config.data,
        mensajes: mensajes.data,
      },
      counts: {
        productos: productos.count,
        clientes: clientes.count,
        preciosCliente: preciosCliente.count,
        rutas: rutas.count,
        condicionesVenta: condicionesVenta.count,
        motivosNoCompra: motivosNoCompra.count,
        objetivos: objetivos.count,
        politicas: politicas.count,
        mensajes: mensajes.count,
      },
      serverTimestamp: timestamp.toISOString(),
    };
  }

  // ─── ERP SYNC (pull desde ERP externo → BD local) ───────

  async pullFromErp(tenantId: string, userId?: string) {
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    if (tenant.erpTipo === 'standalone') return { productos: 0, clientes: 0 };

    const adapter = await createAdapter(tenant);
    let productosCount = 0;
    let clientesCount = 0;

    const syncLog = await prisma.syncLog.create({
      data: { tenantId, userId: userId || 'system', direction: 'pull', entityType: 'all', status: 'success' },
    });

    try {
      const productos = await adapter.fetchProductos();
      for (const p of productos) {
        await prisma.producto.upsert({
          where: { tenantId_codigo: { tenantId, codigo: p.codigo } },
          update: {
            nombre: p.nombre,
            descripcion: p.descripcion,
            precioLista: p.precio,
            stockUnidad: p.stock,
            unidadMedida: p.unidad || 'UN',
            categoria: p.categoria,
            erpId: p.erpId,
          },
          create: {
            tenantId,
            erpId: p.erpId,
            codigo: p.codigo,
            nombre: p.nombre,
            descripcion: p.descripcion,
            precioLista: p.precio,
            stockUnidad: p.stock,
            unidadMedida: p.unidad || 'UN',
            categoria: p.categoria,
          },
        });
        productosCount++;
      }

      const clientes = await adapter.fetchClientes();
      for (const c of clientes) {
        await prisma.cliente.upsert({
          where: { tenantId_codigo: { tenantId, codigo: c.codigo } },
          update: {
            nombre: c.razonSocial,
            cuit: c.cuit,
            direccion: c.direccion,
            telefono: c.telefono,
            email: c.email,
            listaPrecioId: c.listaPrecio,
            erpId: c.erpId,
          },
          create: {
            tenantId,
            erpId: c.erpId,
            codigo: c.codigo,
            nombre: c.razonSocial,
            cuit: c.cuit,
            direccion: c.direccion,
            telefono: c.telefono,
            email: c.email,
            listaPrecioId: c.listaPrecio,
          },
        });
        clientesCount++;
      }

      await prisma.syncLog.update({
        where: { id: syncLog.id },
        data: { recordCount: productosCount + clientesCount, finishedAt: new Date() },
      });
    } catch (err) {
      await prisma.syncLog.update({
        where: { id: syncLog.id },
        data: { status: 'error', errorDetail: (err as Error).message, finishedAt: new Date() },
      });
      logger.error(`Sync pull failed for tenant ${tenantId}`, err);
      throw new SyncError(`Error al sincronizar desde ERP: ${(err as Error).message}`);
    }

    logger.info(`Sync pull tenant=${tenantId}: ${productosCount} productos, ${clientesCount} clientes`);
    return { productos: productosCount, clientes: clientesCount };
  }

  // ─── ERP SYNC (push BD local → ERP externo) ─────────────

  async pushPendingToErp(tenantId: string, userId?: string) {
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    if (tenant.erpTipo === 'standalone') return { pedidos: 0, cobranzas: 0, devoluciones: 0 };

    const adapter = await createAdapter(tenant);
    let pedidosCount = 0;
    let cobranzasCount = 0;
    let devolucionesCount = 0;

    const syncLog = await prisma.syncLog.create({
      data: { tenantId, userId: userId || 'system', direction: 'push', entityType: 'all', status: 'success' },
    });

    // ─── Pedidos pendientes ─────────────────────────────
    const pedidos = await prisma.pedido.findMany({
      where: { tenantId, erpSynced: false, estado: 'confirmado' },
      include: { items: true, cliente: true },
    });

    for (const pedido of pedidos) {
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
        pedidosCount++;
      } catch (err) {
        await prisma.pedido.update({
          where: { id: pedido.id },
          data: { erpError: (err as Error).message },
        });
        logger.error(`Push pedido ${pedido.id} failed`, err);
      }
    }

    // ─── Cobranzas pendientes ───────────────────────────
    const cobranzas = await prisma.cobranza.findMany({
      where: { tenantId, erpSynced: false },
      include: { cliente: true, medios: true },
    });

    for (const cobranza of cobranzas) {
      try {
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
        cobranzasCount++;
      } catch (err) {
        logger.error(`Push cobranza ${cobranza.id} failed`, err);
      }
    }

    // ─── Devoluciones pendientes ─────────────────────────
    const devoluciones = await prisma.devolucion.findMany({
      where: { tenantId, erpSynced: false, estado: 'aprobada' },
      include: { items: true },
    });

    for (const devolucion of devoluciones) {
      try {
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
        devolucionesCount++;
      } catch (err) {
        logger.error(`Push devolucion ${devolucion.id} failed`, err);
      }
    }

    const totalCount = pedidosCount + cobranzasCount + devolucionesCount;
    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: { recordCount: totalCount, finishedAt: new Date() },
    });

    logger.info(`Sync push tenant=${tenantId}: ${pedidosCount} pedidos, ${cobranzasCount} cobranzas, ${devolucionesCount} devoluciones`);
    return { pedidos: pedidosCount, cobranzas: cobranzasCount, devoluciones: devolucionesCount };
  }
}
