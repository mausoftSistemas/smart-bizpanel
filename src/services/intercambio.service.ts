import { PrismaClient, Prisma } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { parseImportFile, parseRawFile, generateExportFile, generateDefaultExportFile, generateZip } from './file-converter.service';
import { autoMap } from './ai-mapper.service';
import { ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

// ─── Tipos ─────────────────────────────────────────────

export interface UploadedFileInfo {
  fileId: string;
  fileName: string;
  columns: string[];
  rows: number;
  configEncontrada: { id: string; nombre: string } | null;
  mappingSugerido: { source: string; mapping: Record<string, string> } | null;
  estado: 'listo' | 'pendiente';
}

export interface BatchProcessItem {
  fileId: string;
  entidad: string;
  mapping: Record<string, string>;
  opciones?: Record<string, unknown>;
  relacion?: { campoPadre: string; campoArchivo: string };
}

export interface BatchResult {
  archivo: string;
  entidad: string;
  importados: number;
  actualizados: number;
  errores: number;
  detalleErrores?: string[];
}

// ─── Directorios temporales ────────────────────────────

const IMPORT_DIR = path.join(process.env.IMPORT_TEMP_DIR || '/tmp', 'imports', 'intercambio');
const EXPORT_DIR = path.join(process.env.IMPORT_TEMP_DIR || '/tmp', 'exports');

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function saveTemp(fileId: string, data: unknown): void {
  ensureDir(IMPORT_DIR);
  fs.writeFileSync(path.join(IMPORT_DIR, `${fileId}.json`), JSON.stringify(data));
}

function readTemp(fileId: string): Record<string, unknown>[] {
  const fp = path.join(IMPORT_DIR, `${fileId}.json`);
  if (!fs.existsSync(fp)) {
    throw new ValidationError('Archivo no encontrado. Puede haber expirado.');
  }
  return JSON.parse(fs.readFileSync(fp, 'utf-8'));
}

function cleanTemp(fileId: string): void {
  try { fs.unlinkSync(path.join(IMPORT_DIR, `${fileId}.json`)); } catch { /* ignore */ }
}

// ─── UPLOAD BATCH ──────────────────────────────────────

export async function uploadBatch(
  tenantId: string,
  files: { buffer: Buffer; originalname: string }[],
): Promise<UploadedFileInfo[]> {
  const results: UploadedFileInfo[] = [];

  // Buscar configs guardadas del tenant
  const configs = await prisma.archivoConfig.findMany({
    where: {
      intercambio: { tenantId, activo: true },
      direccion: 'import',
      activo: true,
    },
    include: { intercambio: true },
  });

  for (const file of files) {
    const fileId = uuidv4();

    // Intentar detectar encoding (probar latin1 primero para ERPs argentinos)
    const parsed = parseRawFile(file.buffer, 'latin1');

    if (parsed.columns.length === 0 || parsed.totalRows === 0) {
      results.push({
        fileId,
        fileName: file.originalname,
        columns: [],
        rows: 0,
        configEncontrada: null,
        mappingSugerido: null,
        estado: 'pendiente',
      });
      continue;
    }

    // Guardar datos parseados en temp
    saveTemp(fileId, parsed.rows);

    // Buscar config por nombre de archivo
    const matchedConfig = configs.find(
      (c) => c.nombreArchivo.toLowerCase() === file.originalname.toLowerCase(),
    );

    let mappingSugerido: { source: string; mapping: Record<string, string> } | null = null;

    if (matchedConfig) {
      mappingSugerido = {
        source: 'saved',
        mapping: matchedConfig.mapeoColumnas as Record<string, string>,
      };
    } else {
      // Intentar auto-map con IA/historial
      try {
        const entityGuess = guessEntityFromFileName(file.originalname);
        if (entityGuess) {
          const autoResult = await autoMap(tenantId, entityGuess, parsed.columns, parsed.rows.slice(0, 5));
          if (autoResult.source !== 'none') {
            mappingSugerido = {
              source: autoResult.source,
              mapping: autoResult.mapping,
            };
          }
        }
      } catch {
        // Silenciar errores de auto-map
      }
    }

    results.push({
      fileId,
      fileName: file.originalname,
      columns: parsed.columns,
      rows: parsed.totalRows,
      configEncontrada: matchedConfig
        ? { id: matchedConfig.intercambioId, nombre: matchedConfig.intercambio.nombre }
        : null,
      mappingSugerido,
      estado: mappingSugerido ? 'listo' : 'pendiente',
    });
  }

  return results;
}

// ─── PROCESS BATCH ─────────────────────────────────────

// Orden de procesamiento por dependencias
const ENTITY_ORDER: Record<string, number> = {
  vendedores: 1,
  condicionesVenta: 2,
  motivosNoCompra: 3,
  clientes: 4,
  clientesTelefono: 5,
  rutas: 6,
  productos: 7,
  cuentaCorriente: 8,
};

export async function processBatch(
  tenantId: string,
  userId: string,
  items: BatchProcessItem[],
  guardarConfig?: { nombre: string },
): Promise<{ resultados: BatchResult[]; tiempoProcesamiento: string }> {
  const start = Date.now();

  // Ordenar por dependencias
  const sorted = [...items].sort((a, b) => {
    return (ENTITY_ORDER[a.entidad] || 99) - (ENTITY_ORDER[b.entidad] || 99);
  });

  const resultados: BatchResult[] = [];

  for (const item of sorted) {
    const rows = readTemp(item.fileId);

    // Aplicar mapping a los datos
    const mappedRows = rows.map((row) => {
      const mapped: Record<string, unknown> = {};
      for (const [localField, fileCol] of Object.entries(item.mapping)) {
        if (row[fileCol] !== undefined && row[fileCol] !== null) {
          mapped[localField] = row[fileCol];
        }
      }
      return mapped;
    });

    const result = await importEntity(tenantId, item.entidad, mappedRows, item.opciones, item.relacion);
    resultados.push({
      archivo: item.fileId,
      entidad: item.entidad,
      ...result,
    });

    // Limpiar temporal
    cleanTemp(item.fileId);
  }

  // Guardar configuración si se solicitó
  if (guardarConfig && guardarConfig.nombre) {
    try {
      await saveIntercambioConfig(tenantId, guardarConfig.nombre, items);
    } catch (err) {
      logger.warn('Error guardando config de intercambio', err);
    }
  }

  // Log
  await prisma.intercambioLog.create({
    data: {
      tenantId,
      direccion: 'import',
      usuario: userId,
      estado: resultados.some((r) => r.errores > 0) ? 'con_errores' : 'ok',
      archivos: JSON.parse(JSON.stringify(resultados)) as Prisma.InputJsonValue,
    },
  });

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  return { resultados, tiempoProcesamiento: `${elapsed} segundos` };
}

// ─── Import por entidad ────────────────────────────────

async function importEntity(
  tenantId: string,
  entidad: string,
  rows: Record<string, unknown>[],
  opciones?: Record<string, unknown>,
  relacion?: { campoPadre: string; campoArchivo: string },
): Promise<{ importados: number; actualizados: number; errores: number; detalleErrores?: string[] }> {
  let importados = 0;
  let actualizados = 0;
  const detalleErrores: string[] = [];
  const updateExisting = opciones?.actualizarExistentes !== false;

  for (let i = 0; i < rows.length; i++) {
    try {
      const result = await importSingleRow(tenantId, entidad, rows[i], updateExisting, relacion);
      if (result === 'created') importados++;
      else if (result === 'updated') actualizados++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      detalleErrores.push(`Fila ${i + 1}: ${msg}`);
    }
  }

  return { importados, actualizados, errores: detalleErrores.length, detalleErrores: detalleErrores.length > 0 ? detalleErrores : undefined };
}

async function importSingleRow(
  tenantId: string,
  entidad: string,
  data: Record<string, unknown>,
  updateExisting: boolean,
  relacion?: { campoPadre: string; campoArchivo: string },
): Promise<'created' | 'updated' | 'skipped'> {
  switch (entidad) {
    case 'productos': return importProducto(tenantId, data, updateExisting);
    case 'clientes': return importCliente(tenantId, data, updateExisting);
    case 'clientesTelefono': return importClienteTelefono(tenantId, data);
    case 'condicionesVenta': return importCondicionVenta(tenantId, data, updateExisting);
    case 'motivosNoCompra': return importMotivoNoCompra(tenantId, data, updateExisting);
    case 'vendedores': return importVendedor(tenantId, data, updateExisting);
    case 'rutas': return importRuta(tenantId, data);
    case 'cuentaCorriente': return importCuentaCorriente(tenantId, data);
    default:
      throw new ValidationError(`Entidad no soportada para intercambio: ${entidad}`);
  }
}

// ── Importadores individuales ──────────────────────────

async function importProducto(tenantId: string, data: Record<string, unknown>, update: boolean): Promise<'created' | 'updated' | 'skipped'> {
  const codigo = String(data.codigo || '').trim();
  if (!codigo) throw new Error('Código de producto vacío');

  const existing = await prisma.producto.findUnique({
    where: { tenantId_codigo: { tenantId, codigo } },
  });

  const fields = {
    nombre: String(data.nombre || codigo),
    descripcion: data.descripcion ? String(data.descripcion) : null,
    categoria: data.categoria ? String(data.categoria) : null,
    marca: data.marca ? String(data.marca) : null,
    precioLista: Number(data.precioLista || data.precio || 0),
    moneda: data.moneda ? String(data.moneda) : 'ARS',
    stockBulto: data.stockBulto !== undefined ? Number(data.stockBulto) : undefined,
    stockUnidad: data.stockUnidad !== undefined ? Number(data.stockUnidad) : undefined,
    equivalencia: data.equivalencia !== undefined ? Number(data.equivalencia) : undefined,
    unidadMedida: data.unidadMedida ? String(data.unidadMedida) : undefined,
    ivaPorcentaje: data.ivaPorcentaje !== undefined ? Number(data.ivaPorcentaje) : undefined,
    codigoBarras: data.codigoBarras ? String(data.codigoBarras) : undefined,
    activo: true,
  };

  // Limpiar undefined
  const cleanFields = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));

  if (existing) {
    if (!update) return 'skipped';
    await prisma.producto.update({ where: { id: existing.id }, data: cleanFields });
    return 'updated';
  }

  await prisma.producto.create({ data: { tenantId, codigo, ...cleanFields } as Prisma.ProductoUncheckedCreateInput });
  return 'created';
}

