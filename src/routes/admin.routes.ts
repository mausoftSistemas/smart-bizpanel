import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { authMiddleware, requireRole } from '../middleware/auth.middleware';
import { tenantMiddleware } from '../middleware/tenant.middleware';
import { successResponse, paginatedResponse } from '../utils/helpers';
import { ValidationError, NotFoundError } from '../utils/errors';
import { ErpBridgeService } from '../services/erp-bridge.service';
import { SyncService } from '../services/sync.service';

const router = Router();
const prisma = new PrismaClient();
const erpBridge = new ErpBridgeService();
const syncService = new SyncService();

router.use(authMiddleware, tenantMiddleware, requireRole('admin'));

// ═══════════════════════════════════════════════════════════
// TENANTS
// ═══════════════════════════════════════════════════════════

router.get('/tenants', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const where = {};
    const [data, total] = await Promise.all([
      prisma.tenant.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true, codigo: true, razonSocial: true, email: true,
          plan: true, estado: true, erpTipo: true, createdAt: true,
        },
      }),
      prisma.tenant.count({ where }),
    ]);
    paginatedResponse(res, data, total, page, limit);
  } catch (err) {
    next(err);
  }
});

router.post('/tenants', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { codigo, razonSocial, email, plan, erpTipo, erpUrl, erpCredenciales } = req.body;
    if (!codigo || !razonSocial || !email) {
      throw new ValidationError('codigo, razonSocial y email son requeridos');
    }

    const tenant = await prisma.tenant.create({
      data: {
        codigo, razonSocial, email,
        plan: plan || 'basico',
        erpTipo: erpTipo || 'standalone',
        erpUrl: erpUrl || null,
        erpCredenciales: erpCredenciales || null,
      },
      select: {
        id: true, codigo: true, razonSocial: true, email: true,
        plan: true, estado: true, erpTipo: true, createdAt: true,
      },
    });
    successResponse(res, tenant, 201);
  } catch (err) {
    next(err);
  }
});

router.put('/tenants/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.params.id as string;
    const { razonSocial, email, plan, estado, erpTipo, erpUrl, erpCredenciales, erpMapping,
      maxVendedores, moduloGps, moduloMp, moduloFirma, moduloEmail,
      logo, colorPrimario, colorSecundario, nombreApp } = req.body;

    const tenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        ...(razonSocial !== undefined && { razonSocial }),
        ...(email !== undefined && { email }),
        ...(plan !== undefined && { plan }),
        ...(estado !== undefined && { estado }),
        ...(erpTipo !== undefined && { erpTipo }),
        ...(erpUrl !== undefined && { erpUrl }),
        ...(erpCredenciales !== undefined && { erpCredenciales }),
        ...(erpMapping !== undefined && { erpMapping }),
        ...(maxVendedores !== undefined && { maxVendedores }),
        ...(moduloGps !== undefined && { moduloGps }),
        ...(moduloMp !== undefined && { moduloMp }),
        ...(moduloFirma !== undefined && { moduloFirma }),
        ...(moduloEmail !== undefined && { moduloEmail }),
        ...(logo !== undefined && { logo }),
        ...(colorPrimario !== undefined && { colorPrimario }),
        ...(colorSecundario !== undefined && { colorSecundario }),
        ...(nombreApp !== undefined && { nombreApp }),
      },
      select: {
        id: true, codigo: true, razonSocial: true, email: true,
        plan: true, estado: true, erpTipo: true, createdAt: true,
      },
    });
    successResponse(res, tenant);
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════════════════
// USERS
// ═══════════════════════════════════════════════════════════

router.get('/users', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId!;
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 50, 200);

    const where = { tenantId };
    const [data, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        select: { id: true, nombre: true, email: true, rol: true, activo: true, createdAt: true, lastLogin: true },
      }),
      prisma.user.count({ where }),
    ]);
    paginatedResponse(res, data, total, page, limit);
  } catch (err) {
    next(err);
  }
});

// Mantener la ruta legacy /usuarios como alias
router.get('/usuarios', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId!;
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 50, 200);

    const where = { tenantId };
    const [data, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        select: { id: true, nombre: true, email: true, rol: true, activo: true, createdAt: true, lastLogin: true },
      }),
      prisma.user.count({ where }),
    ]);
    paginatedResponse(res, data, total, page, limit);
  } catch (err) {
    next(err);
  }
});

router.post('/users', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { nombre, email, password, rol } = req.body;
    if (!nombre || !email || !password) throw new ValidationError('nombre, email y password son requeridos');

    const effectiveRol = rol || 'vendedor';
    if (effectiveRol === 'vendedor' && req.tenant) {
      const count = await prisma.user.count({ where: { tenantId: req.tenantId!, rol: 'vendedor', activo: true } });
      if (count >= req.tenant.maxVendedores) {
        throw new ValidationError(`Límite de vendedores alcanzado (${req.tenant.maxVendedores}). Actualizá tu plan para agregar más.`);
      }
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { tenantId: req.tenantId!, nombre, email, passwordHash: hashed, rol: effectiveRol },
      select: { id: true, nombre: true, email: true, rol: true },
    });
    successResponse(res, user, 201);
  } catch (err) {
    next(err);
  }
});

