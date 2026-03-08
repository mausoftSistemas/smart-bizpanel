import { Router, Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { authMiddleware, requireRole } from '../middleware/auth.middleware';
import { authRateLimitMiddleware } from '../middleware/security.middleware';
import { successResponse } from '../utils/helpers';

const router = Router();
const authService = new AuthService();

// POST /api/auth/login
router.post('/login', authRateLimitMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantCodigo, email, password } = req.body;
    const result = await authService.login(tenantCodigo, email, password);
    successResponse(res, result);
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/register (requiere admin)
router.post('/register', authMiddleware, requireRole('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, nombre, rol } = req.body;
    const user = await authService.register(req.user!.tenantId, email, password, nombre, rol || 'vendedor');
    successResponse(res, user, 201);
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await authService.me(req.user!.id);
    successResponse(res, result);
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/refresh
router.post('/refresh', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await authService.refresh(req.user!);
    successResponse(res, result);
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/change-password
router.post('/change-password', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { currentPassword, newPassword } = req.body;
    await authService.changePassword(req.user!.id, currentPassword, newPassword);
    successResponse(res, { message: 'Contraseña actualizada' });
  } catch (err) {
    next(err);
  }
});

export default router;