async function importCliente(tenantId: string, data: Record<string, unknown>, update: boolean): Promise<'created' | 'updated' | 'skipped'> {
  const codigo = String(data.codigo || '').trim();
  if (!codigo) throw new Error('Código de cliente vacío');

  const existing = await prisma.cliente.findUnique({
    where: { tenantId_codigo: { tenantId, codigo } },
  });

  // Resolver vendedorId
  let vendedorId: string | undefined;
  if (data.vendedorCodigo) {
    const vendedor = await prisma.user.findFirst({
      where: { tenantId, email: { contains: String(data.vendedorCodigo), mode: 'insensitive' } },
    });
    if (vendedor) vendedorId = vendedor.id;
  }

  const fields: Record<string, unknown> = {
    nombre: String(data.nombre || codigo),
    cuit: data.cuit ? String(data.cuit) : null,
    condicionIva: data.condicionIva ? String(data.condicionIva) : null,
    condicionVenta: data.condicionVenta ? String(data.condicionVenta) : null,
    direccion: data.direccion ? String(data.direccion) : null,
    ciudad: data.ciudad ? String(data.ciudad) : null,
    provincia: data.provincia ? String(data.provincia) : null,
    telefono: data.telefono ? String(data.telefono) : null,
    email: data.email ? String(data.email) : null,
    limiteCredito: data.limiteCredito !== undefined ? Number(data.limiteCredito) : undefined,
    latitud: data.latitud !== undefined ? Number(data.latitud) : undefined,
    longitud: data.longitud !== undefined ? Number(data.longitud) : undefined,
    activo: true,
  };
  if (vendedorId) fields.vendedorId = vendedorId;

  const cleanFields = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));

  if (existing) {
    if (!update) return 'skipped';
    await prisma.cliente.update({ where: { id: existing.id }, data: cleanFields });
    return 'updated';
  }

  await prisma.cliente.create({ data: { tenantId, codigo, ...cleanFields } as Prisma.ClienteUncheckedCreateInput });
  return 'created';
}

