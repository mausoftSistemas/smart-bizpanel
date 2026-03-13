import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';
import { SyncService } from '../services/sync.service';
import { SyncPushService } from '../services/sync-push.service';
import { authMiddleware } from '../middleware/auth.middleware';
import { tenantMiddleware } from '../middleware/tenant.middleware';
import { requireModule } from '../middleware/features.middleware';
import { ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';

const router = Router();
const syncService = new SyncService();
const pushService = new SyncPushService();
const prisma = new PrismaClient();

// ─── Multer config (fotos y firmas) ──────────────────
const uploadsDir = path.join(process.cwd(), 'uploads');

const fileStorage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const tenantId = req.tenantId || 'unknown';
    const tipo = req.path.includes('/fotos') ? 'fotos' : 'firmas';
    const dir = path.join(uploadsDir, tenantId, tipo);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const fileUpload = multer({
  storage: fileStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new ValidationError(`Extension no permitida: ${ext}`));
  },
});

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

// ─── PULL: Formularios ───────────────────────────────────────
// GET /api/sync/pull/formularios
router.get('/pull/formularios', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await syncService.pullFormularios(req.tenantId!);
    res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
});

// ─── PULL: Sugerencias de venta ──────────────────────────────
// GET /api/sync/pull/sugerencias
router.get('/pull/sugerencias', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const vendedorId = (req.query.vendedorId as string) || req.user!.id;
    const result = await syncService.pullSugerencias(req.tenantId!, vendedorId);
    res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
});

// ─── PUSH: Rendiciones ───────────────────────────────────────
// POST /api/sync/push/rendiciones
router.post('/push/rendiciones', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pushService.pushRendiciones(req.tenantId!, req.body.items || []);
    res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
});

// ─── PUSH: Presupuestos ─────────────────────────────────────
// POST /api/sync/push/presupuestos
router.post('/push/presupuestos', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pushService.pushPresupuestos(req.tenantId!, req.body.items || []);
    res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
});

// ─── PUSH: Formularios (respuestas) ─────────────────────────
// POST /api/sync/push/formularios
router.post('/push/formularios', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pushService.pushFormularioRespuestas(req.tenantId!, req.body.items || []);
    res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
});

// ─── PUSH: Fotos (multipart) ────────────────────────────────
// POST /api/sync/push/fotos
router.post('/push/fotos', fileUpload.array('fotos', 20), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) throw new ValidationError('No se recibieron archivos');

    const metadata = req.body.metadata ? JSON.parse(req.body.metadata) : [];
    const results = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const meta = metadata[i] || {};
      const fotoUrl = `/uploads/${req.tenantId}/fotos/${file.filename}`;

      try {
        const foto = await prisma.fotoEvidencia.create({
          data: {
            tenantId: req.tenantId!,
            vendedorId: meta.vendedorId || req.user!.id,
            clienteId: meta.clienteId,
            visitaId: meta.visitaId,
            pedidoId: meta.pedidoId,
            tipo: meta.tipo || 'comprobante',
            fotoUrl,
            latitud: meta.latitud,
            longitud: meta.longitud,
            timestamp: meta.timestamp ? new Date(meta.timestamp) : new Date(),
            appLocalId: meta.localId,
          },
        });
        results.push({ localId: meta.localId, serverId: foto.id, status: 'created', url: fotoUrl });
      } catch (err) {
        logger.error(`Push foto failed`, err);
        results.push({ localId: meta.localId, serverId: null, status: 'error', error: (err as Error).message });
      }
    }

    res.json({ ok: true, results, syncTimestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

// ─── PUSH: Firmas (multipart) ───────────────────────────────
// POST /api/sync/push/firmas
router.post('/push/firmas', requireModule('firma'), fileUpload.array('firmas', 10), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) throw new ValidationError('No se recibieron archivos');

    const metadata = req.body.metadata ? JSON.parse(req.body.metadata) : [];
    const results = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const meta = metadata[i] || {};
      const firmaUrl = `/uploads/${req.tenantId}/firmas/${file.filename}`;

      try {
        const firma = await prisma.firma.create({
          data: {
            tenantId: req.tenantId!,
            vendedorId: meta.vendedorId || req.user!.id,
            clienteId: meta.clienteId,
            pedidoId: meta.pedidoId,
            cobranzaId: meta.cobranzaId,
            devolucionId: meta.devolucionId,
            tipo: meta.tipo || 'conformidad',
            firmaUrl,
            firmante: meta.firmante,
            timestamp: meta.timestamp ? new Date(meta.timestamp) : new Date(),
            appLocalId: meta.localId,
          },
        });
        results.push({ localId: meta.localId, serverId: firma.id, status: 'created', url: firmaUrl });
      } catch (err) {
        logger.error(`Push firma failed`, err);
        results.push({ localId: meta.localId, serverId: null, status: 'error', error: (err as Error).message });
      }
    }

    res.json({ ok: true, results, syncTimestamp: new Date().toISOString() });
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
