import { PrismaClient, Prisma } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

// ─── Tipos ──────────────────────────────────────────────────

interface PushResult {
  localId: string;
  serverId: string | null;
  status: 'created' | 'already_exists' | 'error';
  error?: string;
}

function pushResponse(results: PushResult[]) {
  return { results, syncTimestamp: new Date().toISOString() };
}

// ─── Interfaces de entrada ──────────────────────────────────

interface PushPedidoInput {
  localId: string;
  clienteId: string;
  vendedorId: string;
  fecha: string;
  tipoComprobante?: string;
  subtotal: number;
  descuentoGlobal?: number;
  total: number;
  observaciones?: string;
  jornadaId?: string;
  items: {
    productoId: string;
    productoCodigo: string;
    productoNombre: string;
    cantidad: number;
    unidadTipo?: string;
    precioUnitario: number;
    descuentoPorcentaje?: number;
    subtotal: number;
  }[];
}

interface PushCobranzaInput {
  localId: string;
  clienteId: string;
  vendedorId: string;
  fecha: string;
  total: number;
  estado?: string;
  medios: {
    tipo: string;
    monto: number;
    moneda?: string;
    datos?: object;
  }[];
}

interface PushVisitaInput {
  localId: string;
  jornadaId: string;
  clienteId: string;
  vendedorId: string;
  fechaHora: string;
  tipo: string;
  resultado?: string;
  pedidoId?: string;
  monto?: number;
  latitud?: number;
  longitud?: number;
}

interface PushJornadaInput {
  localId: string;
  vendedorId: string;
  fecha: string;
  horaInicio: string;
  horaFin?: string;
  estado?: string;
  inicioLat?: number;
  inicioLng?: number;
  finLat?: number;
  finLng?: number;
  clientesPlan?: number;
  clientesVisitados?: number;
  totalVendido?: number;
  totalCobrado?: number;
  kmRecorridos?: number;
}

interface PushDevolucionInput {
  localId: string;
  clienteId: string;
  vendedorId: string;
  pedidoOriginalId?: string;
  facturaNumero?: string;
  tipo: string;
  total: number;
  motivoGeneral?: string;
  items: {
    productoId: string;
    productoCodigo: string;
    productoNombre: string;
    cantidadDevuelta: number;
    precioUnitario: number;
    motivo?: string;
    lote?: string;
    subtotal: number;
  }[];
}

interface PushGpsInput {
  jornadaId: string;
  vendedorId: string;
  latitud: number;
  longitud: number;
  velocidad?: number;
  timestamp: string;
  bateria?: number;
}

interface PushAllInput {
  pedidos?: PushPedidoInput[];
  cobranzas?: PushCobranzaInput[];
  visitas?: PushVisitaInput[];
  jornadas?: PushJornadaInput[];
  devoluciones?: PushDevolucionInput[];
  gps?: PushGpsInput[];
}

// ─── Servicio ───────────────────────────────────────────────

export class SyncPushService {

  // ─── PEDIDOS ──────────────────────────────────────────────

  async pushPedidos(tenantId: string, items: PushPedidoInput[]) {
    const results: PushResult[] = [];

    for (const item of items) {
      try {
        // Deduplicar por appLocalId
        const existing = await prisma.pedido.findFirst({
          where: { tenantId, appLocalId: item.localId },
        });

        if (existing) {
          results.push({ localId: item.localId, serverId: existing.id, status: 'already_exists' });
          continue;
        }

        const pedido = await prisma.pedido.create({
          data: {
            tenantId,
            clienteId: item.clienteId,
            vendedorId: item.vendedorId,
            fecha: new Date(item.fecha),
            tipoComprobante: item.tipoComprobante,
            subtotal: item.subtotal,
            descuentoGlobal: item.descuentoGlobal || 0,
            total: item.total,
            observaciones: item.observaciones,
            jornadaId: item.jornadaId,
            appLocalId: item.localId,
            items: {
              create: item.items.map((i) => ({
                productoId: i.productoId,
                productoCodigo: i.productoCodigo,
                productoNombre: i.productoNombre,
                cantidad: i.cantidad,
                unidadTipo: i.unidadTipo || 'unidad',
                precioUnitario: i.precioUnitario,
                descuentoPorcentaje: i.descuentoPorcentaje || 0,
                subtotal: i.subtotal,
              })),
            },
          },
        });

        results.push({ localId: item.localId, serverId: pedido.id, status: 'created' });
      } catch (err) {
        logger.error(`Push pedido ${item.localId} failed`, err);
        results.push({ localId: item.localId, serverId: null, status: 'error', error: (err as Error).message });
      }
    }

    return pushResponse(results);
  }