async function importClienteTelefono(tenantId: string, data: Record<string, unknown>): Promise<'created' | 'updated' | 'skipped'> {
  const clienteCodigo = String(data.clienteCodigo || data.codigo || '').trim();
  if (!clienteCodigo) throw new Error('Código de cliente vacío para teléfono');

  const cliente = await prisma.cliente.findUnique({
    where: { tenantId_codigo: { tenantId, codigo: clienteCodigo } },
  });
  if (!cliente) throw new Error(`Cliente no encontrado: ${clienteCodigo}`);

  const numero = String(data.numero || data.telefono || '').trim();
  if (!numero) throw new Error('Número de teléfono vacío');

  // Verificar si ya existe
  const existing = await prisma.clienteTelefono.findFirst({
    where: { tenantId, clienteId: cliente.id, numero },
  });
  if (existing) return 'skipped';

  await prisma.clienteTelefono.create({
    data: {
      tenantId,
      clienteId: cliente.id,
      tipo: data.tipo ? String(data.tipo) : 'telefono',
      numero,
      contacto: data.contacto ? String(data.contacto) : null,
      principal: Boolean(data.principal),
    },
  });
  return 'created';
}

async function importCondicionVenta(tenantId: string, data: Record<string, unknown>, update: boolean): Promise<'created' | 'updated' | 'skipped'> {
  const codigo = String(data.codigo || '').trim();
  if (!codigo) throw new Error('Código de condición de venta vacío');

  const existing = await prisma.condicionVenta.findUnique({
    where: { tenantId_codigo: { tenantId, codigo } },
  });

  const fields = {
    nombre: String(data.nombre || data.descripcion || codigo),
    diasPlazo: data.diasPlazo !== undefined ? Number(data.diasPlazo) : 0,
    activo: true,
  };

  if (existing) {
    if (!update) return 'skipped';
    await prisma.condicionVenta.update({ where: { id: existing.id }, data: fields });
    return 'updated';
  }

  await prisma.condicionVenta.create({ data: { tenantId, codigo, ...fields } });
  return 'created';
}

async function importMotivoNoCompra(tenantId: string, data: Record<string, unknown>, update: boolean): Promise<'created' | 'updated' | 'skipped'> {
  const codigo = String(data.codigo || '').trim();
  if (!codigo) throw new Error('Código de motivo vacío');

  const existing = await prisma.motivoNoCompra.findUnique({
    where: { tenantId_codigo: { tenantId, codigo } },
  });

  const fields = {
    descripcion: String(data.descripcion || data.nombre || codigo),
    activo: true,
  };

  if (existing) {
    if (!update) return 'skipped';
    await prisma.motivoNoCompra.update({ where: { id: existing.id }, data: fields });
    return 'updated';
  }

  await prisma.motivoNoCompra.create({ data: { tenantId, codigo, ...fields } });
  return 'created';
}

