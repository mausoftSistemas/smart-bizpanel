import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authMiddleware, requireRole } from '../middleware/auth.middleware';
import { tenantMiddleware } from '../middleware/tenant.middleware';
import { successResponse } from '../utils/helpers';
import { ValidationError } from '../utils/errors';
import {
  parseUploadedFile,
  executeImport,
  generateTemplateCsv,
  generateTemplateXlsx,
  getImportHistory,
  ENTITY_TEMPLATES,
} from '../services/import.service';
import { autoMap, guardarMapeo } from '../services/ai-mapper.service';

const router = Router();

// ─── Multer config ─────────────────────────────────────

const uploadDir = path.join(process.env.IMPORT_TEMP_DIR || '/tmp', 'imports', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const ALLOWED_EXTENSIONS = ['.csv', '.txt', '.json', '.xlsx', '.xls'];
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
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

// ─── POST /api/import/upload ───────────────────────────
// Sube un archivo y retorna las columnas detectadas + preview

router.post('/upload', upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      throw new ValidationError('No se recibió ningún archivo. Enviá el archivo en el campo "file".');
    }

    const result = await parseUploadedFile(req.file.path, req.file.originalname);
    successResponse(res, result);
  } catch (err) {
    // Limpiar archivo si hubo error
    if (req.file?.path) {
      try { fs.unlinkSync(req.file.path); } catch { /* ignore */ }
    }
    next(err);
  }
});

// ─── POST /api/import/map ──────────────────────────────
// Ejecuta la importación con el mapping dado

router.post('/map', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fileId, entityType, mapping, options } = req.body;

    if (!fileId || typeof fileId !== 'string') {
      throw new ValidationError('fileId es obligatorio');
    }
    if (!entityType || !ENTITY_TEMPLATES[entityType]) {
      throw new ValidationError(`entityType inválido. Use: ${Object.keys(ENTITY_TEMPLATES).join(', ')}`);
    }
    if (!mapping || typeof mapping !== 'object' || Object.keys(mapping).length === 0) {
      throw new ValidationError('mapping es obligatorio y debe tener al menos un campo');
    }

    const result = await executeImport(
      fileId,
      entityType,
      mapping,
      options || {},
      req.tenantId!,
      req.user!.id,
    );

    successResponse(res, result);
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/import/auto-map ────────────────────────
// Sugiere un mapeo automático basado en historial o IA

router.post('/auto-map', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { entityType, columns, sampleData } = req.body;

    if (!entityType || !ENTITY_TEMPLATES[entityType]) {
      throw new ValidationError(`entityType inválido. Use: ${Object.keys(ENTITY_TEMPLATES).join(', ')}`);
    }
    if (!Array.isArray(columns) || columns.length === 0) {
      throw new ValidationError('columns es obligatorio y debe ser un array no vacío');
    }

    const result = await autoMap(req.tenantId!, entityType, columns, sampleData);
    successResponse(res, result);
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/import/save-mapping ───────────────────
// Guarda un mapeo confirmado para reutilizar

router.post('/save-mapping', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { entityType, nombre, columnasArchivo, mapping, defaultValues, opciones } = req.body;

    if (!entityType || !ENTITY_TEMPLATES[entityType]) {
      throw new ValidationError(`entityType inválido. Use: ${Object.keys(ENTITY_TEMPLATES).join(', ')}`);
    }
    if (!nombre || typeof nombre !== 'string' || !nombre.trim()) {
      throw new ValidationError('nombre es obligatorio');
    }
    if (!Array.isArray(columnasArchivo) || columnasArchivo.length === 0) {
      throw new ValidationError('columnasArchivo es obligatorio y debe ser un array no vacío');
    }
    if (!mapping || typeof mapping !== 'object' || Object.keys(mapping).length === 0) {
      throw new ValidationError('mapping es obligatorio y debe tener al menos un campo');
    }

    const result = await guardarMapeo(
      req.tenantId!,
      entityType,
      nombre.trim(),
      columnasArchivo,
      mapping,
      defaultValues,
      opciones,
    );

    successResponse(res, result);
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/import/templates/:entityType ─────────────
// Descarga un template CSV o XLSX

router.get('/templates/:entityType', (req: Request, res: Response, next: NextFunction) => {
  try {
    const entityType = req.params.entityType as string;
    const format = (req.query.format as string) || 'csv';

    if (!ENTITY_TEMPLATES[entityType]) {
      throw new ValidationError(`Tipo no soportado: ${entityType}. Use: ${Object.keys(ENTITY_TEMPLATES).join(', ')}`);
    }

    if (format === 'xlsx') {
      const buffer = generateTemplateXlsx(entityType);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=template_${entityType}.xlsx`);
      res.send(buffer);
    } else {
      const csv = generateTemplateCsv(entityType);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=template_${entityType}.csv`);
      // BOM para Excel
      res.send('\ufeff' + csv);
    }
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/import/history ───────────────────────────
// Historial de importaciones del tenant

router.get('/history', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const history = await getImportHistory(req.tenantId!, limit);
    successResponse(res, history);
  } catch (err) {
    next(err);
  }
});

export default router;