  // ─── COBRANZAS ────────────────────────────────────────────

  async pushCobranzas(tenantId: string, items: PushCobranzaInput[]) {
    const results: PushResult[] = [];

    for (const item of items) {
      try {
        const existing = await prisma.cobranza.findFirst({
          where: { tenantId, appLocalId: item.localId },
        });

        if (existing) {
          results.push({ localId: item.localId, serverId: existing.id, status: 'already_exists' });
          continue;
        }

        const cobranza = await prisma.$transaction(async (tx) => {
          const cob = await tx.cobranza.create({
            data: {
              tenantId,
              clienteId: item.clienteId,
              vendedorId: item.vendedorId,
              fecha: new Date(item.fecha),
              total: item.total,
              estado: item.estado || 'confirmado',
              appLocalId: item.localId,
              medios: {
                create: item.medios.map((m) => ({
                  tipo: m.tipo,
                  monto: m.monto,
                  moneda: m.moneda || 'ARS',
                  datos: (m.datos || {}) as Prisma.InputJsonValue,
                })),
              },
            },
          });

          // Actualizar saldo del cliente: restar lo cobrado
          await tx.cliente.update({
            where: { id: item.clienteId },
            data: { saldoCuenta: { decrement: item.total } },
          });

          return cob;
        });

        results.push({ localId: item.localId, serverId: cobranza.id, status: 'created' });
      } catch (err) {
        logger.error(`Push cobranza ${item.localId} failed`, err);
        results.push({ localId: item.localId, serverId: null, status: 'error', error: (err as Error).message });
      }
    }

    return pushResponse(results);
  }

  // ─── VISITAS ──────────────────────────────────────────────

  async pushVisitas(tenantId: string, items: PushVisitaInput[]) {
    const results: PushResult[] = [];

    for (const item of items) {
      try {
        const existing = await prisma.visita.findFirst({
          where: { appLocalId: item.localId, vendedorId: item.vendedorId },
        });

        if (existing) {
          results.push({ localId: item.localId, serverId: existing.id, status: 'already_exists' });
          continue;
        }

        const visita = await prisma.visita.create({
          data: {
            jornadaId: item.jornadaId,
            clienteId: item.clienteId,
            vendedorId: item.vendedorId,
            fechaHora: new Date(item.fechaHora),
            tipo: item.tipo,
            resultado: item.resultado,
            pedidoId: item.pedidoId,
            monto: item.monto || 0,
            latitud: item.latitud,
            longitud: item.longitud,
            appLocalId: item.localId,
          },
        });

        results.push({ localId: item.localId, serverId: visita.id, status: 'created' });
      } catch (err) {
        logger.error(`Push visita ${item.localId} failed`, err);
        results.push({ localId: item.localId, serverId: null, status: 'error', error: (err as Error).message });
      }
    }

    return pushResponse(results);
  }

  // ─── JORNADAS ─────────────────────────────────────────────

  async pushJornadas(tenantId: string, items: PushJornadaInput[]) {
    const results: PushResult[] = [];

    for (const item of items) {
      try {
        const existing = await prisma.jornada.findFirst({
          where: { tenantId, appLocalId: item.localId },
        });

        if (existing) {
          results.push({ localId: item.localId, serverId: existing.id, status: 'already_exists' });
          continue;
        }

        const jornada = await prisma.jornada.create({
          data: {
            tenantId,
            vendedorId: item.vendedorId,
            fecha: new Date(item.fecha),
            horaInicio: new Date(item.horaInicio),
            horaFin: item.horaFin ? new Date(item.horaFin) : undefined,
            estado: item.estado || 'activa',
            inicioLat: item.inicioLat,
            inicioLng: item.inicioLng,
            finLat: item.finLat,
            finLng: item.finLng,
            clientesPlan: item.clientesPlan || 0,
            clientesVisitados: item.clientesVisitados || 0,
            totalVendido: item.totalVendido || 0,
            totalCobrado: item.totalCobrado || 0,
            kmRecorridos: item.kmRecorridos || 0,
            appLocalId: item.localId,
          },
        });

        results.push({ localId: item.localId, serverId: jornada.id, status: 'created' });
      } catch (err) {
        logger.error(`Push jornada ${item.localId} failed`, err);
        results.push({ localId: item.localId, serverId: null, status: 'error', error: (err as Error).message });
      }
    }

    return pushResponse(results);
  }

