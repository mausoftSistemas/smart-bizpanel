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
      prisma.devolucion.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { items: true },
      }),
      prisma.devolucion.count({ where }),
    ]);
    paginatedResponse(res, data, total, page, limit);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { clienteId, tipo, motivoGeneral, pedidoOriginalId, facturaNumero, appLocalId, items } = req.body;
    if (!clienteId || !tipo || !items?.length) {
      throw new ValidationError('clienteId, tipo e items son requeridos');
    }

    const total = items.reduce(
      (sum: number, i: { cantidadDevuelta: number; precioUnitario: number }) =>
        sum + i.cantidadDevuelta * i.precioUnitario,
      0
    );

    const devolucion = await prisma.devolucion.create({
      data: {
        tenantId: req.tenantId!,
        vendedorId: req.user!.id,
        clienteId,
        tipo,
        motivoGeneral,
        pedidoOriginalId,
        facturaNumero,
        appLocalId,
        total,
        items: {
          create: items.map((i: {
            productoId: string;
            productoCodigo: string;
            productoNombre: string;
            cantidadDevuelta: number;
            precioUnitario: number;
            motivo?: string;
            lote?: string;
          }) => ({
            productoId: i.productoId,
            productoCodigo: i.productoCodigo,
            productoNombre: i.productoNombre,
            cantidadDevuelta: i.cantidadDevuelta,
            precioUnitario: i.precioUnitario,
            motivo: i.motivo,
            lote: i.lote,
            subtotal: i.cantidadDevuelta * i.precioUnitario,
          })),
        },
      },
      include: { items: true },
    });
    successResponse(res, devolucion, 201);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const devolucion = await prisma.devolucion.findFirst({
      where: { id: req.params.id as string, tenantId: req.tenantId! },
      include: { items: true },
    });
    if (!devolucion) throw new NotFoundError('Devolucion');
    successResponse(res, devolucion);
  } catch (err) {
    next(err);
  }
});

export default router;
