import { type ArchivoConfig } from '@prisma/client';
import archiver from 'archiver';
import { Writable } from 'stream';

// ─── Tipos ─────────────────────────────────────────────

export interface ParsedRow {
  [key: string]: unknown;
}

// ─── Parseo de archivos de import ──────────────────────

/**
 * Convierte un buffer de archivo del ERP a objetos JS aplicando la config.
 */
export function parseImportFile(buffer: Buffer, config: Partial<ArchivoConfig>): ParsedRow[] {
  const encoding = (config.encoding || 'latin1') as BufferEncoding;
  const separator = config.separador || ';';
  const skipRows = config.saltarFilas || 0;
  const hasHeader = config.tieneEncabezado !== false;
  const dateFormat = config.formatoFecha || 'yyyyMMdd';
  const decimalSep = config.separadorDecimal || '.';
  const mapping = (config.mapeoColumnas || {}) as Record<string, string>;

  // 1. Decodear
  let content: string;
  if (encoding === 'latin1' || encoding === 'binary') {
    content = buffer.toString('latin1');
  } else {
    content = buffer.toString(encoding);
  }

  // 2. Split por líneas
  let lines = content.split(/\r?\n/).filter((l) => l.trim() !== '');

  // 3. Saltar filas
  if (skipRows > 0) {
    lines = lines.slice(skipRows);
  }
  if (lines.length === 0) return [];

  // 4. Detectar columnas
  let headers: string[];
  let dataLines: string[];

  if (hasHeader) {
    headers = splitLine(lines[0], separator);
    dataLines = lines.slice(1);
  } else {
    // Sin encabezado: columnas numéricas
    const firstCols = splitLine(lines[0], separator);
    headers = firstCols.map((_, i) => `col_${i}`);
    dataLines = lines;
  }

  // 5. Parsear cada fila
  const rows: ParsedRow[] = [];
  for (const line of dataLines) {
    const values = splitLine(line, separator);
    const rawRow: Record<string, string> = {};
    for (let i = 0; i < headers.length; i++) {
      rawRow[headers[i].trim()] = (values[i] || '').trim();
    }

    // 6. Aplicar mapeo si existe
    const mappedRow: ParsedRow = {};
    const hasMapping = Object.keys(mapping).length > 0;

    if (hasMapping) {
      // mapping: { campoLocal: "COLUMNA_ARCHIVO" }
      for (const [localField, fileCol] of Object.entries(mapping)) {
        const val = rawRow[fileCol];
        if (val !== undefined) {
          mappedRow[localField] = convertValue(val, localField, dateFormat, decimalSep);
        }
      }
    } else {
      // Sin mapeo: retornar columnas originales
      for (const [key, val] of Object.entries(rawRow)) {
        mappedRow[key] = convertValue(val, key, dateFormat, decimalSep);
      }
    }

    rows.push(mappedRow);
  }

  // 7. Aplicar valores default
  if (config.valoresDefault) {
    const defaults = config.valoresDefault as Record<string, unknown>;
    for (const row of rows) {
      for (const [key, val] of Object.entries(defaults)) {
        if (row[key] === undefined || row[key] === null || row[key] === '') {
          row[key] = val;
        }
      }
    }
  }

  return rows;
}

/**
 * Parsea un buffer sin config (auto-detecta separador y headers).
 * Retorna columnas + rows raw sin mapear.
 */
export function parseRawFile(
  buffer: Buffer,
  encoding: BufferEncoding = 'latin1',
): { columns: string[]; rows: ParsedRow[]; totalRows: number } {
  let content: string;
  if (encoding === 'latin1' || encoding === 'binary') {
    content = buffer.toString('latin1');
  } else {
    content = buffer.toString(encoding);
  }

  const lines = content.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lines.length === 0) return { columns: [], rows: [], totalRows: 0 };

  // Auto-detectar separador
  const sep = detectSeparator(lines[0]);
  const headers = splitLine(lines[0], sep);
  const dataLines = lines.slice(1);

  const rows: ParsedRow[] = [];
  for (const line of dataLines) {
    const values = splitLine(line, sep);
    const row: ParsedRow = {};
    for (let i = 0; i < headers.length; i++) {
      row[headers[i].trim()] = (values[i] || '').trim();
    }
    rows.push(row);
  }

  return { columns: headers.map((h) => h.trim()), rows, totalRows: rows.length };
}

