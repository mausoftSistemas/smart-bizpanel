import { Router, Request, Response, NextFunction } from 'express';
import { SyncService } from '../services/sync.service';
import { SyncPushService } from '../services/sync-push.service';
import { authMiddleware } from '../middleware/auth.middleware';
import { tenantMiddleware } from '../middleware/tenant.middleware';
import { ValidationError } from '../utils/errors';

const router = Router();
const syncService = new SyncService();
const pushService = new SyncPushService();

router.use(authMiddleware, tenantMiddleware);

// ─── PULL: Productos ────────────────────────────────────────
// GET /api/sync/pull/productos?since=2026-01-01T00:00:00Z
router.get('/pull/productos', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await syncService.pullProductos(req.tenantId!, req.query.since as string);
    res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
});

// ─── PULL: Clientes ─────────────────────────────────────────
// GET /api/sync/pull/clientes?since=...
router.get('/pull/clientes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await syncService.pullClientes(
      req.tenantId!,
      req.query.since as string,
      req.user!.id,
      req.user!.rol
    );
    res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
});

// ─── PULL: Precios especiales por cliente ───────────────────
// GET /api/sync/pull/precios-cliente?since=...
router.get('/pull/precios-cliente', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await syncService.pullPreciosCliente(req.tenantId!, req.query.since as string);
    res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
});

// ─── PULL: Rutas del vendedor ───────────────────────────────
// GET /api/sync/pull/rutas?vendedorId=XXX
router.get('/pull/rutas', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const vendedorId = (req.query.vendedorId as string) || req.user!.id;
    const result = await syncService.pullRutas(req.tenantId!, vendedorId);
    res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
});

// ─── PULL: Condiciones de venta ─────────────────────────────
// GET /api/sync/pull/condiciones-venta
router.get('/pull/condiciones-venta', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await syncService.pullCondicionesVenta(req.tenantId!);
    res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
});

// ─── PULL: Motivos de no compra ─────────────────────────────
// GET /api/sync/pull/motivos-no-compra
router.get('/pull/motivos-no-compra', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await syncService.pullMotivosNoCompra(req.tenantId!);
    res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
});

// ─── PULL: Objetivos del vendedor ───────────────────────────
// GET /api/sync/pull/objetivos?vendedorId=XXX
router.get('/pull/objetivos', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const vendedorId = (req.query.vendedorId as string) || req.user!.id;
    const result = await syncService.pullObjetivos(req.tenantId!, vendedorId);
    res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
});

// ─── PULL: Políticas comerciales ────────────────────────────
// GET /api/sync/pull/politicas
router.get('/pull/politicas', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await syncService.pullPoliticas(req.tenantId!);
    res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
});

// ─── PULL: Config completa ──────────────────────────────────
// GET /api/sync/pull/config
router.get('/pull/config', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await syncService.pullConfig(req.tenantId!);
    res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
});

// ─── PULL: Mensajes / Notificaciones ────────────────────────
// GET /api/sync/pull/mensajes?vendedorId=XXX&since=...
router.get('/pull/mensajes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const vendedorId = (req.query.vendedorId as string) || req.user!.id;
    const result = await syncService.pullMensajes(req.tenantId!, vendedorId, req.query.since as string);
    res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
});

// ─── PULL: Cuenta corriente de un cliente ───────────────────
// GET /api/sync/pull/cuenta-corriente?clienteId=XXX
router.get('/pull/cuenta-corriente', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clienteId = req.query.clienteId as string;
    if (!clienteId) throw new ValidationError('clienteId es requerido');
    const result = await syncService.pullCuentaCorriente(req.tenantId!, clienteId);
    res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
});

// ─── PULL: Sync completo (todo en una llamada) ─────────────
// GET /api/sync/pull/all?since=...
router.get('/pull/all', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await syncService.pullAll(
      req.tenantId!,
      req.query.since as string,
      req.user!.id,
      req.user!.rol
    );
    res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
});

// ─── PUSH: Pedidos ───────────────────────────────────────────
// POST /api/sync/push/pedidos
router.post('/push/pedidos', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pushService.pushPedidos(req.tenantId!, req.body.items || []);
    res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
});

// ─── PUSH: Cobranzas ─────────────────────────────────────────
// POST /api/sync/push/cobranzas
router.post('/push/cobranzas', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pushService.pushCobranzas(req.tenantId!, req.body.items || []);
    res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
});

// ─── PUSH: Visitas ───────────────────────────────────────────
// POST /api/sync/push/visitas
router.post('/push/visitas', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pushService.pushVisitas(req.tenantId!, req.body.items || []);
    res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
});

// ─── PUSH: Jornadas ──────────────────────────────────────────
// POST /api/sync/push/jornadas
router.post('/push/jornadas', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pushService.pushJornadas(req.tenantId!, req.body.items || []);
    res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
});

// ─── PUSH: Devoluciones ──────────────────────────────────────
// POST /api/sync/push/devoluciones
router.post('/push/devoluciones', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pushService.pushDevoluciones(req.tenantId!, req.body.items || []);
    res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
});

// ─── PUSH: GPS (batch) ──────────────────────────────────────
// POST /api/sync/push/gps
router.post('/push/gps', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pushService.pushGps(req.body.points || []);
    res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
});

// ─── PUSH: Todo junto ────────────────────────────────────────
// POST /api/sync/push/all
router.post('/push/all', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pushService.pushAll(req.tenantId!, req.user!.id, req.body);
    res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
});

// ─── ERP SYNC (legacy: mantener compatibilidad) ────────────

router.get('/pull', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await syncService.pullFromErp(req.tenantId!);
    res.json({ ok: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.post('/push', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await syncService.pushPendingToErp(req.tenantId!);
    res.json({ ok: true, data: result });
  } catch (err) {
    next(err);
  }
});

export default router;
