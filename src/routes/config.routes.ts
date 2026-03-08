import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth.middleware';
import { tenantMiddleware } from '../middleware/tenant.middleware';
import { successResponse } from '../utils/helpers';
import { NotFoundError } from '../utils/errors';

const router = Router();
const prisma = new PrismaClient();

router.use(authMiddleware, tenantMiddleware);

// White label: logo, colores, nombre
router.get('/whitelabel', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.tenantId! },
      select: {
        nombreApp: true,
        colorPrimario: true,
        colorSecundario: true,
        logo: true,
      },
    });
    if (!tenant) throw new NotFoundError('Tenant');
    successResponse(res, tenant);
  } catch (err) {
    next(err);
  }
});

// Toda la config del tenant (config completa para la app)
router.get('/tenant', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.tenantId! },
      select: {
        id: true,
        codigo: true,
        razonSocial: true,
        nombreApp: true,
        colorPrimario: true,
        colorSecundario: true,
        logo: true,
        erpTipo: true,
        moduloGps: true,
        moduloMp: true,
        moduloFirma: true,
        moduloEmail: true,
        config: true,
      },
    });
    if (!tenant) throw new NotFoundError('Tenant');
    successResponse(res, tenant);
  } catch (err) {
    next(err);
  }
});

// Condiciones de venta (catálogo)
router.get('/condiciones-venta', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await prisma.condicionVenta.findMany({
      where: { tenantId: req.tenantId!, activo: true },
      orderBy: { nombre: 'asc' },
    });
    successResponse(res, data);
  } catch (err) {
    next(err);
  }
});

// Billeteras habilitadas
router.get('/billeteras', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await prisma.billetera.findMany({
      where: { tenantId: req.tenantId!, activo: true },
      orderBy: { nombre: 'asc' },
    });
    successResponse(res, data);
  } catch (err) {
    next(err);
  }
});

// Denominaciones (para rendición / arqueo de caja)
router.get('/denominaciones', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await prisma.denominacion.findMany({
      where: { tenantId: req.tenantId!, activo: true },
      orderBy: { valor: 'desc' },
    });
    successResponse(res, data);
  } catch (err) {
    next(err);
  }
});

// Motivos de devolución (catálogo)
router.get('/motivos-devolucion', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await prisma.motivoNoCompra.findMany({
      where: { tenantId: req.tenantId!, activo: true },
      orderBy: { descripcion: 'asc' },
    });
    successResponse(res, data);
  } catch (err) {
    next(err);
  }
});

// Ruta legacy: GET / (mantener retrocompatibilidad)
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.tenantId! },
      select: {
        id: true,
        razonSocial: true,
        nombreApp: true,
        colorPrimario: true,
        colorSecundario: true,
        logo: true,
        erpTipo: true,
        moduloGps: true,
        moduloMp: true,
        moduloFirma: true,
        moduloEmail: true,
        config: true,
      },
    });
    if (!tenant) throw new NotFoundError('Tenant');
    successResponse(res, tenant);
  } catch (err) {
    next(err);
  }
});

export default router;