// Mantener la ruta legacy /usuarios como alias
router.post('/usuarios', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { nombre, email, password, rol } = req.body;
    if (!nombre || !email || !password) throw new ValidationError('nombre, email y password son requeridos');

    const effectiveRol = rol || 'vendedor';
    if (effectiveRol === 'vendedor' && req.tenant) {
      const count = await prisma.user.count({ where: { tenantId: req.tenantId!, rol: 'vendedor', activo: true } });
      if (count >= req.tenant.maxVendedores) {
        throw new ValidationError(`Límite de vendedores alcanzado (${req.tenant.maxVendedores}). Actualizá tu plan para agregar más.`);
      }
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { tenantId: req.tenantId!, nombre, email, passwordHash: hashed, rol: effectiveRol },
      select: { id: true, nombre: true, email: true, rol: true },
    });
    successResponse(res, user, 201);
  } catch (err) {
    next(err);
  }
});

router.put('/users/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.params.id as string;
    const tenantId = req.tenantId!;
    const { nombre, email, rol, activo, password } = req.body;

    // Verificar que el user pertenece al tenant
    const existing = await prisma.user.findFirst({ where: { id: userId, tenantId } });
    if (!existing) throw new NotFoundError('Usuario');

    // Si se cambia rol a vendedor (y antes no lo era), validar límite
    if (rol === 'vendedor' && existing.rol !== 'vendedor' && req.tenant) {
      const count = await prisma.user.count({ where: { tenantId, rol: 'vendedor', activo: true } });
      if (count >= req.tenant.maxVendedores) {
        throw new ValidationError(`Límite de vendedores alcanzado (${req.tenant.maxVendedores}). Actualizá tu plan para agregar más.`);
      }
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(nombre !== undefined && { nombre }),
        ...(email !== undefined && { email }),
        ...(rol !== undefined && { rol }),
        ...(activo !== undefined && { activo }),
        ...(password && { passwordHash: await bcrypt.hash(password, 10) }),
      },
      select: { id: true, nombre: true, email: true, rol: true, activo: true },
    });
    successResponse(res, user);
  } catch (err) {
    next(err);
  }
});

router.delete('/users/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.params.id as string;
    const tenantId = req.tenantId!;

    const existing = await prisma.user.findFirst({ where: { id: userId, tenantId } });
    if (!existing) throw new NotFoundError('Usuario');

    // Soft delete: desactivar en vez de borrar
    await prisma.user.update({
      where: { id: userId },
      data: { activo: false },
    });
    successResponse(res, { id: userId, activo: false });
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════════════════
// CONFIG DEL TENANT
// ═══════════════════════════════════════════════════════════

router.get('/config', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId!;
    const config = await prisma.tenantConfig.findUnique({ where: { tenantId } });
    successResponse(res, config);
  } catch (err) {
    next(err);
  }
});

router.put('/config', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId!;
    const {
      moneda, formatoFecha, ivaDefault,
      montoMinimoPedido, montoMaximoPedido, permitePedidoSinStock, requiereFirma,
      permiteEfectivo, permiteCheque, permiteTransferencia, permiteBilletera, permiteMercadoPago,
      jornadaObligatoria, horaInicioMin, horaInicioMax, horaFinMax, requiereGeoInicio,
      maxDescuentoVendedor, maxDescuentoSupervisor,
      diasLimiteDevolucion, devolucionRequiereFoto, devolucionRequiereAprobacion,
      trackingIntervaloSeg, trackingActivo,
    } = req.body;

    const data = {
      ...(moneda !== undefined && { moneda }),
      ...(formatoFecha !== undefined && { formatoFecha }),
      ...(ivaDefault !== undefined && { ivaDefault }),
      ...(montoMinimoPedido !== undefined && { montoMinimoPedido }),
      ...(montoMaximoPedido !== undefined && { montoMaximoPedido }),
      ...(permitePedidoSinStock !== undefined && { permitePedidoSinStock }),
      ...(requiereFirma !== undefined && { requiereFirma }),
      ...(permiteEfectivo !== undefined && { permiteEfectivo }),
      ...(permiteCheque !== undefined && { permiteCheque }),
      ...(permiteTransferencia !== undefined && { permiteTransferencia }),
      ...(permiteBilletera !== undefined && { permiteBilletera }),
      ...(permiteMercadoPago !== undefined && { permiteMercadoPago }),
      ...(jornadaObligatoria !== undefined && { jornadaObligatoria }),
      ...(horaInicioMin !== undefined && { horaInicioMin }),
      ...(horaInicioMax !== undefined && { horaInicioMax }),
      ...(horaFinMax !== undefined && { horaFinMax }),
      ...(requiereGeoInicio !== undefined && { requiereGeoInicio }),
      ...(maxDescuentoVendedor !== undefined && { maxDescuentoVendedor }),
      ...(maxDescuentoSupervisor !== undefined && { maxDescuentoSupervisor }),
      ...(diasLimiteDevolucion !== undefined && { diasLimiteDevolucion }),
      ...(devolucionRequiereFoto !== undefined && { devolucionRequiereFoto }),
      ...(devolucionRequiereAprobacion !== undefined && { devolucionRequiereAprobacion }),
      ...(trackingIntervaloSeg !== undefined && { trackingIntervaloSeg }),
      ...(trackingActivo !== undefined && { trackingActivo }),
    };

    const config = await prisma.tenantConfig.upsert({
      where: { tenantId },
      update: data,
      create: { tenantId, ...data },
    });
    successResponse(res, config);
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════════════════
// POLÍTICAS COMERCIALES
// ═══════════════════════════════════════════════════════════

router.get('/politicas', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId!;
    const data = await prisma.politicaComercial.findMany({
      where: { tenantId },
      orderBy: { prioridad: 'desc' },
    });
    successResponse(res, data);
  } catch (err) {
    next(err);
  }
});