  // ─── DEVOLUCIONES ─────────────────────────────────────────

  async pushDevoluciones(tenantId: string, items: PushDevolucionInput[]) {
    const results: PushResult[] = [];

    for (const item of items) {
      try {
        const existing = await prisma.devolucion.findFirst({
          where: { tenantId, appLocalId: item.localId },
        });

        if (existing) {
          results.push({ localId: item.localId, serverId: existing.id, status: 'already_exists' });
          continue;
        }

        const devolucion = await prisma.devolucion.create({
          data: {
            tenantId,
            clienteId: item.clienteId,
            vendedorId: item.vendedorId,
            pedidoOriginalId: item.pedidoOriginalId,
            facturaNumero: item.facturaNumero,
            tipo: item.tipo,
            total: item.total,
            motivoGeneral: item.motivoGeneral,
            appLocalId: item.localId,
            items: {
              create: item.items.map((i) => ({
                productoId: i.productoId,
                productoCodigo: i.productoCodigo,
                productoNombre: i.productoNombre,
                cantidadDevuelta: i.cantidadDevuelta,
                precioUnitario: i.precioUnitario,
                motivo: i.motivo,
                lote: i.lote,
                subtotal: i.subtotal,
              })),
            },
          },
        });

        results.push({ localId: item.localId, serverId: devolucion.id, status: 'created' });
      } catch (err) {
        logger.error(`Push devolucion ${item.localId} failed`, err);
        results.push({ localId: item.localId, serverId: null, status: 'error', error: (err as Error).message });
      }
    }

    return pushResponse(results);
  }

  // ─── GPS (batch) ──────────────────────────────────────────

  async pushGps(points: PushGpsInput[]) {
    const data = points.map((p) => ({
      jornadaId: p.jornadaId,
      vendedorId: p.vendedorId,
      latitud: p.latitud,
      longitud: p.longitud,
      velocidad: p.velocidad,
      timestamp: new Date(p.timestamp),
      bateria: p.bateria,
    }));

    const result = await prisma.gpsPoint.createMany({ data, skipDuplicates: true });

    return {
      inserted: result.count,
      total: points.length,
      syncTimestamp: new Date().toISOString(),
    };
  }

  // ─── PUSH ALL (transacción completa) ─────────────────────

  async pushAll(tenantId: string, userId: string, input: PushAllInput) {
    const syncLog = await prisma.syncLog.create({
      data: { tenantId, userId, direction: 'push', entityType: 'all', status: 'success' },
    });

    const response: Record<string, unknown> = {};
    let totalRecords = 0;

    try {
      // Jornadas primero (pedidos/visitas pueden referenciar jornadaId)
      if (input.jornadas?.length) {
        response.jornadas = await this.pushJornadas(tenantId, input.jornadas);
        totalRecords += input.jornadas.length;
      }

      // Pedidos
      if (input.pedidos?.length) {
        response.pedidos = await this.pushPedidos(tenantId, input.pedidos);
        totalRecords += input.pedidos.length;
      }

      // Cobranzas
      if (input.cobranzas?.length) {
        response.cobranzas = await this.pushCobranzas(tenantId, input.cobranzas);
        totalRecords += input.cobranzas.length;
      }

      // Visitas
      if (input.visitas?.length) {
        response.visitas = await this.pushVisitas(tenantId, input.visitas);
        totalRecords += input.visitas.length;
      }

      // Devoluciones
      if (input.devoluciones?.length) {
        response.devoluciones = await this.pushDevoluciones(tenantId, input.devoluciones);
        totalRecords += input.devoluciones.length;
      }

      // GPS (batch, no tiene localId)
      if (input.gps?.length) {
        response.gps = await this.pushGps(input.gps);
        totalRecords += input.gps.length;
      }

      await prisma.syncLog.update({
        where: { id: syncLog.id },
        data: { recordCount: totalRecords, finishedAt: new Date() },
      });
    } catch (err) {
      await prisma.syncLog.update({
        where: { id: syncLog.id },
        data: { status: 'error', errorDetail: (err as Error).message, finishedAt: new Date() },
      });
      throw err;
    }

    return {
      ...response,
      syncTimestamp: new Date().toISOString(),
    };
  }
}
