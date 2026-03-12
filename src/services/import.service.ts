import { PrismaClient, Prisma } from '@prisma/client';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

// ─── Tipos ─────────────────────────────────────────────

export interface ParsedFile {
  fileId: string;
  fileName: string;
  columns: string[];
  preview: Record<string, unknown>[];
  totalRows: number;
}

export interface ImportMapping {
  [destField: string]: string; // campo destino ← columna del archivo
}

export interface ImportOptions {
  updateExisting?: boolean;
  skipErrors?: boolean;
  defaultValues?: Record<string, unknown>;
}

export interface ImportResult {
  imported: number;
  updated: number;
  skipped: number;
  errors: { row: number; error: string; data: Record<string, unknown> }[];
}

export interface RowError {
  row: number;
  error: string;
  data: Record<string, unknown>;
}

// ─── Templates por entidad ─────────────────────────────

export const ENTITY_TEMPLATES: Record<string, { columns: string[]; required: string[] }> = {
  productos: {
    columns: ['codigo', 'nombre', 'descripcion', 'categoria', 'marca', 'precioLista', 'moneda', 'stockBulto', 'stockUnidad', 'equivalencia', 'unidadMedida', 'ivaPorcentaje', 'codigoBarras'],
    required: ['codigo', 'nombre', 'precioLista'],
  },
  clientes: {
    columns: ['codigo', 'nombre', 'cuit', 'condicionIva', 'condicionVenta', 'direccion', 'ciudad', 'provincia', 'telefono', 'email', 'limiteCredito', 'vendedorCodigo'],
    required: ['codigo', 'nombre'],
  },
  facturas: {
    columns: ['clienteCodigo', 'tipo', 'numero', 'fecha', 'fechaVencimiento', 'monto', 'observaciones'],
    required: ['clienteCodigo', 'tipo', 'numero', 'fecha', 'monto'],
  },
  precios: {
    columns: ['clienteCodigo', 'productoCodigo', 'precioEspecial', 'descuentoPorcentaje'],
    required: ['clienteCodigo', 'productoCodigo', 'precioEspecial'],
  },
};

// ─── Directorio temporal ───────────────────────────────

const IMPORT_DIR = path.join(process.env.IMPORT_TEMP_DIR || '/tmp', 'imports');

function ensureImportDir() {
  if (!fs.existsSync(IMPORT_DIR)) {
    fs.mkdirSync(IMPORT_DIR, { recursive: true });
  }
}

function getFilePath(fileId: string): string {
  return path.join(IMPORT_DIR, `${fileId}.json`);
}

// ─── Parseo de archivos ────────────────────────────────

export async function parseUploadedFile(filePath: string, originalName: string): Promise<ParsedFile> {
  ensureImportDir();
  const ext = path.extname(originalName).toLowerCase();
  let rows: Record<string, unknown>[];

  if (ext === '.csv' || ext === '.txt') {
    rows = await parseCsv(filePath);
  } else if (ext === '.json') {
    rows = parseJson(filePath);
  } else if (ext === '.xlsx' || ext === '.xls') {
    rows = parseExcel(filePath);
  } else {
    throw new ValidationError(`Formato no soportado: ${ext}. Use CSV, TXT, JSON, XLSX o XLS.`);
  }

  if (rows.length === 0) {
    throw new ValidationError('El archivo está vacío o no contiene datos válidos');
  }

  const columns = Object.keys(rows[0]);
  const fileId = uuidv4();

  // Guardar datos parseados en temporal
  fs.writeFileSync(getFilePath(fileId), JSON.stringify(rows));

  // Limpiar archivo original subido
  try { fs.unlinkSync(filePath); } catch { /* ignore */ }

  return {
    fileId,
    fileName: originalName,
    columns,
    preview: rows.slice(0, 5),
    totalRows: rows.length,
  };
}

async function parseCsv(filePath: string): Promise<Record<string, unknown>[]> {
  const content = fs.readFileSync(filePath, 'utf-8');

  // Detectar separador: punto y coma, coma, tab
  const firstLine = content.split('\n')[0] || '';
  let delimiter = ',';
  if (firstLine.includes(';') && !firstLine.includes(',')) delimiter = ';';
  else if (firstLine.includes('\t') && !firstLine.includes(',') && !firstLine.includes(';')) delimiter = '\t';
  // Si tiene punto y coma más frecuente que coma, usar punto y coma
  else if ((firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length) delimiter = ';';

  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, unknown>>(content, {
      header: true,
      delimiter,
      skipEmptyLines: true,
      dynamicTyping: true,
      complete: (results) => resolve(results.data),
      error: (err: Error) => reject(new ValidationError(`Error al parsear CSV: ${err.message}`)),
    });
  });
}

