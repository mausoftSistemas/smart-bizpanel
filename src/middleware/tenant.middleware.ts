import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { UnauthorizedError, ForbiddenError } from '../utils/errors';

const prisma = new PrismaClient();

export async function tenantMiddleware(req: Request, _res: Response, next: NextFunction) {
  try {
    // Prioridad: JWT > header X-Tenant-Id
    const tenantId = req.user?.tenantId || (req.headers['x-tenant-id'] as string);

    if (!tenantId) {
      return next(new UnauthorizedError('Tenant no identificado'));
    }

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });

    if (!tenant) {
      return next(new UnauthorizedError('Tenant no encontrado'));
    }

    if (tenant.estado === 'suspendido') {
      return next(new ForbiddenError('Tu cuenta está suspendida. Contactá al administrador.'));
    }

    if (tenant.estado === 'cancelado') {
      return next(new ForbiddenError('Tu cuenta ha sido cancelada.'));
    }

    req.tenantId = tenantId;
    req.tenant = tenant;
    next();
  } catch (err) {
    next(err);
  }
}
