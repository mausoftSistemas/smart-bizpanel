import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

export const corsMiddleware = cors({
  origin: env.CORS_ORIGIN === '*' ? '*' : env.CORS_ORIGIN.split(','),
  credentials: true,
});

export const helmetMiddleware = helmet();

export const rateLimitMiddleware = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: { code: 'RATE_LIMIT', message: 'Demasiadas solicitudes, intentá de nuevo en un minuto' } },
});

export const authRateLimitMiddleware = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: { code: 'RATE_LIMIT', message: 'Demasiados intentos de login' } },
});