function parseJson(filePath: string): Record<string, unknown>[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) return parsed;
    if (typeof parsed === 'object' && parsed !== null) return [parsed];
    throw new ValidationError('El JSON debe ser un array de objetos o un objeto');
  } catch (err) {
    if (err instanceof ValidationError) throw err;
    throw new ValidationError('JSON inválido');
  }
}

function parseExcel(filePath: string): Record<string, unknown>[] {
  const buffer = fs.readFileSync(filePath);
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new ValidationError('El archivo Excel no contiene hojas');
  const sheet = wb.Sheets[sheetName];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
}

// ─── Leer datos parseados ──────────────────────────────

function readParsedData(fileId: string): Record<string, unknown>[] {
  const fp = getFilePath(fileId);
  if (!fs.existsSync(fp)) {
    throw new ValidationError('Archivo no encontrado. Puede haber expirado. Subí el archivo nuevamente.');
  }
  return JSON.parse(fs.readFileSync(fp, 'utf-8'));
}

// ─── Aplicar mapping + defaults ────────────────────────

function applyMapping(
  row: Record<string, unknown>,
  mapping: ImportMapping,
  defaults: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...defaults };
  for (const [destField, sourceCol] of Object.entries(mapping)) {
    if (sourceCol && row[sourceCol] !== undefined && row[sourceCol] !== null && row[sourceCol] !== '') {
      result[destField] = row[sourceCol];
    }
  }
  return result;
}

// ─── Validación por entidad ────────────────────────────

function validateRow(entityType: string, data: Record<string, unknown>, rowNum: number): string | null {
  const template = ENTITY_TEMPLATES[entityType];
  if (!template) return `Tipo de entidad desconocido: ${entityType}`;

  for (const field of template.required) {
    if (data[field] === undefined || data[field] === null || data[field] === '') {
      return `Campo obligatorio vacío: ${field}`;
    }
  }

  // Validaciones específicas
  if (entityType === 'productos') {
    const precio = Number(data.precioLista);
    if (isNaN(precio) || precio < 0) return 'precioLista debe ser un número >= 0';
  }

  if (entityType === 'clientes') {
    if (data.email && typeof data.email === 'string' && !data.email.includes('@')) {
      return 'Email inválido';
    }
  }

  if (entityType === 'facturas') {
    const monto = Number(data.monto);
    if (isNaN(monto)) return 'monto debe ser un número';
    const tiposValidos = ['factura', 'nota_credito', 'nota_debito', 'recibo', 'nc', 'nd'];
    if (!tiposValidos.includes(String(data.tipo).toLowerCase())) {
      return `tipo inválido: ${data.tipo}. Usar: factura, nota_credito, nota_debito, recibo`;
    }
  }

  if (entityType === 'precios') {
    const precio = Number(data.precioEspecial);
    if (isNaN(precio) || precio < 0) return 'precioEspecial debe ser un número >= 0';
  }

  return null;
}

// ─── Importación por entidad ───────────────────────────

export async function executeImport(
  fileId: string,
  entityType: string,
  mapping: ImportMapping,
  options: ImportOptions,
  tenantId: string,
  userId: string,
): Promise<ImportResult> {
  if (!ENTITY_TEMPLATES[entityType]) {
    throw new ValidationError(`Tipo de entidad no soportado: ${entityType}`);
  }

  const rows = readParsedData(fileId);
  const defaults = options.defaultValues || {};
  const result: ImportResult = { imported: 0, updated: 0, skipped: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 1;
    const mapped = applyMapping(rows[i], mapping, defaults);

    try {
      const validationError = validateRow(entityType, mapped, rowNum);
      if (validationError) {
        result.errors.push({ row: rowNum, error: validationError, data: mapped });
        if (!options.skipErrors) break;
        continue;
      }

      const rowResult = await importRow(entityType, mapped, tenantId, options.updateExisting ?? true);
      if (rowResult === 'created') result.imported++;
      else if (rowResult === 'updated') result.updated++;
      else if (rowResult === 'skipped') result.skipped++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      result.errors.push({ row: rowNum, error: msg, data: mapped });
      if (!options.skipErrors) break;
    }
  }

  // Registrar en ImportLog
  await prisma.importLog.create({
    data: {
      tenantId,
      userId,
      fileName: fileId,
      entityType,
      totalRows: rows.length,
      imported: result.imported,
      updated: result.updated,
      skipped: result.skipped,
      errors: result.errors.length,
      errorDetail: result.errors.length > 0 ? (JSON.parse(JSON.stringify(result.errors)) as Prisma.InputJsonValue) : undefined,
      mapping: JSON.parse(JSON.stringify(mapping)) as Prisma.InputJsonValue,
    },
  });

  // Limpiar archivo temporal
  try { fs.unlinkSync(getFilePath(fileId)); } catch { /* ignore */ }

  logger.info(`Import ${entityType}: ${result.imported} created, ${result.updated} updated, ${result.errors.length} errors [tenant=${tenantId}]`);

  return result;
}

