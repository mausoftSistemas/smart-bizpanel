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

    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { tenantId: req.tenantId!, nombre, email, passwordHash: hashed, rol: rol || 'vendedor' },
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

    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { tenantId: req.tenantId!, nombre, email, passwordHash: hashed, rol: rol || 'vendedor' },
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
