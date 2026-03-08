import { Request, Response, NextFunction } from 'express';
import { UnauthorizedError } from '../utils/errors';

export function tenantMiddleware(req: Request, _res: Response, next: NextFunction) {
  // Prioridad: JWT > header X-Tenant-Id
  const tenantId = req.user?.tenantId || (req.headers['x-tenant-id'] as string);

  if (!tenantId) {
    return next(new UnauthorizedError('Tenant no identificado'));
  }

  req.tenantId = tenantId;
  next();
}
