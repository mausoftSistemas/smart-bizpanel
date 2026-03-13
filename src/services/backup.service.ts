import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import AdmZip from 'adm-zip';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { generateZip } from './file-converter.service';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

const BACKUP_DIR = path.join(process.cwd(), 'tmp', 'exports', 'backups');

function toSheet(data: Record<string, unknown>[]): XLSX.WorkSheet {
  if (!data.length) return XLSX.utils.aoa_to_sheet([['Sin datos']]);
  return XLSX.utils.json_to_sheet(data);
}

function createWorkbook(sheets: { name: string; data: Record<string, unknown>[] }[]): Buffer {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    XLSX.utils.book_append_sheet(wb, toSheet(s.data), s.name.substring(0, 31));
  }
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}

export async function generateTenantBackup(tenantId: string): Promise<{ filePath: string; fileName: string }> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: { config: true },
  });
  if (!tenant) throw new Error('Tenant no encontrado');

  const t = tenantId; // shorthand for where clauses
  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;

  logger.info(`Generando backup para tenant ${tenant.codigo} (${tenantId})`);

  // Fetch all data in parallel
  const [
    users,
    productos,
    clientes,
    clientesTelefono,
    pedidos,
    pedidoItems,
    cobranzas,
    cobranzaMedios,
    cobranzaImputaciones,
    cuentaCorriente,
    jornadas,
    visitas,
    gpsPoints,
    rutas,
    rutaClientes,
    devoluciones,
    devolucionItems,
    preciosCliente,
    condicionesVenta,
    motivosNoCompra,
    objetivos,
    mensajes,
    billeteras,
    denominaciones,
    politicas,
    rendiciones,
    rendicionCheques,
    presupuestos,
    presupuestoItems,
    fotosEvidencia,
    firmas,
    formularios,
    formularioRespuestas,
    sugerencias,
    syncLogs,
    importLogs,
  ] = await Promise.all([
    prisma.user.findMany({ where: { tenantId: t }, select: { id: true, email: true, nombre: true, rol: true, activo: true, lastLogin: true, createdAt: true } }),
    prisma.producto.findMany({ where: { tenantId: t } }),
    prisma.cliente.findMany({ where: { tenantId: t } }),
    prisma.clienteTelefono.findMany({ where: { tenantId: t } }),
    prisma.pedido.findMany({ where: { tenantId: t } }),
    prisma.pedidoItem.findMany({ where: { pedido: { tenantId: t } } }),
    prisma.cobranza.findMany({ where: { tenantId: t } }),
    prisma.cobranzaMedio.findMany({ where: { cobranza: { tenantId: t } } }),
    prisma.cobranzaImputacion.findMany({ where: { cobranza: { tenantId: t } } }),
    prisma.cuentaCorriente.findMany({ where: { tenantId: t } }),
    prisma.jornada.findMany({ where: { tenantId: t } }),
    prisma.visita.findMany({ where: { jornada: { tenantId: t } } }),
    prisma.gpsPoint.findMany({ where: { jornada: { tenantId: t } } }),
    prisma.ruta.findMany({ where: { tenantId: t } }),
    prisma.rutaCliente.findMany({ where: { ruta: { tenantId: t } } }),
    prisma.devolucion.findMany({ where: { tenantId: t } }),
    prisma.devolucionItem.findMany({ where: { devolucion: { tenantId: t } } }),
    prisma.precioCliente.findMany({ where: { tenantId: t } }),
    prisma.condicionVenta.findMany({ where: { tenantId: t } }),
    prisma.motivoNoCompra.findMany({ where: { tenantId: t } }),
    prisma.objetivo.findMany({ where: { tenantId: t } }),
    prisma.mensaje.findMany({ where: { tenantId: t } }),
    prisma.billetera.findMany({ where: { tenantId: t } }),
    prisma.denominacion.findMany({ where: { tenantId: t } }),
    prisma.politicaComercial.findMany({ where: { tenantId: t } }),
    prisma.rendicion.findMany({ where: { tenantId: t } }),
    prisma.rendicionCheque.findMany({ where: { rendicion: { tenantId: t } } }),
    prisma.presupuesto.findMany({ where: { tenantId: t } }),
    prisma.presupuestoItem.findMany({ where: { presupuesto: { tenantId: t } } }),
    prisma.fotoEvidencia.findMany({ where: { tenantId: t } }),
    prisma.firma.findMany({ where: { tenantId: t } }),
    prisma.formulario.findMany({ where: { tenantId: t } }),
    prisma.formularioRespuesta.findMany({ where: { formulario: { tenantId: t } } }),
    prisma.sugerenciaVenta.findMany({ where: { tenantId: t } }),
    prisma.syncLog.findMany({ where: { tenantId: t }, orderBy: { startedAt: 'desc' }, take: 1000 }),
    prisma.importLog.findMany({ where: { tenantId: t }, orderBy: { createdAt: 'desc' }, take: 1000 }),
  ]);

  // Serialize JSON fields and dates for Excel
  const serialize = (arr: unknown[]): Record<string, unknown>[] =>
    arr.map((item) => {
      const obj = item as Record<string, unknown>;
      const result: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(obj)) {
        if (val instanceof Date) result[key] = val.toISOString();
        else if (val !== null && typeof val === 'object') result[key] = JSON.stringify(val);
        else result[key] = val;
      }
      return result;
    });

  // Build XLSX files
  const archivos: { nombre: string; buffer: Buffer }[] = [];

  // info.xlsx
  const { config, ...tenantData } = tenant;
  archivos.push({
    nombre: 'info.xlsx',
    buffer: createWorkbook([
      { name: 'Tenant', data: serialize([tenantData]) },
      { name: 'Config', data: serialize(config ? [config] : []) },
    ]),
  });

  // usuarios.xlsx
  archivos.push({
    nombre: 'usuarios.xlsx',
    buffer: createWorkbook([{ name: 'Usuarios', data: serialize(users) }]),
  });

  // productos.xlsx
  archivos.push({
    nombre: 'productos.xlsx',
    buffer: createWorkbook([{ name: 'Productos', data: serialize(productos) }]),
  });

  // clientes.xlsx
  archivos.push({
    nombre: 'clientes.xlsx',
    buffer: createWorkbook([
      { name: 'Clientes', data: serialize(clientes) },
      { name: 'Telefonos', data: serialize(clientesTelefono) },
    ]),
  });

  // pedidos.xlsx
  archivos.push({
    nombre: 'pedidos.xlsx',
    buffer: createWorkbook([
      { name: 'Pedidos', data: serialize(pedidos) },
      { name: 'Items', data: serialize(pedidoItems) },
    ]),
  });

  // cobranzas.xlsx
  archivos.push({
    nombre: 'cobranzas.xlsx',
    buffer: createWorkbook([
      { name: 'Cobranzas', data: serialize(cobranzas) },
      { name: 'Medios', data: serialize(cobranzaMedios) },
      { name: 'Imputaciones', data: serialize(cobranzaImputaciones) },
    ]),
  });

  // cuenta_corriente.xlsx
  archivos.push({
    nombre: 'cuenta_corriente.xlsx',
    buffer: createWorkbook([{ name: 'CuentaCorriente', data: serialize(cuentaCorriente) }]),
  });

  // jornadas.xlsx
  archivos.push({
    nombre: 'jornadas.xlsx',
    buffer: createWorkbook([
      { name: 'Jornadas', data: serialize(jornadas) },
      { name: 'Visitas', data: serialize(visitas) },
      { name: 'GpsPoints', data: serialize(gpsPoints) },
    ]),
  });

  // rutas.xlsx
  archivos.push({
    nombre: 'rutas.xlsx',
    buffer: createWorkbook([
      { name: 'Rutas', data: serialize(rutas) },
      { name: 'RutaClientes', data: serialize(rutaClientes) },
    ]),
  });

  // devoluciones.xlsx
  archivos.push({
    nombre: 'devoluciones.xlsx',
    buffer: createWorkbook([
      { name: 'Devoluciones', data: serialize(devoluciones) },
      { name: 'Items', data: serialize(devolucionItems) },
    ]),
  });

  // catalogos.xlsx
  archivos.push({
    nombre: 'catalogos.xlsx',
    buffer: createWorkbook([
      { name: 'PreciosCliente', data: serialize(preciosCliente) },
      { name: 'CondicionesVenta', data: serialize(condicionesVenta) },
      { name: 'MotivosNoCompra', data: serialize(motivosNoCompra) },
      { name: 'Objetivos', data: serialize(objetivos) },
      { name: 'Mensajes', data: serialize(mensajes) },
      { name: 'Billeteras', data: serialize(billeteras) },
      { name: 'Denominaciones', data: serialize(denominaciones) },
      { name: 'Politicas', data: serialize(politicas) },
    ]),
  });

  // rendiciones.xlsx
  archivos.push({
    nombre: 'rendiciones.xlsx',
    buffer: createWorkbook([
      { name: 'Rendiciones', data: serialize(rendiciones) },
      { name: 'Cheques', data: serialize(rendicionCheques) },
    ]),
  });

  // presupuestos.xlsx
  archivos.push({
    nombre: 'presupuestos.xlsx',
    buffer: createWorkbook([
      { name: 'Presupuestos', data: serialize(presupuestos) },
      { name: 'Items', data: serialize(presupuestoItems) },
    ]),
  });

  // fotos_firmas.xlsx
  archivos.push({
    nombre: 'fotos_firmas.xlsx',
    buffer: createWorkbook([
      { name: 'FotosEvidencia', data: serialize(fotosEvidencia) },
      { name: 'Firmas', data: serialize(firmas) },
    ]),
  });

  // formularios.xlsx
  archivos.push({
    nombre: 'formularios.xlsx',
    buffer: createWorkbook([
      { name: 'Formularios', data: serialize(formularios) },
      { name: 'Respuestas', data: serialize(formularioRespuestas) },
      { name: 'Sugerencias', data: serialize(sugerencias) },
    ]),
  });

  // logs.xlsx
  archivos.push({
    nombre: 'logs.xlsx',
    buffer: createWorkbook([
      { name: 'SyncLogs', data: serialize(syncLogs) },
      { name: 'ImportLogs', data: serialize(importLogs) },
    ]),
  });

  // Generate ZIP
  const zipBuffer = await generateZip(archivos);

  // Save to disk
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const fileName = `backup_${tenant.codigo}_${dateStr}.zip`;
  const filePath = path.join(BACKUP_DIR, fileName);
  fs.writeFileSync(filePath, zipBuffer);

  logger.info(`Backup generado: ${fileName} (${(zipBuffer.length / 1024 / 1024).toFixed(2)} MB)`);

  return { filePath, fileName };
}