router.post('/politicas', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId!;
    const { nombre, evento, condiciones, accion, accionParams, mensaje, prioridad } = req.body;
    if (!nombre || !evento || !condiciones || !accion) {
      throw new ValidationError('nombre, evento, condiciones y accion son requeridos');
    }

    const politica = await prisma.politicaComercial.create({
      data: {
        tenantId, nombre, evento, condiciones, accion,
        accionParams: accionParams || null,
        mensaje: mensaje || null,
        prioridad: prioridad || 0,
      },
    });
    successResponse(res, politica, 201);
  } catch (err) {
    next(err);
  }
});

router.put('/politicas/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId!;
    const politicaId = req.params.id as string;
    const { nombre, evento, condiciones, accion, accionParams, mensaje, prioridad, activo } = req.body;

    const existing = await prisma.politicaComercial.findFirst({ where: { id: politicaId, tenantId } });
    if (!existing) throw new NotFoundError('Política comercial');

    const politica = await prisma.politicaComercial.update({
      where: { id: politicaId },
      data: {
        ...(nombre !== undefined && { nombre }),
        ...(evento !== undefined && { evento }),
        ...(condiciones !== undefined && { condiciones }),
        ...(accion !== undefined && { accion }),
        ...(accionParams !== undefined && { accionParams }),
        ...(mensaje !== undefined && { mensaje }),
        ...(prioridad !== undefined && { prioridad }),
        ...(activo !== undefined && { activo }),
      },
    });
    successResponse(res, politica);
  } catch (err) {
    next(err);
  }
});

router.delete('/politicas/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId!;
    const politicaId = req.params.id as string;

    const existing = await prisma.politicaComercial.findFirst({ where: { id: politicaId, tenantId } });
    if (!existing) throw new NotFoundError('Política comercial');

    await prisma.politicaComercial.delete({ where: { id: politicaId } });
    successResponse(res, { id: politicaId, deleted: true });
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════════════════
// CONDICIONES DE VENTA (CRUD)
// ═══════════════════════════════════════════════════════════

router.get('/condiciones-venta', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await prisma.condicionVenta.findMany({
      where: { tenantId: req.tenantId! },
      orderBy: { nombre: 'asc' },
    });
    successResponse(res, data);
  } catch (err) { next(err); }
});

router.post('/condiciones-venta', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { codigo, nombre, diasPlazo, recargo, bonificacion, contado } = req.body;
    if (!codigo || !nombre) throw new ValidationError('codigo y nombre son requeridos');
    const item = await prisma.condicionVenta.create({
      data: {
        tenantId: req.tenantId!, codigo, nombre,
        diasPlazo: diasPlazo ?? 0, recargo: recargo ?? 0,
        bonificacion: bonificacion ?? 0, contado: contado ?? 0,
      },
    });
    successResponse(res, item, 201);
  } catch (err) { next(err); }
});

router.put('/condiciones-venta/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const existing = await prisma.condicionVenta.findFirst({ where: { id, tenantId: req.tenantId! } });
    if (!existing) throw new NotFoundError('Condicion de venta');
    const { codigo, nombre, diasPlazo, recargo, bonificacion, contado, activo } = req.body;
    const item = await prisma.condicionVenta.update({
      where: { id },
      data: {
        ...(codigo !== undefined && { codigo }),
        ...(nombre !== undefined && { nombre }),
        ...(diasPlazo !== undefined && { diasPlazo }),
        ...(recargo !== undefined && { recargo }),
        ...(bonificacion !== undefined && { bonificacion }),
        ...(contado !== undefined && { contado }),
        ...(activo !== undefined && { activo }),
      },
    });
    successResponse(res, item);
  } catch (err) { next(err); }
});

