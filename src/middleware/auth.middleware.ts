import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { UnauthorizedError } from '../utils/errors';

export interface JwtPayload {
  id: string;
  tenantId: string;
  email: string;
  rol: string;
  tenantCodigo: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      tenantId?: string;
    }
  }
}

export function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Token no proporcionado'));
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    req.user = payload;
    next();
  } catch {
    next(new UnauthorizedError('Token inválido o expirado'));
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.rol)) {
      return next(new UnauthorizedError('Rol insuficiente'));
    }
    next();
  };
}
