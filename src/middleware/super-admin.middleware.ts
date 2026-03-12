import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { UnauthorizedError, ForbiddenError } from '../utils/errors';

export interface SuperAdminJwtPayload {
  superAdminId: string;
  email: string;
  role: 'super_admin';
}

declare global {
  namespace Express {
    interface Request {
      superAdmin?: SuperAdminJwtPayload;
    }
  }
}

export function superAdminMiddleware(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Token no proporcionado'));
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as Record<string, unknown>;

    if (payload.role !== 'super_admin') {
      return next(new ForbiddenError('Acceso exclusivo para Super Admin'));
    }

    req.superAdmin = {
      superAdminId: payload.superAdminId as string,
      email: payload.email as string,
      role: 'super_admin',
    };

    next();
  } catch {
    next(new UnauthorizedError('Token inválido o expirado'));
  }
}
