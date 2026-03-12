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
  // Campos ERP
  horaInicio?: string;
  horaFin?: string;
  fechaEntrega?: string;
  netoTotal?: number;
  cantidadItems?: number;
  latitud?: number;
  longitud?: number;
  codigoEstado?: string;
  condicionVtaCodigo?: string;
  listaPrecioUsada?: string;
  items: {
    productoId: string;
    productoCodigo: string;
    productoNombre: string;
    cantidad: number;
    unidadTipo?: string;
    precioUnitario: number;
    descuentoPorcentaje?: number;
    subtotal: number;
    // Campos ERP
    codigoCombo?: string;
    precioNeto?: number;
    listaPrecio?: string;
    bultoUnidad?: number;
  }[];
}

interface PushCobranzaInput {
  localId: string;
  clienteId: string;
  vendedorId: string;
  fecha: string;
  total: number;
  estado?: string;
  // Campos ERP
  horaInicio?: string;
  horaFin?: string;
  numeroRecibo?: string;
  latitud?: number;
  longitud?: number;
  codigoVendedor?: string;
  medios: {
    tipo: string;
    monto: number;
    moneda?: string;
    datos?: object;
    // Campos ERP
    codigoMedioPago?: string;
    numeroReferencia?: string;
    plazaCheque?: string;
    fechaEmision?: string;
    fechaVencimiento?: string;
    cotizacion?: number;
    cuitAcreedor?: string;
    titularTarjeta?: string;
    codigoAutorizacion?: string;
    codigoLote?: string;
    cuotas?: number;
    numeroCupon?: string;
  }[];
  imputaciones?: {
    tipoComprobante: string;
    sucursal: string;
    numeroComprobante: string;
    importeCobrado: number;
    numeroCuota?: number;
    letraComprobante?: string;
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
  // Campos ERP
  codigoZona?: string;
  codigoNoCompra?: string;
  horaRegistro?: string;
  codigoVendedor?: string;
  codigoCliente?: string;
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

interface PushRendicionInput {
  localId: string;
  vendedorId: string;
  jornadaId?: string;
  fecha: string;
  estado?: string;
  detalleBilletes: Record<string, number>;
  totalEfectivo: number;
  totalCheques?: number;
  cantidadCheques?: number;
  totalTransferencias?: number;
  totalBilleteras?: number;
  totalRetenciones?: number;
  totalTarjetas?: number;
  totalMercadoPago?: number;
  totalRecaudado: number;
  totalEsperado: number;
  diferencia: number;
  observaciones?: string;
  cheques?: {
    banco: string;
    numero: string;
    monto: number;
    fechaCobro?: string;
    plaza?: string;
    cuitLibrador?: string;
  }[];
}

interface PushPresupuestoInput {
  localId: string;
  clienteId: string;
  vendedorId: string;
  fecha: string;
  vigenciaHasta?: string;
  total: number;
  observaciones?: string;
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

interface PushFormularioRespuestaInput {
  localId: string;
  formularioId: string;
  vendedorId: string;
  clienteId?: string;
  visitaId?: string;
  respuestas: Record<string, unknown>;
  timestamp: string;
}

interface PushAllInput {
  pedidos?: PushPedidoInput[];
  cobranzas?: PushCobranzaInput[];
  visitas?: PushVisitaInput[];
  jornadas?: PushJornadaInput[];
  devoluciones?: PushDevolucionInput[];
  gps?: PushGpsInput[];
  rendiciones?: PushRendicionInput[];
  presupuestos?: PushPresupuestoInput[];
  formularios?: PushFormularioRespuestaInput[];
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
            // Campos ERP
            horaInicio: item.horaInicio,
            horaFin: item.horaFin,
            fechaEntrega: item.fechaEntrega ? new Date(item.fechaEntrega) : undefined,
            netoTotal: item.netoTotal ?? 0,
            cantidadItems: item.cantidadItems ?? 0,
            latitud: item.latitud,
            longitud: item.longitud,
            codigoEstado: item.codigoEstado ?? '0',
            condicionVtaCodigo: item.condicionVtaCodigo,
            listaPrecioUsada: item.listaPrecioUsada,
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
                // Campos ERP
                codigoCombo: i.codigoCombo,
                precioNeto: i.precioNeto ?? 0,
                listaPrecio: i.listaPrecio,
                bultoUnidad: i.bultoUnidad ?? 1,
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
              // Campos ERP
              horaInicio: item.horaInicio,
              horaFin: item.horaFin,
              numeroRecibo: item.numeroRecibo,
              latitud: item.latitud,
              longitud: item.longitud,
              codigoVendedor: item.codigoVendedor,
              medios: {
                create: item.medios.map((m) => ({
                  tipo: m.tipo,
                  monto: m.monto,
                  moneda: m.moneda || 'ARS',
                  datos: (m.datos || {}) as Prisma.InputJsonValue,
                  // Campos ERP
                  codigoMedioPago: m.codigoMedioPago,
                  numeroReferencia: m.numeroReferencia,
                  plazaCheque: m.plazaCheque,
                  fechaEmision: m.fechaEmision ? new Date(m.fechaEmision) : undefined,
                  fechaVencimiento: m.fechaVencimiento ? new Date(m.fechaVencimiento) : undefined,
                  cotizacion: m.cotizacion ?? 1,
                  cuitAcreedor: m.cuitAcreedor,
                  titularTarjeta: m.titularTarjeta,
                  codigoAutorizacion: m.codigoAutorizacion,
                  codigoLote: m.codigoLote,
                  cuotas: m.cuotas,
                  numeroCupon: m.numeroCupon,
                })),
              },
              // Imputaciones ERP
              ...(item.imputaciones?.length && {
                imputaciones: {
                  create: item.imputaciones.map((imp) => ({
                    tipoComprobante: imp.tipoComprobante,
                    sucursal: imp.sucursal,
                    numeroComprobante: imp.numeroComprobante,
                    importeCobrado: imp.importeCobrado,
                    numeroCuota: imp.numeroCuota ?? 1,
                    letraComprobante: imp.letraComprobante,
                  })),
                },
              }),
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
            // Campos ERP
            codigoZona: item.codigoZona,
            codigoNoCompra: item.codigoNoCompra,
            horaRegistro: item.horaRegistro,
            codigoVendedor: item.codigoVendedor,
            codigoCliente: item.codigoCliente,
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

  // ─── RENDICIONES ─────────────────────────────────────────

  async pushRendiciones(tenantId: string, items: PushRendicionInput[]) {
    const results: PushResult[] = [];

    for (const item of items) {
      try {
        const existing = await prisma.rendicion.findFirst({
          where: { tenantId, appLocalId: item.localId },
        });

        if (existing) {
          results.push({ localId: item.localId, serverId: existing.id, status: 'already_exists' });
          continue;
        }

        const rendicion = await prisma.rendicion.create({
          data: {
            tenantId,
            vendedorId: item.vendedorId,
            jornadaId: item.jornadaId,
            fecha: new Date(item.fecha),
            estado: item.estado || 'pendiente',
            detalleBilletes: item.detalleBilletes as Prisma.InputJsonValue,
            totalEfectivo: item.totalEfectivo,
            totalCheques: item.totalCheques || 0,
            cantidadCheques: item.cantidadCheques || 0,
            totalTransferencias: item.totalTransferencias || 0,
            totalBilleteras: item.totalBilleteras || 0,
            totalRetenciones: item.totalRetenciones || 0,
            totalTarjetas: item.totalTarjetas || 0,
            totalMercadoPago: item.totalMercadoPago || 0,
            totalRecaudado: item.totalRecaudado,
            totalEsperado: item.totalEsperado,
            diferencia: item.diferencia,
            observaciones: item.observaciones,
            appLocalId: item.localId,
            ...(item.cheques?.length && {
              cheques: {
                create: item.cheques.map((ch) => ({
                  banco: ch.banco,
                  numero: ch.numero,
                  monto: ch.monto,
                  fechaCobro: ch.fechaCobro ? new Date(ch.fechaCobro) : undefined,
                  plaza: ch.plaza,
                  cuitLibrador: ch.cuitLibrador,
                })),
              },
            }),
          },
        });

        results.push({ localId: item.localId, serverId: rendicion.id, status: 'created' });
      } catch (err) {
        logger.error(`Push rendicion ${item.localId} failed`, err);
        results.push({ localId: item.localId, serverId: null, status: 'error', error: (err as Error).message });
      }
    }

    return pushResponse(results);
  }

  // ─── PRESUPUESTOS ──────────────────────────────────────

  async pushPresupuestos(tenantId: string, items: PushPresupuestoInput[]) {
    const results: PushResult[] = [];

    for (const item of items) {
      try {
        const existing = await prisma.presupuesto.findFirst({
          where: { tenantId, appLocalId: item.localId },
        });

        if (existing) {
          results.push({ localId: item.localId, serverId: existing.id, status: 'already_exists' });
          continue;
        }

        const presupuesto = await prisma.presupuesto.create({
          data: {
            tenantId,
            clienteId: item.clienteId,
            vendedorId: item.vendedorId,
            fecha: new Date(item.fecha),
            vigenciaHasta: item.vigenciaHasta ? new Date(item.vigenciaHasta) : undefined,
            total: item.total,
            observaciones: item.observaciones,
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

        results.push({ localId: item.localId, serverId: presupuesto.id, status: 'created' });
      } catch (err) {
        logger.error(`Push presupuesto ${item.localId} failed`, err);
        results.push({ localId: item.localId, serverId: null, status: 'error', error: (err as Error).message });
      }
    }

    return pushResponse(results);
  }

  // ─── FORMULARIOS (respuestas) ──────────────────────────

  async pushFormularioRespuestas(tenantId: string, items: PushFormularioRespuestaInput[]) {
    const results: PushResult[] = [];

    for (const item of items) {
      try {
        const existing = await prisma.formularioRespuesta.findFirst({
          where: { appLocalId: item.localId },
        });

        if (existing) {
          results.push({ localId: item.localId, serverId: existing.id, status: 'already_exists' });
          continue;
        }

        const respuesta = await prisma.formularioRespuesta.create({
          data: {
            formularioId: item.formularioId,
            vendedorId: item.vendedorId,
            clienteId: item.clienteId,
            visitaId: item.visitaId,
            respuestas: item.respuestas as Prisma.InputJsonValue,
            timestamp: new Date(item.timestamp),
            appLocalId: item.localId,
          },
        });

        results.push({ localId: item.localId, serverId: respuesta.id, status: 'created' });
      } catch (err) {
        logger.error(`Push formulario respuesta ${item.localId} failed`, err);
        results.push({ localId: item.localId, serverId: null, status: 'error', error: (err as Error).message });
      }
    }

    return pushResponse(results);
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

      // Rendiciones
      if (input.rendiciones?.length) {
        response.rendiciones = await this.pushRendiciones(tenantId, input.rendiciones);
        totalRecords += input.rendiciones.length;
      }

      // Presupuestos
      if (input.presupuestos?.length) {
        response.presupuestos = await this.pushPresupuestos(tenantId, input.presupuestos);
        totalRecords += input.presupuestos.length;
      }

      // Formularios (respuestas)
      if (input.formularios?.length) {
        response.formularios = await this.pushFormularioRespuestas(tenantId, input.formularios);
        totalRecords += input.formularios.length;
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