export function getBackupDir(): string {
  return BACKUP_DIR;
}

// ══════════════════════════════════════════════════════════
// RESTORE BACKUP
// ══════════════════════════════════════════════════════════

export interface RestoreResult {
  registrosRestaurados: Record<string, number>;
  advertencias: string[];
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
const BATCH_SIZE = 500;

function deserializeRow(row: Record<string, unknown>, jsonFields: string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(row)) {
    if (val === undefined || val === '') {
      result[key] = null;
      continue;
    }
    if (typeof val === 'string') {
      if (jsonFields.includes(key)) {
        try { result[key] = JSON.parse(val); } catch { result[key] = val; }
        continue;
      }
      if (ISO_DATE_RE.test(val)) {
        const d = new Date(val);
        if (!isNaN(d.getTime())) { result[key] = d; continue; }
      }
    }
    result[key] = val;
  }
  return result;
}

function readSheetFromZip(
  zip: AdmZip, fileName: string, sheetName: string, jsonFields: string[] = [],
): Record<string, unknown>[] {
  const entry = zip.getEntries().find(
    (e) => e.entryName === fileName || e.entryName.endsWith('/' + fileName),
  );
  if (!entry) return [];

  const wb = XLSX.read(entry.getData(), { type: 'buffer' });
  const ws = wb.Sheets[sheetName];
  if (!ws) return [];

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);
  if (!rows.length) return [];
  if (rows.length === 1 && 'Sin datos' in rows[0]) return [];

  return rows.map((r) => deserializeRow(r, jsonFields));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function batchCreate(tx: any, model: string, data: Record<string, unknown>[]): Promise<number> {
  if (!data.length) return 0;
  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    await tx[model].createMany({ data: data.slice(i, i + BATCH_SIZE) });
  }
  return data.length;
}