async function importVendedor(tenantId: string, data: Record<string, unknown>, update: boolean): Promise<'created' | 'updated' | 'skipped'> {
  const email = String(data.email || '').trim();
  const codigo = String(data.codigo || '').trim();
  if (!email && !codigo) throw new Error('Email o código de vendedor vacío');

  const lookupEmail = email || `${codigo}@vendedor.local`;

  const existing = await prisma.user.findFirst({
    where: { tenantId, email: lookupEmail },
  });

  const fields = {
    nombre: String(data.nombre || codigo || email),
    rol: 'vendedor' as const,
    activo: true,
  };

  if (existing) {
    if (!update) return 'skipped';
    await prisma.user.update({ where: { id: existing.id }, data: fields });
    return 'updated';
  }

  // Crear con password por defecto
  const bcrypt = await import('bcryptjs');
  const passwordHash = await bcrypt.hash(codigo || 'vendedor123', 10);

  await prisma.user.create({
    data: {
      tenantId,
      email: lookupEmail,
      passwordHash,
      ...fields,
    },
  });
  return 'created';
}

async function importRuta(tenantId: string, data: Record<string, unknown>): Promise<'created' | 'updated' | 'skipped'> {
  const nombre = String(data.nombre || data.codigo || '').trim();
  if (!nombre) throw new Error('Nombre de ruta vacío');

  // Buscar ruta existente
  const existing = await prisma.ruta.findFirst({
    where: { tenantId, nombre },
  });

  let rutaId: string;

  if (existing) {
    rutaId = existing.id;
  } else {
    const ruta = await prisma.ruta.create({
      data: {
        tenantId,
        nombre,
        diaSemana: data.diaSemana !== undefined ? Number(data.diaSemana) : null,
        vendedorId: data.vendedorId ? String(data.vendedorId) : null,
      },
    });
    rutaId = ruta.id;
  }

  // Asignar clientes si vienen
  if (data.clienteCodigo) {
    const clienteCodigo = String(data.clienteCodigo).trim();
    const cliente = await prisma.cliente.findUnique({
      where: { tenantId_codigo: { tenantId, codigo: clienteCodigo } },
    });
    if (cliente) {
      const existingAssign = await prisma.rutaCliente.findFirst({
        where: { rutaId, clienteId: cliente.id },
      });
      if (!existingAssign) {
        const maxOrden = await prisma.rutaCliente.aggregate({
          where: { rutaId },
          _max: { orden: true },
        });
        await prisma.rutaCliente.create({
          data: {
            rutaId,
            clienteId: cliente.id,
            orden: (maxOrden._max.orden || 0) + 1,
          },
        });
      }
    }
  }

  return existing ? 'updated' : 'created';
}

async function importCuentaCorriente(tenantId: string, data: Record<string, unknown>): Promise<'created' | 'updated' | 'skipped'> {
  const clienteCodigo = String(data.clienteCodigo || data.codigo || '').trim();
  if (!clienteCodigo) throw new Error('Código de cliente vacío para cta cte');

  const cliente = await prisma.cliente.findUnique({
    where: { tenantId_codigo: { tenantId, codigo: clienteCodigo } },
  });
  if (!cliente) throw new Error(`Cliente no encontrado: ${clienteCodigo}`);

  const tipoRaw = String(data.tipo || data.tipoMovimiento || 'factura').toLowerCase().trim();
  const tipoMap: Record<string, string> = {
    factura: 'factura', fac: 'factura', fa: 'factura',
    nc: 'nota_credito', nota_credito: 'nota_credito',
    nd: 'nota_debito', nota_debito: 'nota_debito',
    recibo: 'recibo', rec: 'recibo',
  };
  const tipoMovimiento = tipoMap[tipoRaw] || tipoRaw;
  const monto = Number(data.monto || data.importe || 0);
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

  // Recalcular saldo del cliente
  const agg = await prisma.cuentaCorriente.aggregate({
    where: { clienteId: cliente.id, tenantId },
    _sum: { debe: true, haber: true },
  });
  await prisma.cliente.update({
    where: { id: cliente.id },
    data: { saldoCuenta: (agg._sum.debe || 0) - (agg._sum.haber || 0) },
  });

  return 'created';
}

// ─── EXPORT ────────────────────────────────────────────

export interface ExportPreview {
  pedidos: { cabeceras: number; items: number; nuevos: number };
  cobranzas: { cabeceras: number; mediosPago: number; docImputados: number; nuevas: number };
  excusas: { total: number; nuevas: number };
}