// ─── Generación de archivos de export ──────────────────

/**
 * Convierte datos de PostgreSQL a un Buffer para el ERP.
 */
export function generateExportFile(datos: Record<string, unknown>[], config: Partial<ArchivoConfig>): Buffer {
  const separator = config.separador || ';';
  const encoding = (config.encoding || 'latin1') as BufferEncoding;
  const dateFormat = config.formatoFecha || 'yyyyMMdd';
  const decimalSep = config.separadorDecimal || '.';
  const hasHeader = config.tieneEncabezado !== false;
  const mapping = (config.mapeoColumnas || {}) as Record<string, string>;

  // mapping export: { COL_ERP: "campoLocal" }
  const erpColumns = Object.keys(mapping);

  const lines: string[] = [];

  // Header
  if (hasHeader && erpColumns.length > 0) {
    lines.push(erpColumns.join(separator));
  }

  // Datos
  for (const row of datos) {
    const values: string[] = [];
    for (const erpCol of erpColumns) {
      const localField = mapping[erpCol];
      const val = row[localField];
      values.push(formatExportValue(val, dateFormat, decimalSep));
    }
    lines.push(values.join(separator));
  }

  const content = lines.join('\r\n') + '\r\n';

  if (encoding === 'latin1' || encoding === 'binary') {
    return Buffer.from(content, 'latin1');
  }
  return Buffer.from(content, encoding);
}

/**
 * Genera un export con mapping por defecto (sin ArchivoConfig).
 */
export function generateDefaultExportFile(
  datos: Record<string, unknown>[],
  columns: Record<string, string>, // { COL_ERP: "campoLocal" }
  separator = ';',
  encoding: BufferEncoding = 'latin1',
  dateFormat = 'yyyyMMdd',
  decimalSep = '.',
): Buffer {
  return generateExportFile(datos, {
    mapeoColumnas: columns,
    separador: separator,
    encoding,
    formatoFecha: dateFormat,
    separadorDecimal: decimalSep,
    tieneEncabezado: true,
  } as Partial<ArchivoConfig>);
}

// ─── ZIP ───────────────────────────────────────────────

/**
 * Genera un ZIP con múltiples archivos.
 */
export async function generateZip(
  archivos: { nombre: string; buffer: Buffer }[],
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const writable = new Writable({
      write(chunk: Buffer, _encoding, callback) {
        chunks.push(chunk);
        callback();
      },
    });

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', reject);
    archive.pipe(writable);

    for (const archivo of archivos) {
      archive.append(archivo.buffer, { name: archivo.nombre });
    }

    writable.on('finish', () => {
      resolve(Buffer.concat(chunks));
    });

    archive.finalize();
  });
}

// ─── Helpers ───────────────────────────────────────────

function splitLine(line: string, separator: string): string[] {
  // Manejar comillas
  if (line.includes('"')) {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === separator && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  }
  return line.split(separator);
}

function detectSeparator(firstLine: string): string {
  const counts = {
    ';': (firstLine.match(/;/g) || []).length,
    ',': (firstLine.match(/,/g) || []).length,
    '\t': (firstLine.match(/\t/g) || []).length,
    '|': (firstLine.match(/\|/g) || []).length,
  };
  let best = ';';
  let max = 0;
  for (const [sep, count] of Object.entries(counts)) {
    if (count > max) {
      max = count;
      best = sep;
    }
  }
  return best;
}