async function importRow(
  entityType: string,
  data: Record<string, unknown>,
  tenantId: string,
  updateExisting: boolean,
): Promise<'created' | 'updated' | 'skipped'> {
  switch (entityType) {
    case 'productos': return importProducto(data, tenantId, updateExisting);
    case 'clientes': return importCliente(data, tenantId, updateExisting);
    case 'facturas': return importFactura(data, tenantId);
    case 'precios': return importPrecio(data, tenantId, updateExisting);
    default: throw new ValidationError(`Tipo no soportado: ${entityType}`);
  }
}

// ── Producto ───────────────────────────────────────────

async function importProducto(
  data: Record<string, unknown>,
  tenantId: string,
  updateExisting: boolean,
): Promise<'created' | 'updated' | 'skipped'> {
  const codigo = String(data.codigo).trim();
  const existing = await prisma.producto.findUnique({
    where: { tenantId_codigo: { tenantId, codigo } },
  });

  const fields = {
    nombre: String(data.nombre || ''),
    descripcion: data.descripcion ? String(data.descripcion) : null,
    categoria: data.categoria ? String(data.categoria) : null,
    marca: data.marca ? String(data.marca) : null,
    precioLista: Number(data.precioLista) || 0,
    moneda: data.moneda ? String(data.moneda) : 'ARS',
    stockBulto: data.stockBulto !== undefined ? Number(data.stockBulto) : 0,
    stockUnidad: data.stockUnidad !== undefined ? Number(data.stockUnidad) : 0,
    equivalencia: data.equivalencia !== undefined ? Number(data.equivalencia) : 1,
    unidadMedida: data.unidadMedida ? String(data.unidadMedida) : 'UN',
    ivaPorcentaje: data.ivaPorcentaje !== undefined ? Number(data.ivaPorcentaje) : 21,
    codigoBarras: data.codigoBarras ? String(data.codigoBarras) : null,
    activo: data.activo !== undefined ? Boolean(data.activo) : true,
  };

  if (existing) {
    if (!updateExisting) return 'skipped';
    await prisma.producto.update({
      where: { id: existing.id },
      data: fields,
    });
    return 'updated';
  }

  await prisma.producto.create({
    data: { tenantId, codigo, ...fields },
  });
  return 'created';
}

// ── Cliente ────────────────────────────────────────────

async function importCliente(
  data: Record<string, unknown>,
  tenantId: string,
  updateExisting: boolean,
): Promise<'created' | 'updated' | 'skipped'> {
  const codigo = String(data.codigo).trim();
  const existing = await prisma.cliente.findUnique({
    where: { tenantId_codigo: { tenantId, codigo } },
  });

  // Resolver vendedorId si viene vendedorCodigo
  let vendedorId: string | undefined;
  if (data.vendedorCodigo) {
    const vendedor = await prisma.user.findFirst({
      where: { tenantId, email: { contains: String(data.vendedorCodigo), mode: 'insensitive' } },
    });
    if (vendedor) vendedorId = vendedor.id;
  }

  const fields = {
    nombre: String(data.nombre || ''),
    cuit: data.cuit ? String(data.cuit) : null,
    condicionIva: data.condicionIva ? String(data.condicionIva) : null,
    condicionVenta: data.condicionVenta ? String(data.condicionVenta) : null,
    direccion: data.direccion ? String(data.direccion) : null,
    ciudad: data.ciudad ? String(data.ciudad) : null,
    provincia: data.provincia ? String(data.provincia) : null,
    telefono: data.telefono ? String(data.telefono) : null,
    email: data.email ? String(data.email) : null,
    limiteCredito: data.limiteCredito !== undefined ? Number(data.limiteCredito) : 0,
    ...(vendedorId && { vendedorId }),
    activo: data.activo !== undefined ? Boolean(data.activo) : true,
  };

  if (existing) {
    if (!updateExisting) return 'skipped';
    await prisma.cliente.update({
      where: { id: existing.id },
      data: fields,
    });
    return 'updated';
  }

  await prisma.cliente.create({
    data: { tenantId, codigo, ...fields },
  });
  return 'created';
}

// ── Factura (Cuenta Corriente) ─────────────────────────