router.delete('/condiciones-venta/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const existing = await prisma.condicionVenta.findFirst({ where: { id, tenantId: req.tenantId! } });
    if (!existing) throw new NotFoundError('Condicion de venta');
    await prisma.condicionVenta.update({ where: { id }, data: { activo: false } });
    successResponse(res, { id, activo: false });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════════
// MOTIVOS NO COMPRA (CRUD)
// ═══════════════════════════════════════════════════════════

router.get('/motivos-no-compra', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await prisma.motivoNoCompra.findMany({
      where: { tenantId: req.tenantId! },
      orderBy: { descripcion: 'asc' },
    });
    successResponse(res, data);
  } catch (err) { next(err); }
});

router.post('/motivos-no-compra', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { codigo, descripcion } = req.body;
    if (!codigo || !descripcion) throw new ValidationError('codigo y descripcion son requeridos');
    const item = await prisma.motivoNoCompra.create({
      data: { tenantId: req.tenantId!, codigo, descripcion },
    });
    successResponse(res, item, 201);
  } catch (err) { next(err); }
});

router.put('/motivos-no-compra/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const existing = await prisma.motivoNoCompra.findFirst({ where: { id, tenantId: req.tenantId! } });
    if (!existing) throw new NotFoundError('Motivo no compra');
    const { codigo, descripcion, activo } = req.body;
    const item = await prisma.motivoNoCompra.update({
      where: { id },
      data: {
        ...(codigo !== undefined && { codigo }),
        ...(descripcion !== undefined && { descripcion }),
        ...(activo !== undefined && { activo }),
      },
    });
    successResponse(res, item);
  } catch (err) { next(err); }
});

router.delete('/motivos-no-compra/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const existing = await prisma.motivoNoCompra.findFirst({ where: { id, tenantId: req.tenantId! } });
    if (!existing) throw new NotFoundError('Motivo no compra');
    await prisma.motivoNoCompra.update({ where: { id }, data: { activo: false } });
    successResponse(res, { id, activo: false });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════════
// BILLETERAS (CRUD)
// ═══════════════════════════════════════════════════════════

router.get('/billeteras', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await prisma.billetera.findMany({
      where: { tenantId: req.tenantId! },
      orderBy: { nombre: 'asc' },
    });
    successResponse(res, data);
  } catch (err) { next(err); }
});

router.post('/billeteras', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { nombre, alias, cbu } = req.body;
    if (!nombre) throw new ValidationError('nombre es requerido');
    const item = await prisma.billetera.create({
      data: { tenantId: req.tenantId!, nombre, alias: alias || null, cbu: cbu || null },
    });
    successResponse(res, item, 201);
  } catch (err) { next(err); }
});

router.put('/billeteras/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const existing = await prisma.billetera.findFirst({ where: { id, tenantId: req.tenantId! } });
    if (!existing) throw new NotFoundError('Billetera');
    const { nombre, alias, cbu, activo } = req.body;
    const item = await prisma.billetera.update({
      where: { id },
      data: {
        ...(nombre !== undefined && { nombre }),
        ...(alias !== undefined && { alias }),
        ...(cbu !== undefined && { cbu }),
        ...(activo !== undefined && { activo }),
      },
    });
    successResponse(res, item);
  } catch (err) { next(err); }
});

router.delete('/billeteras/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const existing = await prisma.billetera.findFirst({ where: { id, tenantId: req.tenantId! } });
    if (!existing) throw new NotFoundError('Billetera');
    await prisma.billetera.update({ where: { id }, data: { activo: false } });
    successResponse(res, { id, activo: false });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════════
// DENOMINACIONES (CRUD)
// ═══════════════════════════════════════════════════════════

router.get('/denominaciones', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await prisma.denominacion.findMany({
      where: { tenantId: req.tenantId! },
      orderBy: { valor: 'desc' },
    });
    successResponse(res, data);
  } catch (err) { next(err); }
});

router.post('/denominaciones', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tipo, valor, moneda } = req.body;
    if (!tipo || valor === undefined) throw new ValidationError('tipo y valor son requeridos');
    const item = await prisma.denominacion.create({
      data: { tenantId: req.tenantId!, tipo, valor, moneda: moneda || 'ARS' },
    });
    successResponse(res, item, 201);
  } catch (err) { next(err); }
});

router.put('/denominaciones/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const existing = await prisma.denominacion.findFirst({ where: { id, tenantId: req.tenantId! } });
    if (!existing) throw new NotFoundError('Denominacion');
    const { tipo, valor, moneda, activo } = req.body;
    const item = await prisma.denominacion.update({
      where: { id },
      data: {
        ...(tipo !== undefined && { tipo }),
        ...(valor !== undefined && { valor }),
        ...(moneda !== undefined && { moneda }),
        ...(activo !== undefined && { activo }),
      },
    });
    successResponse(res, item);
  } catch (err) { next(err); }
});

