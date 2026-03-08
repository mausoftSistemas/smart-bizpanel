import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth.middleware';
import { tenantMiddleware } from '../middleware/tenant.middleware';
import { successResponse } from '../utils/helpers';
import { ValidationError, NotFoundError } from '../utils/errors';

const router = Router();
const prisma = new PrismaClient();

router.use(authMiddleware, tenantMiddleware);

router.post('/iniciar', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { lat, lng, appLocalId } = req.body;
    const existing = await prisma.jornada.findFirst({
      where: { vendedorId: req.user!.id, estado: 'activa' },
    });
    if (existing) throw new ValidationError('Ya hay una jornada abierta');

    const now = new Date();
    const jornada = await prisma.jornada.create({
      data: {
        tenantId: req.tenantId!,
        vendedorId: req.user!.id,
        fecha: now,
        horaInicio: now,
        inicioLat: lat,
        inicioLng: lng,
        appLocalId,
      },
    });
    successResponse(res, jornada, 201);
  } catch (err) {
    next(err);
  }
});

router.post('/finalizar', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { lat, lng, kmRecorridos } = req.body;
    const jornada = await prisma.jornada.findFirst({
      where: { vendedorId: req.user!.id, estado: 'activa' },
    });
    if (!jornada) throw new NotFoundError('Jornada abierta');

    const updated = await prisma.jornada.update({
      where: { id: jornada.id },
      data: {
        horaFin: new Date(),
        estado: 'cerrada',
        finLat: lat,
        finLng: lng,
        kmRecorridos: kmRecorridos || 0,
      },
    });
    successResponse(res, updated);
  } catch (err) {
    next(err);
  }
});

router.get('/actual', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const jornada = await prisma.jornada.findFirst({
      where: { vendedorId: req.user!.id, estado: 'activa' },
      include: { visitas: true },
    });
    successResponse(res, jornada);
  } catch (err) {
    next(err);
  }
});

export default router;
