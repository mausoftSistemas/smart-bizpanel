import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth.middleware';
import { tenantMiddleware } from '../middleware/tenant.middleware';
import { successResponse, paginatedResponse } from '../utils/helpers';
import { ValidationError, NotFoundError } from '../utils/errors';

const router = Router();
const prisma = new PrismaClient();

router.use(authMiddleware, tenantMiddleware);

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId!;
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 50, 200);

    const where = { tenantId };
    const [data, total] = await Promise.all([
      prisma.cobranza.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { fecha: 'desc' },
        include: {
          cliente: { select: { nombre: true, codigo: true } },
          medios: true,
        },
      }),
      prisma.cobranza.count({ where }),
    ]);
    paginatedResponse(res, data, total, page, limit);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { clienteId, total, medios, appLocalId } = req.body;
    if (!clienteId || !total || !medios?.length) {
      throw new ValidationError('clienteId, total y medios son requeridos');
    }

    const cobranza = await prisma.cobranza.create({
      data: {
        tenantId: req.tenantId!,
        vendedorId: req.user!.id,
        clienteId,
        fecha: new Date(),
        total,
        appLocalId,
        medios: {
          create: medios.map((m: { tipo: string; monto: number; moneda?: string; datos?: object }) => ({
            tipo: m.tipo,
            monto: m.monto,
            moneda: m.moneda || 'ARS',
            datos: m.datos || {},
          })),
        },
      },
      include: { medios: true },
    });
    successResponse(res, cobranza, 201);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cobranza = await prisma.cobranza.findFirst({
      where: { id: req.params.id as string, tenantId: req.tenantId! },
      include: { cliente: true, medios: true },
    });
    if (!cobranza) throw new NotFoundError('Cobranza');
    successResponse(res, cobranza);
  } catch (err) {
    next(err);
  }
});

export default router;
