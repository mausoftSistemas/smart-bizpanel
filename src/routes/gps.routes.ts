import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth.middleware';
import { tenantMiddleware } from '../middleware/tenant.middleware';
import { requireModule } from '../middleware/features.middleware';
import { successResponse } from '../utils/helpers';
import { ValidationError } from '../utils/errors';

const router = Router();
const prisma = new PrismaClient();

router.use(authMiddleware, tenantMiddleware, requireModule('gps'));

router.post('/batch', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { jornadaId, points } = req.body;
    if (!jornadaId || !Array.isArray(points) || !points.length) {
      throw new ValidationError('jornadaId y points son requeridos');
    }

    const data = points.map((p: { latitud: number; longitud: number; velocidad?: number; timestamp: string; bateria?: number }) => ({
      jornadaId,
      vendedorId: req.user!.id,
      latitud: p.latitud,
      longitud: p.longitud,
      velocidad: p.velocidad,
      timestamp: new Date(p.timestamp),
      bateria: p.bateria,
    }));

    const result = await prisma.gpsPoint.createMany({ data });
    successResponse(res, { inserted: result.count }, 201);
  } catch (err) {
    next(err);
  }
});

router.get('/track/:vendedorId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const desde = req.query.desde ? new Date(req.query.desde as string) : new Date(new Date().setHours(0, 0, 0, 0));
    const hasta = req.query.hasta ? new Date(req.query.hasta as string) : new Date();

    const points = await prisma.gpsPoint.findMany({
      where: {
        vendedorId: req.params.vendedorId as string,
        timestamp: { gte: desde, lte: hasta },
      },
      orderBy: { timestamp: 'asc' },
    });
    successResponse(res, points);
  } catch (err) {
    next(err);
  }
});

export default router;