function withTenantId(rows: Record<string, unknown>[], tenantId: string): Record<string, unknown>[] {
  return rows.map((r) => ({ ...r, tenantId }));
}

function stripAutoId(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map(({ id, ...rest }) => rest);
}

export async function restoreTenantBackup(zipBuffer: Buffer, tenantId: string): Promise<RestoreResult> {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new Error('Tenant no encontrado');

  logger.info(`Iniciando restore para tenant ${tenant.codigo} (${tenantId})`);

  const zip = new AdmZip(zipBuffer);
  const counts: Record<string, number> = {};
  const advertencias: string[] = [];

  // ═══ PARSE ALL XLSX FROM ZIP ═══
  const configData = readSheetFromZip(zip, 'info.xlsx', 'Config');
  const userData = readSheetFromZip(zip, 'usuarios.xlsx', 'Usuarios');
  const productoData = readSheetFromZip(zip, 'productos.xlsx', 'Productos');
  const clienteData = readSheetFromZip(zip, 'clientes.xlsx', 'Clientes');
  const telefonoData = readSheetFromZip(zip, 'clientes.xlsx', 'Telefonos');
  const pedidoData = readSheetFromZip(zip, 'pedidos.xlsx', 'Pedidos');
  const pedidoItemData = readSheetFromZip(zip, 'pedidos.xlsx', 'Items');
  const cobranzaData = readSheetFromZip(zip, 'cobranzas.xlsx', 'Cobranzas');
  const medioData = readSheetFromZip(zip, 'cobranzas.xlsx', 'Medios', ['datos']);
  const imputacionData = readSheetFromZip(zip, 'cobranzas.xlsx', 'Imputaciones');
  const ccData = readSheetFromZip(zip, 'cuenta_corriente.xlsx', 'CuentaCorriente');
  const jornadaData = readSheetFromZip(zip, 'jornadas.xlsx', 'Jornadas');
  const visitaData = readSheetFromZip(zip, 'jornadas.xlsx', 'Visitas');
  const gpsData = readSheetFromZip(zip, 'jornadas.xlsx', 'GpsPoints');
  const rutaData = readSheetFromZip(zip, 'rutas.xlsx', 'Rutas');
  const rutaClienteData = readSheetFromZip(zip, 'rutas.xlsx', 'RutaClientes');
  const devolucionData = readSheetFromZip(zip, 'devoluciones.xlsx', 'Devoluciones');
  const devolucionItemData = readSheetFromZip(zip, 'devoluciones.xlsx', 'Items');
  const precioData = readSheetFromZip(zip, 'catalogos.xlsx', 'PreciosCliente');
  const condicionData = readSheetFromZip(zip, 'catalogos.xlsx', 'CondicionesVenta');
  const motivoData = readSheetFromZip(zip, 'catalogos.xlsx', 'MotivosNoCompra');
  const objetivoData = readSheetFromZip(zip, 'catalogos.xlsx', 'Objetivos');
  const mensajeData = readSheetFromZip(zip, 'catalogos.xlsx', 'Mensajes');
  const billeteraData = readSheetFromZip(zip, 'catalogos.xlsx', 'Billeteras');
  const denominacionData = readSheetFromZip(zip, 'catalogos.xlsx', 'Denominaciones');
  const politicaData = readSheetFromZip(zip, 'catalogos.xlsx', 'Politicas', ['condiciones', 'accionParams']);
  const rendicionData = readSheetFromZip(zip, 'rendiciones.xlsx', 'Rendiciones', ['detalleBilletes']);
  const chequeData = readSheetFromZip(zip, 'rendiciones.xlsx', 'Cheques');
  const presupuestoData = readSheetFromZip(zip, 'presupuestos.xlsx', 'Presupuestos');
  const presupuestoItemData = readSheetFromZip(zip, 'presupuestos.xlsx', 'Items');
  const fotoData = readSheetFromZip(zip, 'fotos_firmas.xlsx', 'FotosEvidencia');
  const firmaData = readSheetFromZip(zip, 'fotos_firmas.xlsx', 'Firmas');
  const formularioData = readSheetFromZip(zip, 'formularios.xlsx', 'Formularios', ['campos']);
  const respuestaData = readSheetFromZip(zip, 'formularios.xlsx', 'Respuestas', ['respuestas']);
  const sugerenciaData = readSheetFromZip(zip, 'formularios.xlsx', 'Sugerencias');
  const syncLogData = readSheetFromZip(zip, 'logs.xlsx', 'SyncLogs');
  const importLogData = readSheetFromZip(zip, 'logs.xlsx', 'ImportLogs', ['errorDetail', 'mapping']);

  const tempHash = await bcrypt.hash('TempRestore2026!', 10);

  await prisma.$transaction(async (tx) => {
    // ═══ DELETE ALL (leaves → roots) ═══
    await tx.importLog.deleteMany({ where: { tenantId } });
    await tx.syncLog.deleteMany({ where: { tenantId } });
    await tx.sugerenciaVenta.deleteMany({ where: { tenantId } });
    await tx.formularioRespuesta.deleteMany({ where: { formulario: { tenantId } } });
    await tx.formulario.deleteMany({ where: { tenantId } });
    await tx.firma.deleteMany({ where: { tenantId } });
    await tx.fotoEvidencia.deleteMany({ where: { tenantId } });
    await tx.presupuestoItem.deleteMany({ where: { presupuesto: { tenantId } } });
    await tx.presupuesto.deleteMany({ where: { tenantId } });
    await tx.rendicionCheque.deleteMany({ where: { rendicion: { tenantId } } });
    await tx.rendicion.deleteMany({ where: { tenantId } });
    await tx.cuentaCorriente.deleteMany({ where: { tenantId } });
    await tx.devolucionItem.deleteMany({ where: { devolucion: { tenantId } } });
    await tx.devolucion.deleteMany({ where: { tenantId } });
    await tx.cobranzaImputacion.deleteMany({ where: { cobranza: { tenantId } } });
    await tx.cobranzaMedio.deleteMany({ where: { cobranza: { tenantId } } });
    await tx.cobranza.deleteMany({ where: { tenantId } });
    await tx.pedidoItem.deleteMany({ where: { pedido: { tenantId } } });
    await tx.pedido.deleteMany({ where: { tenantId } });
    await tx.gpsPoint.deleteMany({ where: { jornada: { tenantId } } });
    await tx.visita.deleteMany({ where: { jornada: { tenantId } } });
    await tx.jornada.deleteMany({ where: { tenantId } });
    await tx.politicaComercial.deleteMany({ where: { tenantId } });
    await tx.denominacion.deleteMany({ where: { tenantId } });
    await tx.billetera.deleteMany({ where: { tenantId } });
    await tx.mensaje.deleteMany({ where: { tenantId } });
    await tx.objetivo.deleteMany({ where: { tenantId } });
    await tx.precioCliente.deleteMany({ where: { tenantId } });
    await tx.rutaCliente.deleteMany({ where: { ruta: { tenantId } } });
    await tx.ruta.deleteMany({ where: { tenantId } });
    await tx.clienteTelefono.deleteMany({ where: { tenantId } });
    await tx.cliente.deleteMany({ where: { tenantId } });
    await tx.producto.deleteMany({ where: { tenantId } });
    await tx.motivoNoCompra.deleteMany({ where: { tenantId } });
    await tx.condicionVenta.deleteMany({ where: { tenantId } });
    await tx.user.deleteMany({ where: { tenantId } });
    await tx.tenantConfig.deleteMany({ where: { tenantId } });

    logger.info('Datos existentes eliminados, insertando backup...');

    // ═══ INSERT ALL (roots → leaves) ═══

    // TenantConfig
    if (configData.length > 0) {
      const cfg = { ...configData[0] };
      delete cfg.id;
      cfg.tenantId = tenantId;
      await tx.tenantConfig.create({ data: cfg as never });
      counts['tenantConfig'] = 1;
    }

    // Users (contraseña temporal)
    if (userData.length > 0) {
      const users = userData.map((u) => ({
        id: u.id as string,
        tenantId,
        email: u.email as string,
        passwordHash: tempHash,
        nombre: u.nombre as string,
        rol: u.rol as string,
        activo: u.activo !== false && u.activo !== 0,
        lastLogin: (u.lastLogin as Date) || null,
        createdAt: (u.createdAt as Date) || new Date(),
        passwordTemp: true,
      }));
      counts['usuarios'] = await batchCreate(tx, 'user', users);
      advertencias.push(
        `${counts['usuarios']} usuarios restaurados con contraseña temporal (TempRestore2026!). Deben cambiarla en el próximo login.`,
      );
    }

    // Catálogos base (sin FK a otros modelos del tenant)
    counts['productos'] = await batchCreate(tx, 'producto', withTenantId(productoData, tenantId));
    counts['condicionesVenta'] = await batchCreate(tx, 'condicionVenta', withTenantId(condicionData, tenantId));
    counts['motivosNoCompra'] = await batchCreate(tx, 'motivoNoCompra', withTenantId(motivoData, tenantId));

    // Clientes + teléfonos
    counts['clientes'] = await batchCreate(tx, 'cliente', withTenantId(clienteData, tenantId));
    counts['clientesTelefono'] = await batchCreate(tx, 'clienteTelefono', withTenantId(stripAutoId(telefonoData), tenantId));

    // Rutas + asignaciones
    counts['rutas'] = await batchCreate(tx, 'ruta', withTenantId(rutaData, tenantId));
    counts['rutaClientes'] = await batchCreate(tx, 'rutaCliente', stripAutoId(rutaClienteData));

    // Catálogos con UUID
    counts['preciosCliente'] = await batchCreate(tx, 'precioCliente', withTenantId(precioData, tenantId));
    counts['politicas'] = await batchCreate(tx, 'politicaComercial', withTenantId(politicaData, tenantId));
    counts['objetivos'] = await batchCreate(tx, 'objetivo', withTenantId(objetivoData, tenantId));
    counts['mensajes'] = await batchCreate(tx, 'mensaje', withTenantId(mensajeData, tenantId));
    counts['billeteras'] = await batchCreate(tx, 'billetera', withTenantId(billeteraData, tenantId));
    counts['denominaciones'] = await batchCreate(tx, 'denominacion', withTenantId(denominacionData, tenantId));

    // Jornadas → Visitas → GPS
    counts['jornadas'] = await batchCreate(tx, 'jornada', withTenantId(jornadaData, tenantId));
    counts['visitas'] = await batchCreate(tx, 'visita', visitaData);
    counts['gpsPoints'] = await batchCreate(tx, 'gpsPoint', stripAutoId(gpsData));

    // Pedidos → Items
    counts['pedidos'] = await batchCreate(tx, 'pedido', withTenantId(pedidoData, tenantId));
    counts['pedidoItems'] = await batchCreate(tx, 'pedidoItem', stripAutoId(pedidoItemData));

    // Cobranzas → Medios → Imputaciones
    counts['cobranzas'] = await batchCreate(tx, 'cobranza', withTenantId(cobranzaData, tenantId));
    counts['cobranzaMedios'] = await batchCreate(tx, 'cobranzaMedio', stripAutoId(medioData));
    counts['cobranzaImputaciones'] = await batchCreate(tx, 'cobranzaImputacion', stripAutoId(imputacionData));

    // Devoluciones → Items
    counts['devoluciones'] = await batchCreate(tx, 'devolucion', withTenantId(devolucionData, tenantId));
    counts['devolucionItems'] = await batchCreate(tx, 'devolucionItem', stripAutoId(devolucionItemData));

    // Cuenta corriente
    counts['cuentaCorriente'] = await batchCreate(tx, 'cuentaCorriente', withTenantId(ccData, tenantId));

    // Rendiciones → Cheques
    counts['rendiciones'] = await batchCreate(tx, 'rendicion', withTenantId(rendicionData, tenantId));
    counts['rendicionCheques'] = await batchCreate(tx, 'rendicionCheque', stripAutoId(chequeData));

    // Presupuestos → Items
    counts['presupuestos'] = await batchCreate(tx, 'presupuesto', withTenantId(presupuestoData, tenantId));
    counts['presupuestoItems'] = await batchCreate(tx, 'presupuestoItem', stripAutoId(presupuestoItemData));

    // Fotos y firmas
    counts['fotosEvidencia'] = await batchCreate(tx, 'fotoEvidencia', withTenantId(fotoData, tenantId));
    counts['firmas'] = await batchCreate(tx, 'firma', withTenantId(firmaData, tenantId));

    // Formularios → Respuestas + Sugerencias
    counts['formularios'] = await batchCreate(tx, 'formulario', withTenantId(formularioData, tenantId));
    counts['formularioRespuestas'] = await batchCreate(tx, 'formularioRespuesta', respuestaData);
    counts['sugerenciasVenta'] = await batchCreate(tx, 'sugerenciaVenta', withTenantId(sugerenciaData, tenantId));

    // Logs
    counts['syncLogs'] = await batchCreate(tx, 'syncLog', withTenantId(stripAutoId(syncLogData), tenantId));
    counts['importLogs'] = await batchCreate(tx, 'importLog', withTenantId(importLogData, tenantId));
  }, { timeout: 120000 });

  // Quitar conteos en cero
  for (const key of Object.keys(counts)) {
    if (counts[key] === 0) delete counts[key];
  }

  logger.info(`Restore completado para tenant ${tenant.codigo}: ${JSON.stringify(counts)}`);
  return { registrosRestaurados: counts, advertencias };
}