export async function getExportPreview(
  tenantId: string,
  desde: Date,
  hasta: Date,
): Promise<ExportPreview> {
  const [pedidos, pedidosNuevos, items, cobranzas, cobranzasNuevas, medios, excusas, excusasNuevas] = await Promise.all([
    prisma.pedido.count({ where: { tenantId, fecha: { gte: desde, lte: hasta } } }),
    prisma.pedido.count({ where: { tenantId, fecha: { gte: desde, lte: hasta }, erpSynced: false } }),
    prisma.pedidoItem.count({ where: { pedido: { tenantId, fecha: { gte: desde, lte: hasta } } } }),
    prisma.cobranza.count({ where: { tenantId, fecha: { gte: desde, lte: hasta } } }),
    prisma.cobranza.count({ where: { tenantId, fecha: { gte: desde, lte: hasta }, erpSynced: false } }),
    prisma.cobranzaMedio.count({ where: { cobranza: { tenantId, fecha: { gte: desde, lte: hasta } } } }),
    prisma.visita.count({ where: { jornada: { tenantId }, tipo: 'no_compra', fechaHora: { gte: desde, lte: hasta } } }),
    prisma.visita.count({ where: { jornada: { tenantId }, tipo: 'no_compra', fechaHora: { gte: desde, lte: hasta } } }),
  ]);

  // docImputados: contar CuentaCorriente con recibos en el rango
  const docImputados = await prisma.cuentaCorriente.count({
    where: { tenantId, tipoMovimiento: 'recibo', fecha: { gte: desde, lte: hasta } },
  });

  return {
    pedidos: { cabeceras: pedidos, items, nuevos: pedidosNuevos },
    cobranzas: { cabeceras: cobranzas, mediosPago: medios, docImputados, nuevas: cobranzasNuevas },
    excusas: { total: excusas, nuevas: excusasNuevas },
  };
}

