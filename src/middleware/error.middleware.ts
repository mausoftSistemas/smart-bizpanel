import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';
import { env } from '../config/env';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      ok: false,
      error: {
        code: err.code,
        message: err.message,
        ...(env.NODE_ENV === 'development' && { stack: err.stack }),
      },
    });
  }

  logger.error('Unhandled error:', err);

  return res.status(500).json({
    ok: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: env.NODE_ENV === 'development'
        ? err.message
        : 'Error interno del servidor',
      ...(env.NODE_ENV === 'development' && { stack: err.stack }),
    },
  });
}
