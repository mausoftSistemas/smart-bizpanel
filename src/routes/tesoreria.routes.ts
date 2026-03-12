import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import { authMiddleware, requireRole } from '../middleware/auth.middleware';
import { tenantMiddleware } from '../middleware/tenant.middleware';
import { successResponse, paginatedResponse } from '../utils/helpers';
import { NotFoundError, ValidationError } from '../utils/errors';

const router = Router();
const prisma = new PrismaClient();

router.use(authMiddleware, tenantMiddleware, requireRole('tesorero'));

// ═══════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════

router.get('/dashboard', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId as string;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const manana = new Date(hoy);
    manana.setDate(manana.getDate() + 1);

    // Cobranzas del día
    const cobranzasHoy = await prisma.cobranza.findMany({
      where: { tenantId, fecha: { gte: hoy, lt: manana } },
      include: {
        medios: true,
        cliente: { select: { id: true, nombre: true, codigo: true } },
        vendedor: { select: { id: true, nombre: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Totales por tipo de medio
    let totalEfectivo = 0;
    let totalCheques = 0;
    let cantidadCheques = 0;
    let totalTransferencias = 0;
    let totalOtros = 0;

    for (const c of cobranzasHoy) {
      for (const m of c.medios) {
        const monto = Number(m.monto);
        switch (m.tipo) {
          case 'efectivo': totalEfectivo += monto; break;
          case 'cheque': totalCheques += monto; cantidadCheques++; break;
          case 'transferencia': totalTransferencias += monto; break;
          default: totalOtros += monto; break;
        }
      }
    }

    const totalCobradoHoy = cobranzasHoy.reduce((s, c) => s + Number(c.total), 0);

    // Rendiciones pendientes (pendiente o entregado)
    const rendicionesPendientes = await prisma.rendicion.count({
      where: { tenantId, estado: { in: ['pendiente', 'entregado'] } },
    });

    // Vendedores con jornada activa hoy
    const vendedoresActivos = await prisma.jornada.count({
      where: { tenantId, estado: 'activa', fecha: { gte: hoy, lt: manana } },
    });

    successResponse(res, {
      totalCobradoHoy,
      totalEfectivo,
      totalCheques,
      cantidadCheques,
      totalTransferencias,
      totalOtros,
      rendicionesPendientes,
      vendedoresActivos,
      cobranzasHoy: cobranzasHoy.map((c) => ({
        id: c.id,
        fecha: c.fecha,
        total: c.total,
        estado: c.estado,
        cliente: c.cliente,
        vendedor: c.vendedor,
        medios: c.medios.map((m) => ({ tipo: m.tipo, monto: m.monto })),
      })),
    });
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════════════════
// COBRANZAS
// ═══════════════════════════════════════════════════════════

router.get('/cobranzas', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId as string;
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const { desde, hasta, vendedorId, medioPago } = req.query;

    const where: Record<string, unknown> = { tenantId };
    if (desde || hasta) {
      where.fecha = {};
      if (desde) (where.fecha as Record<string, unknown>).gte = new Date(desde as string);
      if (hasta) {
        const h = new Date(hasta as string);
        h.setDate(h.getDate() + 1);
        (where.fecha as Record<string, unknown>).lt = h;
      }
    }
    if (vendedorId) where.vendedorId = vendedorId;
    if (medioPago) where.medios = { some: { tipo: medioPago } };

    const [data, total] = await Promise.all([
      prisma.cobranza.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { fecha: 'desc' },
        include: {
          cliente: { select: { id: true, nombre: true, codigo: true } },
          vendedor: { select: { id: true, nombre: true } },
          medios: { select: { tipo: true, monto: true } },
        },
      }),
      prisma.cobranza.count({ where }),
    ]);

    paginatedResponse(res, data, total, page, limit);
  } catch (err) {
    next(err);
  }
});

router.get('/cobranzas/export', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId as string;
    const { desde, hasta, vendedorId } = req.query;

    const where: Record<string, unknown> = { tenantId };
    if (desde || hasta) {
      where.fecha = {};
      if (desde) (where.fecha as Record<string, unknown>).gte = new Date(desde as string);
      if (hasta) {
        const h = new Date(hasta as string);
        h.setDate(h.getDate() + 1);
        (where.fecha as Record<string, unknown>).lt = h;
      }
    }
    if (vendedorId) where.vendedorId = vendedorId;

    const cobranzas = await prisma.cobranza.findMany({
      where,
      orderBy: { fecha: 'desc' },
      include: {
        cliente: { select: { nombre: true, codigo: true } },
        vendedor: { select: { nombre: true } },
        medios: { select: { tipo: true, monto: true, moneda: true } },
      },
    });

    const rows = cobranzas.map((c) => ({
      Fecha: new Date(c.fecha).toLocaleDateString('es-AR'),
      Vendedor: c.vendedor.nombre,
      Cliente: c.cliente.nombre,
      'Codigo Cliente': c.cliente.codigo,
      Total: Number(c.total),
      Estado: c.estado,
      Medios: c.medios.map((m) => `${m.tipo}: ${Number(m.monto)}`).join(', '),
      Recibo: c.numeroRecibo || '',
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Cobranzas');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=cobranzas.xlsx');
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

router.get('/cobranzas/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId as string;
    const id = req.params.id as string;

    const cobranza = await prisma.cobranza.findFirst({
      where: { id, tenantId },
      include: {
        cliente: { select: { id: true, nombre: true, codigo: true, direccion: true, telefono: true } },
        vendedor: { select: { id: true, nombre: true, email: true } },
        medios: true,
        imputaciones: true,
      },
    });

    if (!cobranza) throw new NotFoundError('Cobranza no encontrada');
    successResponse(res, cobranza);
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════════════════
// RENDICIONES
// ═══════════════════════════════════════════════════════════

router.get('/rendiciones', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId as string;
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const { desde, hasta, vendedorId, estado } = req.query;

    const where: Record<string, unknown> = { tenantId };
    if (desde || hasta) {
      where.fecha = {};
      if (desde) (where.fecha as Record<string, unknown>).gte = new Date(desde as string);
      if (hasta) {
        const h = new Date(hasta as string);
        h.setDate(h.getDate() + 1);
        (where.fecha as Record<string, unknown>).lt = h;
      }
    }
    if (vendedorId) where.vendedorId = vendedorId;
    if (estado) where.estado = estado;

    const [rendiciones, total] = await Promise.all([
      prisma.rendicion.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { fecha: 'desc' },
        include: { cheques: true },
      }),
      prisma.rendicion.count({ where }),
    ]);

    // Resolver nombres de vendedores
    const vendedorIds = [...new Set(rendiciones.map((r) => r.vendedorId))];
    const vendedores = await prisma.user.findMany({
      where: { id: { in: vendedorIds } },
      select: { id: true, nombre: true },
    });
    const vendedorMap = Object.fromEntries(vendedores.map((v) => [v.id, v.nombre]));

    const data = rendiciones.map((r) => ({
      ...r,
      vendedorNombre: vendedorMap[r.vendedorId] || 'Desconocido',
    }));

    paginatedResponse(res, data, total, page, limit);
  } catch (err) {
    next(err);
  }
});

router.get('/rendiciones/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId as string;
    const id = req.params.id as string;

    const rendicion = await prisma.rendicion.findFirst({
      where: { id, tenantId },
      include: { cheques: true },
    });

    if (!rendicion) throw new NotFoundError('Rendición no encontrada');

    // Resolver vendedor y aprobador
    const [vendedor, aprobador] = await Promise.all([
      prisma.user.findFirst({ where: { id: rendicion.vendedorId }, select: { id: true, nombre: true, email: true } }),
      rendicion.aprobadoPor
        ? prisma.user.findFirst({ where: { id: rendicion.aprobadoPor }, select: { id: true, nombre: true } })
        : null,
    ]);

    // Cobranzas del vendedor en esa fecha
    const fechaInicio = new Date(rendicion.fecha);
    fechaInicio.setHours(0, 0, 0, 0);
    const fechaFin = new Date(fechaInicio);
    fechaFin.setDate(fechaFin.getDate() + 1);

    const cobranzasDia = await prisma.cobranza.findMany({
      where: {
        tenantId,
        vendedorId: rendicion.vendedorId,
        fecha: { gte: fechaInicio, lt: fechaFin },
      },
      include: {
        cliente: { select: { nombre: true, codigo: true } },
        medios: { select: { tipo: true, monto: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    successResponse(res, {
      ...rendicion,
      vendedor: vendedor || { id: rendicion.vendedorId, nombre: 'Desconocido', email: '' },
      aprobadorInfo: aprobador,
      cobranzasDia,
    });
  } catch (err) {
    next(err);
  }
});

router.put('/rendiciones/:id/aprobar', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId as string;
    const id = req.params.id as string;
    const userId = req.user!.id;
    const { motivoDiferencia } = req.body || {};

    const rendicion = await prisma.rendicion.findFirst({
      where: { id, tenantId },
    });
    if (!rendicion) throw new NotFoundError('Rendición no encontrada');
    if (!['pendiente', 'entregado'].includes(rendicion.estado)) {
      throw new ValidationError('La rendición ya fue procesada');
    }

    const estado = Number(rendicion.diferencia) !== 0 ? 'con_diferencia' : 'aprobado';

    const updated = await prisma.rendicion.update({
      where: { id },
      data: {
        estado,
        aprobadoPor: userId,
        fechaAprobacion: new Date(),
        observaciones: motivoDiferencia ? `${rendicion.observaciones || ''}\n[Diferencia] ${motivoDiferencia}`.trim() : rendicion.observaciones,
      },
    });

    successResponse(res, updated);
  } catch (err) {
    next(err);
  }
});

router.put('/rendiciones/:id/rechazar', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId as string;
    const id = req.params.id as string;
    const userId = req.user!.id;
    const { motivoRechazo } = req.body || {};

    if (!motivoRechazo) throw new ValidationError('El motivo de rechazo es obligatorio');

    const rendicion = await prisma.rendicion.findFirst({
      where: { id, tenantId },
    });
    if (!rendicion) throw new NotFoundError('Rendición no encontrada');
    if (!['pendiente', 'entregado'].includes(rendicion.estado)) {
      throw new ValidationError('La rendición ya fue procesada');
    }

    const updated = await prisma.rendicion.update({
      where: { id },
      data: {
        estado: 'rechazado',
        motivoRechazo,
        aprobadoPor: userId,
        fechaAprobacion: new Date(),
      },
    });

    successResponse(res, updated);
  } catch (err) {
    next(err);
  }
});

router.put('/rendiciones/:id/cheques/:chequeId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId as string;
    const id = req.params.id as string;
    const chequeId = Number(req.params.chequeId as string);
    const userId = req.user!.id;

    const rendicion = await prisma.rendicion.findFirst({
      where: { id, tenantId },
    });
    if (!rendicion) throw new NotFoundError('Rendición no encontrada');

    const cheque = await prisma.rendicionCheque.findFirst({
      where: { id: chequeId, rendicionId: id },
    });
    if (!cheque) throw new NotFoundError('Cheque no encontrado');

    const updated = await prisma.rendicionCheque.update({
      where: { id: chequeId },
      data: {
        entregado: true,
        recibidoPor: userId,
        fechaRecepcion: new Date(),
      },
    });

    successResponse(res, updated);
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════════════════
// VENDEDORES
// ═══════════════════════════════════════════════════════════

router.get('/vendedores', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId as string;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const manana = new Date(hoy);
    manana.setDate(manana.getDate() + 1);

    const vendedores = await prisma.user.findMany({
      where: { tenantId, rol: 'vendedor', activo: true },
      select: { id: true, nombre: true, email: true },
    });

    const result = await Promise.all(
      vendedores.map(async (v) => {
        const jornadaActiva = await prisma.jornada.findFirst({
          where: { vendedorId: v.id, estado: 'activa', fecha: { gte: hoy, lt: manana } },
          select: { id: true, horaInicio: true },
        });

        const cobranzasHoy = await prisma.cobranza.findMany({
          where: { vendedorId: v.id, tenantId, fecha: { gte: hoy, lt: manana } },
          select: { total: true },
        });
        const cobradoHoy = cobranzasHoy.reduce((s, c) => s + Number(c.total), 0);

        const rendicionHoy = await prisma.rendicion.findFirst({
          where: { vendedorId: v.id, tenantId, fecha: { gte: hoy, lt: manana } },
          select: { id: true, estado: true },
        });

        return {
          ...v,
          jornadaActiva: jornadaActiva ? true : false,
          cobradoHoy,
          rendicion: rendicionHoy,
        };
      }),
    );

    successResponse(res, result);
  } catch (err) {
    next(err);
  }
});

router.get('/vendedores/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId as string;
    const id = req.params.id as string;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const manana = new Date(hoy);
    manana.setDate(manana.getDate() + 1);

    const vendedor = await prisma.user.findFirst({
      where: { id, tenantId, rol: 'vendedor' },
      select: { id: true, nombre: true, email: true, activo: true, lastLogin: true },
    });
    if (!vendedor) throw new NotFoundError('Vendedor no encontrado');

    const cobranzasHoy = await prisma.cobranza.findMany({
      where: { vendedorId: id, tenantId, fecha: { gte: hoy, lt: manana } },
      include: {
        cliente: { select: { nombre: true, codigo: true } },
        medios: { select: { tipo: true, monto: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const rendicionHoy = await prisma.rendicion.findFirst({
      where: { vendedorId: id, tenantId, fecha: { gte: hoy, lt: manana } },
      include: { cheques: true },
    });

    const jornadaHoy = await prisma.jornada.findFirst({
      where: { vendedorId: id, fecha: { gte: hoy, lt: manana } },
      select: { id: true, estado: true, horaInicio: true, horaFin: true, totalCobrado: true },
    });

    successResponse(res, {
      vendedor,
      jornadaHoy,
      cobranzasHoy,
      rendicionHoy,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