function convertValue(val: string, fieldName: string, dateFormat: string, decimalSep: string): unknown {
  if (val === '') return null;

  // Detectar campos de fecha por nombre
  const lowerField = fieldName.toLowerCase();
  if (lowerField.includes('fecha') || lowerField.includes('date') || lowerField.includes('vencimiento')) {
    const parsed = parseDateValue(val, dateFormat);
    if (parsed) return parsed;
  }

  // Detectar campos numéricos por nombre
  if (
    lowerField.includes('precio') ||
    lowerField.includes('monto') ||
    lowerField.includes('total') ||
    lowerField.includes('saldo') ||
    lowerField.includes('stock') ||
    lowerField.includes('cantidad') ||
    lowerField.includes('debe') ||
    lowerField.includes('haber') ||
    lowerField.includes('descuento') ||
    lowerField.includes('iva') ||
    lowerField.includes('importe') ||
    lowerField.includes('limite')
  ) {
    const num = parseNumberValue(val, decimalSep);
    if (num !== null) return num;
  }

  // Intentar conversión automática
  if (decimalSep !== '.') {
    const normalized = val.replace(decimalSep, '.');
    if (/^-?\d+\.\d+$/.test(normalized)) {
      return parseFloat(normalized);
    }
  }
  if (/^-?\d+$/.test(val)) {
    return parseInt(val, 10);
  }

  return val;
}

function parseDateValue(val: string, format: string): Date | null {
  if (!val || val.length < 6) return null;

  // Limpiar separadores
  const cleaned = val.replace(/[/\-\.]/g, '');

  try {
    if (format === 'yyyyMMdd' && cleaned.length === 8) {
      const y = parseInt(cleaned.substring(0, 4), 10);
      const m = parseInt(cleaned.substring(4, 6), 10) - 1;
      const d = parseInt(cleaned.substring(6, 8), 10);
      return new Date(y, m, d);
    }

    if (format === 'ddMMyyyy' && cleaned.length === 8) {
      const d = parseInt(cleaned.substring(0, 2), 10);
      const m = parseInt(cleaned.substring(2, 4), 10) - 1;
      const y = parseInt(cleaned.substring(4, 8), 10);
      return new Date(y, m, d);
    }

    if ((format === 'dd/MM/yyyy' || format === 'dd-MM-yyyy') && val.length >= 8) {
      const parts = val.split(/[/\-\.]/);
      if (parts.length === 3) {
        return new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
      }
    }

    // Fallback: Date.parse
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d;
  } catch {
    // ignore
  }

  return null;
}

function parseNumberValue(val: string, decimalSep: string): number | null {
  if (!val) return null;
  let normalized = val.trim();

  // Reemplazar separador decimal
  if (decimalSep === ',') {
    // Remover puntos de miles, reemplazar coma decimal
    normalized = normalized.replace(/\./g, '').replace(',', '.');
  }

  const num = parseFloat(normalized);
  return isNaN(num) ? null : num;
}

function formatExportValue(val: unknown, dateFormat: string, decimalSep: string): string {
  if (val === null || val === undefined) return '';

  if (val instanceof Date) {
    return formatDateForExport(val, dateFormat);
  }

  if (typeof val === 'number') {
    let str = val.toString();
    if (decimalSep !== '.') {
      str = str.replace('.', decimalSep);
    }
    return str;
  }

  // String: quitar saltos de línea
  return String(val).replace(/[\r\n]/g, ' ').trim();
}

function formatDateForExport(date: Date, format: string): string {
  const y = date.getFullYear().toString();
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');

  switch (format) {
    case 'yyyyMMdd': return `${y}${m}${d}`;
    case 'dd/MM/yyyy': return `${d}/${m}/${y}`;
    case 'dd-MM-yyyy': return `${d}-${m}-${y}`;
    case 'ddMMyyyy': return `${d}${m}${y}`;
    case 'yyyy-MM-dd': return `${y}-${m}-${d}`;
    default: return `${y}${m}${d}`;
  }
}