async function importFactura(
  data: Record<string, unknown>,
  tenantId: string,
): Promise<'created' | 'updated' | 'skipped'> {
  const clienteCodigo = String(data.clienteCodigo).trim();
  const cliente = await prisma.cliente.findUnique({
    where: { tenantId_codigo: { tenantId, codigo: clienteCodigo } },
  });
  if (!cliente) throw new Error(`Cliente no encontrado: ${clienteCodigo}`);

  const tipoRaw = String(data.tipo).toLowerCase().trim();
  const tipoMap: Record<string, string> = {
    factura: 'factura',
    nc: 'nota_credito',
    nota_credito: 'nota_credito',
    nd: 'nota_debito',
    nota_debito: 'nota_debito',
    recibo: 'recibo',
  };
  const tipoMovimiento = tipoMap[tipoRaw] || tipoRaw;
  const monto = Number(data.monto) || 0;

  // Facturas y ND van a debe, NC y recibos van a haber
  const esDebe = ['factura', 'nota_debito'].includes(tipoMovimiento);

  await prisma.cuentaCorriente.create({
    data: {
      tenantId,
      clienteId: cliente.id,
      tipoMovimiento,
      numero: data.numero ? String(data.numero) : null,
      fecha: data.fecha ? new Date(String(data.fecha)) : new Date(),
      fechaVencimiento: data.fechaVencimiento ? new Date(String(data.fechaVencimiento)) : null,
      debe: esDebe ? monto : 0,
      haber: esDebe ? 0 : monto,
      saldo: esDebe ? monto : -monto,
      estado: 'pendiente',
    },
  });

  // Actualizar saldo del cliente
  const agg = await prisma.cuentaCorriente.aggregate({
    where: { clienteId: cliente.id, tenantId },
    _sum: { debe: true, haber: true },
  });
  const saldo = (agg._sum.debe || 0) - (agg._sum.haber || 0);
  await prisma.cliente.update({
    where: { id: cliente.id },
    data: { saldoCuenta: saldo },
  });

  return 'created';
}

// ── Precio especial ────────────────────────────────────

async function importPrecio(
  data: Record<string, unknown>,
  tenantId: string,
  updateExisting: boolean,
): Promise<'created' | 'updated' | 'skipped'> {
  const clienteCodigo = String(data.clienteCodigo).trim();
  const productoCodigo = String(data.productoCodigo).trim();

  const cliente = await prisma.cliente.findUnique({
    where: { tenantId_codigo: { tenantId, codigo: clienteCodigo } },
  });
  if (!cliente) throw new Error(`Cliente no encontrado: ${clienteCodigo}`);

  const producto = await prisma.producto.findUnique({
    where: { tenantId_codigo: { tenantId, codigo: productoCodigo } },
  });
  if (!producto) throw new Error(`Producto no encontrado: ${productoCodigo}`);

  const existing = await prisma.precioCliente.findUnique({
    where: { tenantId_clienteId_productoId: { tenantId, clienteId: cliente.id, productoId: producto.id } },
  });

  const fields = {
    precio: Number(data.precioEspecial) || 0,
    descuento: data.descuentoPorcentaje !== undefined ? Number(data.descuentoPorcentaje) : 0,
    activo: true,
  };

  if (existing) {
    if (!updateExisting) return 'skipped';
    await prisma.precioCliente.update({
      where: { id: existing.id },
      data: fields,
    });
    return 'updated';
  }

  await prisma.precioCliente.create({
    data: { tenantId, clienteId: cliente.id, productoId: producto.id, ...fields },
  });
  return 'created';
}

// ─── Generar template CSV ──────────────────────────────

export function generateTemplateCsv(entityType: string): string {
  const template = ENTITY_TEMPLATES[entityType];
  if (!template) throw new ValidationError(`Tipo de entidad no soportado: ${entityType}`);
  return template.columns.join(',') + '\n';
}

export function generateTemplateXlsx(entityType: string): Buffer {
  const template = ENTITY_TEMPLATES[entityType];
  if (!template) throw new ValidationError(`Tipo de entidad no soportado: ${entityType}`);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([template.columns]);
  XLSX.utils.book_append_sheet(wb, ws, entityType);
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}

// ─── Historial ─────────────────────────────────────────

export async function getImportHistory(tenantId: string, limit = 50) {
  return prisma.importLog.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

// ─── Cleanup archivos temporales > 1 hora ──────────────

export function cleanupTempFiles() {
  ensureImportDir();
  const cutoff = Date.now() - 60 * 60 * 1000; // 1 hora

  try {
    const files = fs.readdirSync(IMPORT_DIR);
    let deleted = 0;
    for (const file of files) {
      const fp = path.join(IMPORT_DIR, file);
      const stat = fs.statSync(fp);
      if (stat.mtimeMs < cutoff) {
        fs.unlinkSync(fp);
        deleted++;
      }
    }
    if (deleted > 0) {
      logger.info(`Import cleanup: deleted ${deleted} temp files`);
    }
  } catch (err) {
    logger.error('Import cleanup failed', err);
  }
}
