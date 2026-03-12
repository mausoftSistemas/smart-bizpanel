import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authMiddleware, requireRole } from '../middleware/auth.middleware';
import { tenantMiddleware } from '../middleware/tenant.middleware';
import { successResponse } from '../utils/helpers';
import { ValidationError } from '../utils/errors';
import {
  uploadBatch,
  processBatch,
  getExportPreview,
  generateExport,
  downloadExport,
  getExportHistory,
  getImportHistory,
  getIntercambioConfig,
  upsertFullConfig,
  deleteIntercambioConfig,
} from '../services/intercambio.service';

const router = Router();

// ─── Multer config (batch upload) ──────────────────────

const uploadDir = path.join(process.env.IMPORT_TEMP_DIR || '/tmp', 'imports', 'intercambio-raw');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.memoryStorage(); // Usamos memory para procesar encoding directo
const ALLOWED_EXTENSIONS = ['.csv', '.txt', '.json', '.xlsx', '.xls'];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE, files: 20 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EXTENSIONS.includes(ext)) {
      cb(null, true);
    } else {
      cb(new ValidationError(`Extensión no permitida: ${ext}. Use: ${ALLOWED_EXTENSIONS.join(', ')}`));
    }
  },
});

// ─── Middleware ─────────────────────────────────────────

router.use(authMiddleware, tenantMiddleware, requireRole('admin', 'supervisor'));

// ═══ IMPORT (SUBIDA) ═══════════════════════════════════

// POST /api/intercambio/import/upload-batch
// Sube múltiples archivos TXT del ERP y detecta mapeo
router.post(
  '/import/upload-batch',
  upload.array('archivos', 20),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        throw new ValidationError('No se recibieron archivos. Enviá los archivos en el campo "archivos".');
      }

      const result = await uploadBatch(
        req.tenantId!,
        files.map((f) => ({ buffer: f.buffer, originalname: f.originalname })),
      );

      successResponse(res, { archivos: result });
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/intercambio/import/process-batch
// Procesa los archivos subidos con el mapeo dado
router.post('/import/process-batch', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { archivos, guardarConfig, nombreConfig } = req.body;

    if (!Array.isArray(archivos) || archivos.length === 0) {
      throw new ValidationError('archivos es obligatorio y debe ser un array no vacío');
    }

    for (const a of archivos) {
      if (!a.fileId || !a.entidad || !a.mapping) {
        throw new ValidationError('Cada archivo debe tener fileId, entidad y mapping');
      }
    }

    const result = await processBatch(
      req.tenantId!,
      req.user!.id,
      archivos,
      guardarConfig ? { nombre: nombreConfig || 'Sin nombre' } : undefined,
    );

    successResponse(res, result);
  } catch (err) {
    next(err);
  }
});

// GET /api/intercambio/import/history
router.get('/import/history', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const history = await getImportHistory(req.tenantId!, limit);
    successResponse(res, history);
  } catch (err) {
    next(err);
  }
});

// ═══ EXPORT (BAJADA) ═══════════════════════════════════

// GET /api/intercambio/export/preview
router.get('/export/preview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const desde = req.query.desde ? new Date(req.query.desde as string) : new Date(new Date().setDate(new Date().getDate() - 7));
    const hasta = req.query.hasta ? new Date(req.query.hasta as string) : new Date();

    if (isNaN(desde.getTime()) || isNaN(hasta.getTime())) {
      throw new ValidationError('Fechas inválidas. Usar formato YYYY-MM-DD.');
    }

    // Ajustar hasta al final del día
    hasta.setHours(23, 59, 59, 999);

    const preview = await getExportPreview(req.tenantId!, desde, hasta);
    successResponse(res, preview);
  } catch (err) {
    next(err);
  }
});

// POST /api/intercambio/export/generate
router.post('/export/generate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { entidades, desde, hasta, soloNuevos } = req.body;

    if (!Array.isArray(entidades) || entidades.length === 0) {
      throw new ValidationError('entidades es obligatorio. Use: pedidos, cobranzas, excusas');
    }

    const validEntities = ['pedidos', 'cobranzas', 'excusas'];
    for (const e of entidades) {
      if (!validEntities.includes(e)) {
        throw new ValidationError(`Entidad no válida: ${e}. Use: ${validEntities.join(', ')}`);
      }
    }

    const desdeDate = desde ? new Date(desde) : new Date(new Date().setDate(new Date().getDate() - 7));
    const hastaDate = hasta ? new Date(hasta) : new Date();
    hastaDate.setHours(23, 59, 59, 999);

    const { zipBuffer, logId } = await generateExport(
      req.tenantId!,
      req.user!.id,
      entidades,
      desdeDate,
      hastaDate,
      soloNuevos !== false,
    );

    const dateStr = hastaDate.toISOString().slice(0, 10).replace(/-/g, '');
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename=export_${dateStr}.zip`);
    res.setHeader('X-Log-Id', logId);
    res.send(zipBuffer);
  } catch (err) {
    next(err);
  }
});

// GET /api/intercambio/export/download/:logId
router.get('/export/download/:logId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const logId = req.params.logId as string;
    const zipBuffer = await downloadExport(logId, req.tenantId!);

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename=export_${logId.substring(0, 8)}.zip`);
    res.send(zipBuffer);
  } catch (err) {
    next(err);
  }
});

// GET /api/intercambio/export/history
router.get('/export/history', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const history = await getExportHistory(req.tenantId!, limit);
    successResponse(res, history);
  } catch (err) {
    next(err);
  }
});

// ═══ CONFIG ════════════════════════════════════════════

// GET /api/intercambio/config
router.get('/config', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const configs = await getIntercambioConfig(req.tenantId!);
    successResponse(res, configs);
  } catch (err) {
    next(err);
  }
});

// POST /api/intercambio/config
router.post('/config', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id, nombre, archivos } = req.body;
    if (!nombre || typeof nombre !== 'string') {
      throw new ValidationError('nombre es obligatorio');
    }
    if (!Array.isArray(archivos) || archivos.length === 0) {
      throw new ValidationError('archivos es obligatorio y debe ser un array no vacío');
    }

    const result = await upsertFullConfig(req.tenantId!, id || null, nombre, archivos);
    successResponse(res, result);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/intercambio/config/:id
router.delete('/config/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const configId = req.params.id as string;
    await deleteIntercambioConfig(configId, req.tenantId!);
    successResponse(res, { deleted: true });
  } catch (err) {
    next(err);
  }
});

export default router;