export async function generateExport(
  tenantId: string,
  userId: string,
  entidades: string[],
  desde: Date,
  hasta: Date,
  soloNuevos: boolean,
): Promise<{ zipBuffer: Buffer; logId: string }> {
  const archivos: { nombre: string; buffer: Buffer }[] = [];

  // Buscar config de export del tenant
  const exportConfigs = await prisma.archivoConfig.findMany({
    where: {
      intercambio: { tenantId, activo: true },
      direccion: 'export',
      activo: true,
    },
  });

  // ── PEDIDOS ──
  if (entidades.includes('pedidos')) {
    const whereClause: Prisma.PedidoWhereInput = {
      tenantId,
      fecha: { gte: desde, lte: hasta },
      ...(soloNuevos && { erpSynced: false }),
    };

    const pedidos = await prisma.pedido.findMany({
      where: whereClause,
      include: {
        items: true,
        cliente: true,
        vendedor: true,
      },
      orderBy: { fecha: 'asc' },
    });

    // Cabecera Pedidos
    const cabConfig = exportConfigs.find((c) => c.entidad === 'pedidosCabecera');
    const cabData = pedidos.map((p, idx) => ({
      numero: p.id.substring(0, 8).toUpperCase(),
      numeroPedido: idx + 1,
      fecha: p.fecha,
      vendedorCodigo: p.vendedor.email.split('@')[0],
      vendedorNombre: p.vendedor.nombre,
      clienteCodigo: p.cliente.codigo,
      clienteNombre: p.cliente.nombre,
      condicionVenta: p.cliente.condicionVenta || '',
      subtotal: p.subtotal,
      descuentoGlobal: p.descuentoGlobal,
      total: p.total,
      observaciones: p.observaciones || '',
      estado: p.estado,
    }));

    if (cabConfig) {
      archivos.push({ nombre: cabConfig.nombreArchivo, buffer: generateExportFile(cabData, cabConfig) });
    } else {
      archivos.push({
        nombre: 'CabeceraPedidos.txt',
        buffer: generateDefaultExportFile(cabData, {
          NRO_PED: 'numeroPedido', FECHA: 'fecha', COD_VEN: 'vendedorCodigo',
          COD_CLI: 'clienteCodigo', NOM_CLI: 'clienteNombre', COND_VTA: 'condicionVenta',
          SUBTOTAL: 'subtotal', DESC_GLOBAL: 'descuentoGlobal', TOTAL: 'total', OBS: 'observaciones',
        }),
      });
    }

    // Detalle Pedidos
    const detConfig = exportConfigs.find((c) => c.entidad === 'pedidosDetalle');
    const detData = pedidos.flatMap((p, pIdx) =>
      p.items.map((item) => ({
        numeroPedido: pIdx + 1,
        productoCodigo: item.productoCodigo,
        productoNombre: item.productoNombre,
        cantidad: item.cantidad,
        unidadTipo: item.unidadTipo,
        precioUnitario: item.precioUnitario,
        descuentoPorcentaje: item.descuentoPorcentaje,
        subtotal: item.subtotal,
      })),
    );

    if (detConfig) {
      archivos.push({ nombre: detConfig.nombreArchivo, buffer: generateExportFile(detData, detConfig) });
    } else {
      archivos.push({
        nombre: 'DetallePedidos.txt',
        buffer: generateDefaultExportFile(detData, {
          NRO_PED: 'numeroPedido', COD_ART: 'productoCodigo', DESCRIPCION: 'productoNombre',
          CANTIDAD: 'cantidad', UNIDAD: 'unidadTipo', PRECIO: 'precioUnitario',
          DESC_PORC: 'descuentoPorcentaje', SUBTOTAL: 'subtotal',
        }),
      });
    }

    // Marcar como exportados
    if (pedidos.length > 0) {
      await prisma.pedido.updateMany({
        where: { id: { in: pedidos.map((p) => p.id) } },
        data: { erpSynced: true },
      });
    }
  }

  // ── COBRANZAS ──
  if (entidades.includes('cobranzas')) {
    const whereClause: Prisma.CobranzaWhereInput = {
      tenantId,
      fecha: { gte: desde, lte: hasta },
      ...(soloNuevos && { erpSynced: false }),
    };

    const cobranzas = await prisma.cobranza.findMany({
      where: whereClause,
      include: {
        medios: true,
        cliente: true,
        vendedor: true,
      },
      orderBy: { fecha: 'asc' },
    });

    // Cabecera Cobranzas
    const cobCabConfig = exportConfigs.find((c) => c.entidad === 'cobranzasCabecera');
    const cobCabData = cobranzas.map((c, idx) => ({
      numero: idx + 1,
      fecha: c.fecha,
      vendedorCodigo: c.vendedor.email.split('@')[0],
      vendedorNombre: c.vendedor.nombre,
      clienteCodigo: c.cliente.codigo,
      clienteNombre: c.cliente.nombre,
      total: c.total,
      estado: c.estado,
    }));

    if (cobCabConfig) {
      archivos.push({ nombre: cobCabConfig.nombreArchivo, buffer: generateExportFile(cobCabData, cobCabConfig) });
    } else {
      archivos.push({
        nombre: 'Cobranzas.txt',
        buffer: generateDefaultExportFile(cobCabData, {
          NRO_COB: 'numero', FECHA: 'fecha', COD_VEN: 'vendedorCodigo',
          COD_CLI: 'clienteCodigo', NOM_CLI: 'clienteNombre', TOTAL: 'total',
        }),
      });
    }

    // Detalle Pagos
    const dpConfig = exportConfigs.find((c) => c.entidad === 'cobranzasDetallePagos');
    const dpData = cobranzas.flatMap((c, cIdx) =>
      c.medios.map((m) => ({
        numeroCobranza: cIdx + 1,
        tipo: m.tipo,
        monto: m.monto,
        moneda: m.moneda,
        datos: JSON.stringify(m.datos),
      })),
    );

    if (dpConfig) {
      archivos.push({ nombre: dpConfig.nombreArchivo, buffer: generateExportFile(dpData, dpConfig) });
    } else {
      archivos.push({
        nombre: 'DetallePagos.txt',
        buffer: generateDefaultExportFile(dpData, {
          NRO_COB: 'numeroCobranza', TIPO_PAGO: 'tipo', MONTO: 'monto',
          MONEDA: 'moneda', DATOS: 'datos',
        }),
      });
    }

    // Doc Imputados — facturas asociadas a cada cobranza
    const diConfig = exportConfigs.find((c) => c.entidad === 'cobranzasDocImputados');
    const diData: Record<string, unknown>[] = [];
    for (let cIdx = 0; cIdx < cobranzas.length; cIdx++) {
      const c = cobranzas[cIdx];
      // Buscar movimientos de cta cte tipo recibo del cliente en la fecha
      const imputaciones = await prisma.cuentaCorriente.findMany({
        where: {
          tenantId,
          clienteId: c.clienteId,
          tipoMovimiento: 'recibo',
          fecha: c.fecha,
        },
      });
      for (const imp of imputaciones) {
        diData.push({
          numeroCobranza: cIdx + 1,
          tipoDocumento: imp.tipoMovimiento,
          numeroDocumento: imp.numero || '',
          montoImputado: imp.haber,
        });
      }
    }

    if (diConfig) {
      archivos.push({ nombre: diConfig.nombreArchivo, buffer: generateExportFile(diData, diConfig) });
    } else {
      archivos.push({
        nombre: 'DocImputados.txt',
        buffer: generateDefaultExportFile(diData, {
          NRO_COB: 'numeroCobranza', TIPO_DOC: 'tipoDocumento',
          NRO_DOC: 'numeroDocumento', MONTO: 'montoImputado',
        }),
      });
    }

    // Marcar como exportadas
    if (cobranzas.length > 0) {
      await prisma.cobranza.updateMany({
        where: { id: { in: cobranzas.map((c) => c.id) } },
        data: { erpSynced: true },
      });
    }
  }

  // ── EXCUSAS ──
  if (entidades.includes('excusas')) {
    const excusas = await prisma.visita.findMany({
      where: {
        jornada: { tenantId },
        tipo: 'no_compra',
        fechaHora: { gte: desde, lte: hasta },
      },
      include: {
        vendedor: true,
      },
    });

    // Necesitamos datos del cliente
    const excData: Record<string, unknown>[] = [];
    for (const e of excusas) {
      const cliente = await prisma.cliente.findFirst({ where: { id: e.clienteId } });
      excData.push({
        fecha: e.fechaHora,
        vendedorCodigo: e.vendedor.email.split('@')[0],
        vendedorNombre: e.vendedor.nombre,
        clienteCodigo: cliente?.codigo || '',
        clienteNombre: cliente?.nombre || '',
        motivo: e.resultado || '',
        observaciones: '',
      });
    }

    const excConfig = exportConfigs.find((c) => c.entidad === 'excusas');
    if (excConfig) {
      archivos.push({ nombre: excConfig.nombreArchivo, buffer: generateExportFile(excData, excConfig) });
    } else {
      archivos.push({
        nombre: 'ExcusasS.txt',
        buffer: generateDefaultExportFile(excData, {
          FECHA: 'fecha', COD_VEN: 'vendedorCodigo', COD_CLI: 'clienteCodigo',
          NOM_CLI: 'clienteNombre', MOTIVO: 'motivo', OBS: 'observaciones',
        }),
      });
    }
  }

  // Generar ZIP
  const zipBuffer = await generateZip(archivos);

  // Guardar ZIP en disco para redescargar
  ensureDir(EXPORT_DIR);
  const zipFileName = `export_${tenantId}_${Date.now()}.zip`;
  const zipPath = path.join(EXPORT_DIR, zipFileName);
  fs.writeFileSync(zipPath, zipBuffer);

  // Log
  const log = await prisma.intercambioLog.create({
    data: {
      tenantId,
      direccion: 'export',
      usuario: userId,
      estado: 'ok',
      archivos: JSON.parse(JSON.stringify(archivos.map((a) => ({
        nombre: a.nombre,
        bytes: a.buffer.length,
      })))) as Prisma.InputJsonValue,
      archivoZipPath: zipPath,
    },
  });

  logger.info(`Export generado: ${archivos.length} archivos, ZIP ${zipBuffer.length} bytes [tenant=${tenantId}]`);

  return { zipBuffer, logId: log.id };
}

