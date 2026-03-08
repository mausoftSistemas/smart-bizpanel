import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth.middleware';
import { tenantMiddleware } from '../middleware/tenant.middleware';
import { successResponse, paginatedResponse } from '../utils/helpers';
import { NotFoundError } from '../utils/errors';

const router = Router();
const prisma = new PrismaClient();

router.use(authMiddleware, tenantMiddleware);

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId!;
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const search = req.query.search as string | undefined;

    const where = {
      tenantId,
      activo: true,
      ...(search && {
        OR: [
          { nombre: { contains: search, mode: 'insensitive' as const } },
          { codigo: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      prisma.producto.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { nombre: 'asc' } }),
      prisma.producto.count({ where }),
    ]);
    paginatedResponse(res, data, total, page, limit);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const producto = await prisma.producto.findFirst({
      where: { id: req.params.id as string, tenantId: req.tenantId! },
    });
    if (!producto) throw new NotFoundError('Producto');
    successResponse(res, producto);
  } catch (err) {
    next(err);
  }
});

export default router;