router.delete('/denominaciones/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const existing = await prisma.denominacion.findFirst({ where: { id, tenantId: req.tenantId! } });
    if (!existing) throw new NotFoundError('Denominacion');
    await prisma.denominacion.update({ where: { id }, data: { activo: false } });
    successResponse(res, { id, activo: false });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════════
// OBJETIVOS (CRUD)
// ═══════════════════════════════════════════════════════════

router.post('/objetivos', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { vendedorId, tipo, nombre, metrica, valorObjetivo, periodoInicio, periodoFin } = req.body;
    if (!tipo || !nombre || !metrica || !valorObjetivo || !periodoInicio || !periodoFin) {
      throw new ValidationError('tipo, nombre, metrica, valorObjetivo, periodoInicio y periodoFin son requeridos');
    }
    const item = await prisma.objetivo.create({
      data: {
        tenantId: req.tenantId!, vendedorId: vendedorId || null,
        tipo, nombre, metrica, valorObjetivo: parseFloat(valorObjetivo),
        periodoInicio: new Date(periodoInicio), periodoFin: new Date(periodoFin),
      },
    });
    successResponse(res, item, 201);
  } catch (err) { next(err); }
});

router.put('/objetivos/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const existing = await prisma.objetivo.findFirst({ where: { id, tenantId: req.tenantId! } });
    if (!existing) throw new NotFoundError('Objetivo');
    const { vendedorId, tipo, nombre, metrica, valorObjetivo, periodoInicio, periodoFin, activo } = req.body;
    const item = await prisma.objetivo.update({
      where: { id },
      data: {
        ...(vendedorId !== undefined && { vendedorId: vendedorId || null }),
        ...(tipo !== undefined && { tipo }),
        ...(nombre !== undefined && { nombre }),
        ...(metrica !== undefined && { metrica }),
        ...(valorObjetivo !== undefined && { valorObjetivo: parseFloat(valorObjetivo) }),
        ...(periodoInicio !== undefined && { periodoInicio: new Date(periodoInicio) }),
        ...(periodoFin !== undefined && { periodoFin: new Date(periodoFin) }),
        ...(activo !== undefined && { activo }),
      },
    });
    successResponse(res, item);
  } catch (err) { next(err); }
});

router.delete('/objetivos/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const existing = await prisma.objetivo.findFirst({ where: { id, tenantId: req.tenantId! } });
    if (!existing) throw new NotFoundError('Objetivo');
    await prisma.objetivo.update({ where: { id }, data: { activo: false } });
    successResponse(res, { id, activo: false });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════════
// MENSAJES (CRUD)
// ═══════════════════════════════════════════════════════════

router.get('/mensajes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await prisma.mensaje.findMany({
      where: { tenantId: req.tenantId! },
      orderBy: { createdAt: 'desc' },
    });
    // Resolve vendedor names
    const vendedorIds = [...new Set(data.map(m => m.vendedorId).filter(Boolean))] as string[];
    const vendedores = vendedorIds.length > 0
      ? await prisma.user.findMany({ where: { id: { in: vendedorIds } }, select: { id: true, nombre: true } })
      : [];
    const vendedorMap = Object.fromEntries(vendedores.map(v => [v.id, v.nombre]));
    successResponse(res, data.map(m => ({
      ...m,
      vendedorNombre: m.vendedorId ? (vendedorMap[m.vendedorId] || '—') : 'Todos',
    })));
  } catch (err) { next(err); }
});

router.post('/mensajes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { vendedorId, titulo, cuerpo, tipo } = req.body;
    if (!titulo || !cuerpo) throw new ValidationError('titulo y cuerpo son requeridos');
    const item = await prisma.mensaje.create({
      data: {
        tenantId: req.tenantId!, vendedorId: vendedorId || null,
        titulo, cuerpo, tipo: tipo || 'info',
      },
    });
    successResponse(res, item, 201);
  } catch (err) { next(err); }
});

router.delete('/mensajes/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const existing = await prisma.mensaje.findFirst({ where: { id, tenantId: req.tenantId! } });
    if (!existing) throw new NotFoundError('Mensaje');
    await prisma.mensaje.delete({ where: { id } });
    successResponse(res, { id, deleted: true });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════════
// DETALLE PEDIDOS / COBRANZAS
// ═══════════════════════════════════════════════════════════

router.get('/pedidos/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const pedido = await prisma.pedido.findFirst({
      where: { id, tenantId: req.tenantId! },
      include: {
        items: true,
        cliente: { select: { id: true, nombre: true, codigo: true, direccion: true, telefono: true } },
        vendedor: { select: { id: true, nombre: true, email: true } },
      },
    });
    if (!pedido) throw new NotFoundError('Pedido');
    successResponse(res, pedido);
  } catch (err) { next(err); }
});

router.get('/cobranzas/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const cobranza = await prisma.cobranza.findFirst({
      where: { id, tenantId: req.tenantId! },
      include: {
        medios: true,
        imputaciones: true,
        cliente: { select: { id: true, nombre: true, codigo: true, direccion: true, telefono: true } },
        vendedor: { select: { id: true, nombre: true, email: true } },
      },
    });
    if (!cobranza) throw new NotFoundError('Cobranza');
    successResponse(res, cobranza);
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════

