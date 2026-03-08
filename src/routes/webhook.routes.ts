import { Router, Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { successResponse } from '../utils/helpers';

const router = Router();

// Recibir webhooks de ERPs o pasarelas de pago (Mercado Pago, etc.)
router.post('/erp', (req: Request, res: Response, _next: NextFunction) => {
  logger.info('Webhook ERP recibido', { body: req.body });
  // TODO: procesar evento del ERP
  successResponse(res, { received: true });
});

router.post('/mp', (req: Request, res: Response, _next: NextFunction) => {
  logger.info('Webhook Mercado Pago recibido', { body: req.body });
  // TODO: procesar notificación de pago
  successResponse(res, { received: true });
});

export default router;