export async function downloadExport(logId: string, tenantId: string): Promise<Buffer> {
  const log = await prisma.intercambioLog.findFirst({
    where: { id: logId, tenantId, direccion: 'export' },
  });
  if (!log || !log.archivoZipPath) {
    throw new ValidationError('Export no encontrado o expirado');
  }
  if (!fs.existsSync(log.archivoZipPath)) {
    throw new ValidationError('Archivo ZIP expirado. Generá un nuevo export.');
  }
  return fs.readFileSync(log.archivoZipPath);
}

export async function getExportHistory(tenantId: string, limit = 20) {
  return prisma.intercambioLog.findMany({
    where: { tenantId, direccion: 'export' },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

export async function getImportHistory(tenantId: string, limit = 20) {
  return prisma.intercambioLog.findMany({
    where: { tenantId, direccion: 'import' },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

// ─── CONFIG ────────────────────────────────────────────

export async function getIntercambioConfig(tenantId: string) {
  return prisma.intercambioConfig.findMany({
    where: { tenantId },
    include: { archivos: { orderBy: { orden: 'asc' } } },
    orderBy: { createdAt: 'desc' },
  });
}

export async function saveIntercambioConfig(
  tenantId: string,
  nombre: string,
  items: BatchProcessItem[],
) {
  // Buscar config existente con mismo nombre
  let config = await prisma.intercambioConfig.findFirst({
    where: { tenantId, nombre },
    include: { archivos: true },
  });

  if (config) {
    // Actualizar archivos existentes
    await prisma.archivoConfig.deleteMany({ where: { intercambioId: config.id } });
  } else {
    config = await prisma.intercambioConfig.create({
      data: { tenantId, nombre },
      include: { archivos: true },
    });
  }

  // Crear archivos
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    await prisma.archivoConfig.create({
      data: {
        intercambioId: config.id,
        direccion: 'import',
        nombre: item.entidad,
        nombreArchivo: item.fileId, // se reemplazará con el nombre real
        entidad: item.entidad,
        mapeoColumnas: item.mapping as unknown as Prisma.InputJsonValue,
        orden: i,
      },
    });
  }

  return config;
}

export async function upsertFullConfig(
  tenantId: string,
  configId: string | null,
  nombre: string,
  archivos: Array<{
    id?: string;
    direccion: string;
    nombre: string;
    nombreArchivo: string;
    entidad: string;
    esDetalle?: boolean;
    archivoPadreId?: string;
    campoRelacion?: string;
    formatoArchivo?: string;
    separador?: string;
    encoding?: string;
    tieneEncabezado?: boolean;
    saltarFilas?: number;
    formatoFecha?: string;
    separadorDecimal?: string;
    mapeoColumnas: Record<string, string>;
    valoresDefault?: Record<string, unknown>;
    actualizarExist?: boolean;
    campoUnico?: string;
    soloNuevos?: boolean;
    filtroEstado?: string;
    orden?: number;
  }>,
) {
  if (configId) {
    // Update existing
    await prisma.intercambioConfig.update({
      where: { id: configId },
      data: { nombre },
    });
    await prisma.archivoConfig.deleteMany({ where: { intercambioId: configId } });

    for (const archivo of archivos) {
      await prisma.archivoConfig.create({
        data: {
          intercambioId: configId,
          direccion: archivo.direccion,
          nombre: archivo.nombre,
          nombreArchivo: archivo.nombreArchivo,
          entidad: archivo.entidad,
          esDetalle: archivo.esDetalle || false,
          archivoPadreId: archivo.archivoPadreId || null,
          campoRelacion: archivo.campoRelacion || null,
          formatoArchivo: archivo.formatoArchivo || 'txt',
          separador: archivo.separador || ';',
          encoding: archivo.encoding || 'latin1',
          tieneEncabezado: archivo.tieneEncabezado !== false,
          saltarFilas: archivo.saltarFilas || 0,
          formatoFecha: archivo.formatoFecha || 'yyyyMMdd',
          separadorDecimal: archivo.separadorDecimal || '.',
          mapeoColumnas: archivo.mapeoColumnas as unknown as Prisma.InputJsonValue,
          valoresDefault: archivo.valoresDefault ? (archivo.valoresDefault as unknown as Prisma.InputJsonValue) : undefined,
          actualizarExist: archivo.actualizarExist !== false,
          campoUnico: archivo.campoUnico || 'codigo',
          soloNuevos: archivo.soloNuevos !== false,
          filtroEstado: archivo.filtroEstado || null,
          orden: archivo.orden || 0,
        },
      });
    }

    return prisma.intercambioConfig.findUnique({
      where: { id: configId },
      include: { archivos: { orderBy: { orden: 'asc' } } },
    });
  } else {
    // Create new
    return prisma.intercambioConfig.create({
      data: {
        tenantId,
        nombre,
        archivos: {
          create: archivos.map((a) => ({
            direccion: a.direccion,
            nombre: a.nombre,
            nombreArchivo: a.nombreArchivo,
            entidad: a.entidad,
            esDetalle: a.esDetalle || false,
            archivoPadreId: a.archivoPadreId || null,
            campoRelacion: a.campoRelacion || null,
            formatoArchivo: a.formatoArchivo || 'txt',
            separador: a.separador || ';',
            encoding: a.encoding || 'latin1',
            tieneEncabezado: a.tieneEncabezado !== false,
            saltarFilas: a.saltarFilas || 0,
            formatoFecha: a.formatoFecha || 'yyyyMMdd',
            separadorDecimal: a.separadorDecimal || '.',
            mapeoColumnas: a.mapeoColumnas as unknown as Prisma.InputJsonValue,
            valoresDefault: a.valoresDefault ? (a.valoresDefault as unknown as Prisma.InputJsonValue) : undefined,
            actualizarExist: a.actualizarExist !== false,
            campoUnico: a.campoUnico || 'codigo',
            soloNuevos: a.soloNuevos !== false,
            filtroEstado: a.filtroEstado || null,
            orden: a.orden || 0,
          })),
        },
      },
      include: { archivos: { orderBy: { orden: 'asc' } } },
    });
  }
}

export async function deleteIntercambioConfig(configId: string, tenantId: string) {
  const config = await prisma.intercambioConfig.findFirst({
    where: { id: configId, tenantId },
  });
  if (!config) throw new ValidationError('Configuración no encontrada');

  await prisma.archivoConfig.deleteMany({ where: { intercambioId: configId } });
  await prisma.intercambioConfig.delete({ where: { id: configId } });
}

// ─── Helpers ───────────────────────────────────────────

function guessEntityFromFileName(fileName: string): string | null {
  const name = fileName.toUpperCase().replace(/\.[^.]+$/, '');
  const map: Record<string, string> = {
    ARTICULOS: 'productos',
    PRODUCTOS: 'productos',
    CLIENTES: 'clientes',
    CLIENTES_TELEFONO: 'clientesTelefono',
    COND_VENTA: 'condicionesVenta',
    CONDVENTA: 'condicionesVenta',
    CTACTE: 'facturas',
    CTA_CTE: 'facturas',
    MOTIVO_NO_COMPRA: 'motivosNoCompra',
    MOTIVONOCOMPRA: 'motivosNoCompra',
    RUTAS: 'rutas',
    VENDEDOR: 'vendedores',
    VENDEDORES: 'vendedores',
  };
  return map[name] || null;
}

// ─── Cleanup exports > 7 días ──────────────────────────

export function cleanupExports() {
  if (!fs.existsSync(EXPORT_DIR)) return;
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;

  try {
    const files = fs.readdirSync(EXPORT_DIR);
    let deleted = 0;
    for (const file of files) {
      const fp = path.join(EXPORT_DIR, file);
      const stat = fs.statSync(fp);
      if (stat.mtimeMs < cutoff) {
        fs.unlinkSync(fp);
        deleted++;
      }
    }
    if (deleted > 0) {
      logger.info(`Export cleanup: deleted ${deleted} files`);
    }
  } catch (err) {
    logger.error('Export cleanup failed', err);
  }
}