router.get('/dashboard', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId!;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      vendedoresActivos,
      pedidosHoy,
      cobranzasHoy,
      productosActivos,
      clientesActivos,
    ] = await Promise.all([
      prisma.jornada.count({ where: { tenantId, estado: 'activa', fecha: { gte: today } } }),
      prisma.pedido.findMany({
        where: { tenantId, createdAt: { gte: today } },
        select: { total: true },
      }),
      prisma.cobranza.findMany({
        where: { tenantId, createdAt: { gte: today } },
        select: { total: true },
      }),
      prisma.producto.count({ where: { tenantId, activo: true } }),
      prisma.cliente.count({ where: { tenantId, activo: true } }),
    ]);

    const montoPedidosHoy = pedidosHoy.reduce((sum, p) => sum + Number(p.total ?? 0), 0);
    const montoCobranzasHoy = cobranzasHoy.reduce((sum, c) => sum + Number(c.total ?? 0), 0);

    // Ventas últimos 7 días
    const ventasSemana: { dia: string; monto: number }[] = [];
    const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);

      const pedidos = await prisma.pedido.findMany({
        where: { tenantId, createdAt: { gte: d, lt: next } },
        select: { total: true },
      });
      const monto = pedidos.reduce((sum, p) => sum + Number(p.total ?? 0), 0);
      ventasSemana.push({ dia: dias[d.getDay()], monto });
    }

    // Últimos 10 pedidos
    const ultimosPedidos = await prisma.pedido.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true, fecha: true, total: true, estado: true, createdAt: true,
        cliente: { select: { nombre: true, codigo: true } },
        vendedor: { select: { nombre: true } },
      },
    });

    // Sync pendientes
    const syncPendientes = await prisma.pedido.count({
      where: { tenantId, erpSynced: false },
    });

    successResponse(res, {
      vendedoresActivos,
      pedidosHoy: pedidosHoy.length,
      montoPedidosHoy,
      cobranzasHoy: cobranzasHoy.length,
      montoCobranzasHoy,
      productosActivos,
      clientesActivos,
      syncPendientes,
      ventasSemana,
      ultimosPedidos,
    });
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════════════════
// CUENTA CORRIENTE
// ═══════════════════════════════════════════════════════════

router.get('/cuenta-corriente', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId!;
    const clienteId = req.query.clienteId as string | undefined;
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 50, 200);

    const where: Record<string, unknown> = { tenantId };
    if (clienteId) where.clienteId = clienteId;

    const [data, total] = await Promise.all([
      prisma.cuentaCorriente.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { fecha: 'desc' },
        include: { cliente: { select: { nombre: true, codigo: true } } },
      }),
      prisma.cuentaCorriente.count({ where }),
    ]);
    paginatedResponse(res, data, total, page, limit);
  } catch (err) {
    next(err);
  }
});

router.post('/cuenta-corriente', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId!;
    const { clienteId, tipoMovimiento, numero, fecha, fechaVencimiento, monto } = req.body;

    if (!clienteId || !tipoMovimiento || !numero || !fecha || monto === undefined) {
      throw new ValidationError('clienteId, tipoMovimiento, numero, fecha y monto son requeridos');
    }

    const cliente = await prisma.cliente.findFirst({ where: { id: clienteId, tenantId } });
    if (!cliente) throw new NotFoundError('Cliente');

    const esDebe = ['factura', 'nota_debito'].includes(tipoMovimiento);
    const montoNum = Math.abs(Number(monto));

    const movimiento = await prisma.cuentaCorriente.create({
      data: {
        tenantId,
        clienteId,
        tipoMovimiento,
        numero,
        fecha: new Date(fecha),
        fechaVencimiento: fechaVencimiento ? new Date(fechaVencimiento) : null,
        debe: esDebe ? montoNum : 0,
        haber: esDebe ? 0 : montoNum,
        saldo: 0, // se recalcula
      },
      include: { cliente: { select: { nombre: true, codigo: true } } },
    });

    // Recalcular saldo del cliente
    const agg = await prisma.cuentaCorriente.aggregate({
      where: { clienteId, tenantId },
      _sum: { debe: true, haber: true },
    });
    const saldo = Number(agg._sum.debe ?? 0) - Number(agg._sum.haber ?? 0);

    await prisma.cliente.update({
      where: { id: clienteId },
      data: { saldoCuenta: saldo },
    });

    successResponse(res, movimiento, 201);
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════════════════
// VENDEDORES
// ═══════════════════════════════════════════════════════════

router.get('/vendedores/activos', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId!;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Jornadas activas hoy
    const jornadas = await prisma.jornada.findMany({
      where: { tenantId, fecha: { gte: today }, estado: 'activa' },
      include: {
        vendedor: { select: { id: true, nombre: true, email: true } },
        visitas: { select: { id: true } },
      },
    });

    const result = await Promise.all(jornadas.map(async (j) => {
      const lastGps = await prisma.gpsPoint.findFirst({
        where: { vendedorId: j.vendedorId, jornadaId: j.id },
        orderBy: { timestamp: 'desc' },
      });
      return {
        vendedorId: j.vendedorId,
        vendedorNombre: j.vendedor.nombre,
        vendedorEmail: j.vendedor.email,
        jornadaId: j.id,
        horaInicio: j.horaInicio,
        clientesVisitados: j.clientesVisitados,
        clientesPlan: j.clientesPlan,
        totalVendido: Number(j.totalVendido ?? 0),
        totalCobrado: Number(j.totalCobrado ?? 0),
        kmRecorridos: Number(j.kmRecorridos ?? 0),
        visitasCount: j.visitas.length,
        lastGps: lastGps ? {
          latitud: Number(lastGps.latitud),
          longitud: Number(lastGps.longitud),
          timestamp: lastGps.timestamp,
          velocidad: lastGps.velocidad ? Number(lastGps.velocidad) : null,
          bateria: lastGps.bateria,
        } : null,
      };
    }));

    successResponse(res, result);
  } catch (err) {
    next(err);
  }
});

