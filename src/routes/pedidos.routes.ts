import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth.middleware';
import { tenantMiddleware } from '../middleware/tenant.middleware';
import { successResponse, paginatedResponse } from '../utils/helpers';
import { NotFoundError, ValidationError } from '../utils/errors';

const router = Router();
const prisma = new PrismaClient();

router.use(authMiddleware, tenantMiddleware);

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId!;
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const estado = req.query.estado as string | undefined;

    const where = { tenantId, ...(estado && { estado }) };

    const [data, total] = await Promise.all([
      prisma.pedido.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { fecha: 'desc' },
        include: { cliente: { select: { nombre: true, codigo: true } }, items: true },
      }),
      prisma.pedido.count({ where }),
    ]);
    paginatedResponse(res, data, total, page, limit);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pedido = await prisma.pedido.findFirst({
      where: { id: req.params.id as string, tenantId: req.tenantId! },
      include: {
        cliente: true,
        vendedor: { select: { nombre: true } },
        items: true,
      },
    });
    if (!pedido) throw new NotFoundError('Pedido');
    successResponse(res, pedido);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { clienteId, observaciones, jornadaId, appLocalId, items } = req.body;
    if (!clienteId || !items?.length) throw new ValidationError('clienteId e items son requeridos');

    const subtotal = items.reduce((sum: number, i: { cantidad: number; precioUnitario: number; descuentoPorcentaje?: number }) => {
      return sum + i.cantidad * i.precioUnitario * (1 - (i.descuentoPorcentaje || 0) / 100);
    }, 0);

    const pedido = await prisma.pedido.create({
      data: {
        tenantId: req.tenantId!,
        vendedorId: req.user!.id,
        clienteId,
        fecha: new Date(),
        observaciones,
        jornadaId,
        appLocalId,
        subtotal,
        total: subtotal,
        items: {
          create: items.map((i: {
            productoId: string;
            productoCodigo: string;
            productoNombre: string;
            cantidad: number;
            unidadTipo?: string;
            precioUnitario: number;
            descuentoPorcentaje?: number;
          }) => ({
            productoId: i.productoId,
            productoCodigo: i.productoCodigo,
            productoNombre: i.productoNombre,
            cantidad: i.cantidad,
            unidadTipo: i.unidadTipo || 'unidad',
            precioUnitario: i.precioUnitario,
            descuentoPorcentaje: i.descuentoPorcentaje || 0,
            subtotal: i.cantidad * i.precioUnitario * (1 - (i.descuentoPorcentaje || 0) / 100),
          })),
        },
      },
      include: { items: true },
    });
    successResponse(res, pedido, 201);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/confirmar', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pedido = await prisma.pedido.findFirst({
      where: { id: req.params.id as string, tenantId: req.tenantId! },
    });
    if (!pedido) throw new NotFoundError('Pedido');
    if (pedido.estado !== 'pendiente') throw new ValidationError('Solo se pueden confirmar pedidos pendientes');

    const updated = await prisma.pedido.update({
      where: { id: pedido.id },
      data: { estado: 'confirmado' },
    });
    successResponse(res, updated);
  } catch (err) {
    next(err);
  }
});

export default router;