router.get('/vendedores/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId!;
    const vendedorId = req.params.id as string;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const vendedor = await prisma.user.findFirst({
      where: { id: vendedorId, tenantId },
      select: { id: true, nombre: true, email: true, rol: true, lastLogin: true, activo: true },
    });
    if (!vendedor) throw new NotFoundError('Vendedor');

    const jornadaActual = await prisma.jornada.findFirst({
      where: { vendedorId, tenantId, fecha: { gte: today } },
      orderBy: { horaInicio: 'desc' },
      include: {
        visitas: {
          orderBy: { fechaHora: 'desc' },
        },
      },
    });

    // Resolve client names for visitas
    if (jornadaActual?.visitas?.length) {
      const clienteIds = [...new Set(jornadaActual.visitas.map(v => v.clienteId))];
      const clientes = await prisma.cliente.findMany({
        where: { id: { in: clienteIds } },
        select: { id: true, nombre: true, codigo: true },
      });
      const clienteMap = Object.fromEntries(clientes.map(c => [c.id, c]));
      (jornadaActual as any).visitas = jornadaActual.visitas.map(v => ({
        ...v,
        cliente: clienteMap[v.clienteId] || { nombre: '—', codigo: '' },
      }));
    }

    const [pedidosHoy, cobranzasHoy] = await Promise.all([
      prisma.pedido.findMany({
        where: { vendedorId, tenantId, createdAt: { gte: today } },
        select: { id: true, total: true, estado: true, cliente: { select: { nombre: true } } },
      }),
      prisma.cobranza.findMany({
        where: { vendedorId, tenantId, createdAt: { gte: today } },
        select: { id: true, total: true, cliente: { select: { nombre: true } } },
      }),
    ]);

    successResponse(res, {
      vendedor,
      jornadaActual: jornadaActual ? {
        ...jornadaActual,
        totalVendido: Number(jornadaActual.totalVendido ?? 0),
        totalCobrado: Number(jornadaActual.totalCobrado ?? 0),
        kmRecorridos: Number(jornadaActual.kmRecorridos ?? 0),
      } : null,
      pedidosHoy: pedidosHoy.map(p => ({ ...p, total: Number(p.total) })),
      cobranzasHoy: cobranzasHoy.map(c => ({ ...c, total: Number(c.total) })),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/vendedores/:id/jornadas', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId!;
    const vendedorId = req.params.id as string;
    const limit = Math.min(Number(req.query.limit) || 30, 100);

    const jornadas = await prisma.jornada.findMany({
      where: { vendedorId, tenantId },
      orderBy: { fecha: 'desc' },
      take: limit,
      select: {
        id: true, fecha: true, horaInicio: true, horaFin: true, estado: true,
        clientesPlan: true, clientesVisitados: true, totalVendido: true,
        totalCobrado: true, kmRecorridos: true,
      },
    });

    successResponse(res, jornadas.map(j => ({
      ...j,
      totalVendido: Number(j.totalVendido ?? 0),
      totalCobrado: Number(j.totalCobrado ?? 0),
      kmRecorridos: Number(j.kmRecorridos ?? 0),
    })));
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════════════════
// REPORTES
// ═══════════════════════════════════════════════════════════

router.get('/reportes/ventas-vendedor', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId!;
    const desde = req.query.desde ? new Date(req.query.desde as string) : (() => { const d = new Date(); d.setDate(d.getDate() - 30); return d; })();
    const hasta = req.query.hasta ? new Date(req.query.hasta as string) : new Date();

    const vendedores = await prisma.user.findMany({
      where: { tenantId, rol: { in: ['vendedor', 'supervisor'] }, activo: true },
      select: { id: true, nombre: true },
    });

    const result = await Promise.all(vendedores.map(async (v) => {
      const [pedidos, cobranzas, clientesVisitados] = await Promise.all([
        prisma.pedido.findMany({
          where: { vendedorId: v.id, tenantId, createdAt: { gte: desde, lte: hasta } },
          select: { total: true },
        }),
        prisma.cobranza.findMany({
          where: { vendedorId: v.id, tenantId, createdAt: { gte: desde, lte: hasta } },
          select: { total: true },
        }),
        prisma.visita.count({
          where: { vendedorId: v.id, fechaHora: { gte: desde, lte: hasta } },
        }),
      ]);

      const totalClientes = await prisma.cliente.count({
        where: { tenantId, vendedorId: v.id, activo: true },
      });

      const montoPedidos = pedidos.reduce((sum, p) => sum + Number(p.total ?? 0), 0);
      const montoCobranzas = cobranzas.reduce((sum, c) => sum + Number(c.total ?? 0), 0);

      return {
        vendedorId: v.id,
        vendedorNombre: v.nombre,
        pedidos: pedidos.length,
        montoPedidos,
        cobranzas: cobranzas.length,
        montoCobranzas,
        ticketPromedio: pedidos.length > 0 ? montoPedidos / pedidos.length : 0,
        clientesVisitados,
        clientesTotal: totalClientes,
        cobertura: totalClientes > 0 ? Math.round((clientesVisitados / totalClientes) * 100) : 0,
      };
    }));

    successResponse(res, result);
  } catch (err) {
    next(err);
  }
});

router.get('/reportes/objetivos', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId!;
    const tipo = req.query.tipo as string | undefined;

    const where: Record<string, unknown> = { tenantId, activo: true };
    if (tipo && ['general', 'focal'].includes(tipo)) where.tipo = tipo;

    const objetivos = await prisma.objetivo.findMany({
      where,
      orderBy: { periodoFin: 'desc' },
    });

    // Resolve vendedor names
    const vendedorIds = [...new Set(objetivos.map(o => o.vendedorId).filter(Boolean))] as string[];
    const vendedores = vendedorIds.length > 0
      ? await prisma.user.findMany({ where: { id: { in: vendedorIds } }, select: { id: true, nombre: true } })
      : [];
    const vendedorMap = Object.fromEntries(vendedores.map(v => [v.id, v.nombre]));

    successResponse(res, objetivos.map(o => ({
      ...o,
      valorObjetivo: Number(o.valorObjetivo ?? 0),
      valorActual: Number(o.valorActual ?? 0),
      porcentaje: Number(o.valorObjetivo) > 0
        ? Math.round((Number(o.valorActual) / Number(o.valorObjetivo)) * 100)
        : 0,
      vendedorNombre: o.vendedorId ? (vendedorMap[o.vendedorId] || '—') : 'Todos',
    })));
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════════════════
// SYNC LOG & ERP
// ═══════════════════════════════════════════════════════════

router.get('/sync-log', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId!;
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 50, 200);

    const where = { tenantId };
    const [data, total] = await Promise.all([
      prisma.syncLog.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { startedAt: 'desc' },
      }),
      prisma.syncLog.count({ where }),
    ]);
    paginatedResponse(res, data, total, page, limit);
  } catch (err) {
    next(err);
  }
});

router.post('/sync/force', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId!;
    const pullResult = await syncService.pullFromErp(tenantId, req.user!.id);
    const pushResult = await syncService.pushPendingToErp(tenantId, req.user!.id);
    successResponse(res, { pull: pullResult, push: pushResult });
  } catch (err) {
    next(err);
  }
});

router.post('/sync/test-erp', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ok = await erpBridge.testConnection(req.tenantId!);
    successResponse(res, { connected: ok });
  } catch (err) {
    next(err);
  }
});

// ERP endpoints (de la implementación anterior)
router.get('/erp/test', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ok = await erpBridge.testConnection(req.tenantId!);
    successResponse(res, { connected: ok });
  } catch (err) {
    next(err);
  }
});

router.get('/erp/info', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const info = await erpBridge.getAdapterInfo(req.tenantId!);
    successResponse(res, info);
  } catch (err) {
    next(err);
  }
});

router.post('/erp/sync', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { entityType } = req.body;
    if (!entityType || !['productos', 'clientes', 'precios', 'stock'].includes(entityType)) {
      throw new ValidationError('entityType debe ser: productos, clientes, precios o stock');
    }
    const result = await erpBridge.syncFromErp(req.tenantId!, entityType);
    successResponse(res, result);
  } catch (err) {
    next(err);
  }
});

router.post('/erp/push-pedido/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pedidoId = req.params.id as string;
    const result = await erpBridge.syncPedidoToErp(req.tenantId!, pedidoId);
    successResponse(res, result);
  } catch (err) {
    next(err);
  }
});

router.post('/erp/push-devolucion/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const devolucionId = req.params.id as string;
    const result = await erpBridge.syncDevolucionToErp(req.tenantId!, devolucionId);
    successResponse(res, result);
  } catch (err) {
    next(err);
  }
});

export default router;
