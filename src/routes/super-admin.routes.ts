import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { env } from '../config/env';
import { superAdminMiddleware } from '../middleware/super-admin.middleware';
import { successResponse } from '../utils/helpers';
import { ValidationError, NotFoundError, UnauthorizedError } from '../utils/errors';
import { JwtPayload } from '../middleware/auth.middleware';
import multer from 'multer';
import { generateTenantBackup, getBackupDir, restoreTenantBackup } from '../services/backup.service';

const prisma = new PrismaClient();
const router = Router();

// ══════════════════════════════════════════════════════════
// AUTH (público, sin middleware)
// ══════════════════════════════════════════════════════════

router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) throw new ValidationError('Email y contraseña son obligatorios');

    const admin = await prisma.superAdmin.findUnique({ where: { email } });
    if (!admin) throw new UnauthorizedError('Credenciales inválidas');
    if (!admin.activo) throw new UnauthorizedError('Cuenta desactivada');

    const valid = await bcrypt.compare(password, admin.passwordHash);
    if (!valid) throw new UnauthorizedError('Credenciales inválidas');

    const token = jwt.sign(
      { superAdminId: admin.id, email: admin.email, role: 'super_admin' },
      env.JWT_SECRET,
      { expiresIn: '7d' } as jwt.SignOptions,
    );

    await prisma.superAdmin.update({
      where: { id: admin.id },
      data: { lastLogin: new Date() },
    });

    successResponse(res, {
      token,
      user: { id: admin.id, nombre: admin.nombre, email: admin.email, role: 'super_admin' },
    });
  } catch (err) {
    next(err);
  }
});

// ══════════════════════════════════════════════════════════
// Todo lo demás requiere autenticación de Super Admin
// ══════════════════════════════════════════════════════════

router.use(superAdminMiddleware);

// ─── GET /api/super/me ───────────────────────────────────

router.get('/me', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const admin = await prisma.superAdmin.findUnique({
      where: { id: req.superAdmin!.superAdminId },
      select: { id: true, email: true, nombre: true, createdAt: true, lastLogin: true },
    });
    if (!admin) throw new NotFoundError('Super Admin');
    successResponse(res, admin);
  } catch (err) {
    next(err);
  }
});

// ══════════════════════════════════════════════════════════
// GESTIÓN DE SUPER ADMINS
// ══════════════════════════════════════════════════════════

// ─── GET /api/super/admins ───────────────────────────────

router.get('/admins', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const admins = await prisma.superAdmin.findMany({
      select: { id: true, email: true, nombre: true, activo: true, createdAt: true, lastLogin: true },
      orderBy: { createdAt: 'asc' },
    });
    successResponse(res, admins);
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/super/admins ──────────────────────────────

router.post('/admins', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, nombre } = req.body;
    if (!email || !password || !nombre) {
      throw new ValidationError('email, password y nombre son obligatorios');
    }

    const existing = await prisma.superAdmin.findUnique({ where: { email } });
    if (existing) throw new ValidationError('Ya existe un super admin con ese email');

    const passwordHash = await bcrypt.hash(password, 10);
    const admin = await prisma.superAdmin.create({
      data: { email, passwordHash, nombre },
      select: { id: true, email: true, nombre: true, activo: true, createdAt: true },
    });

    successResponse(res, admin, 201);
  } catch (err) {
    next(err);
  }
});

// ─── PUT /api/super/admins/:id ───────────────────────────

router.put('/admins/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const existing = await prisma.superAdmin.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Super Admin');

    const { nombre, email, activo } = req.body;
    const data: Record<string, unknown> = {};
    if (nombre !== undefined) data.nombre = nombre;
    if (email !== undefined) {
      const dup = await prisma.superAdmin.findUnique({ where: { email } });
      if (dup && dup.id !== id) throw new ValidationError('Ya existe otro super admin con ese email');
      data.email = email;
    }
    if (activo !== undefined) data.activo = activo;

    const updated = await prisma.superAdmin.update({
      where: { id },
      data,
      select: { id: true, email: true, nombre: true, activo: true, createdAt: true, lastLogin: true },
    });

    successResponse(res, updated);
  } catch (err) {
    next(err);
  }
});

// ─── PUT /api/super/admins/:id/password ──────────────────

router.put('/admins/:id/password', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { password } = req.body;
    if (!password || password.length < 6) {
      throw new ValidationError('La contraseña debe tener al menos 6 caracteres');
    }

    const existing = await prisma.superAdmin.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Super Admin');

    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.superAdmin.update({ where: { id }, data: { passwordHash } });

    successResponse(res, { mensaje: 'Contraseña actualizada' });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/super/admins/:id ────────────────────────

router.delete('/admins/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const currentId = req.superAdmin!.superAdminId;

    if (id === currentId) {
      throw new ValidationError('No podés desactivar tu propia cuenta');
    }

    const existing = await prisma.superAdmin.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Super Admin');

    await prisma.superAdmin.update({ where: { id }, data: { activo: false } });

    successResponse(res, { mensaje: `Super Admin "${existing.nombre}" desactivado` });
  } catch (err) {
    next(err);
  }
});

// ══════════════════════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════════════════════

router.get('/dashboard', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const [
      totalTenants,
      tenantsActivos,
      totalVendedores,
      pedidosHoy,
      montoHoy,
      tenantsPorPlan,
      tenantsVencidos,
      topTenants,
    ] = await Promise.all([
      prisma.tenant.count(),
      prisma.tenant.count({ where: { estado: 'activo' } }),
      prisma.user.count({ where: { rol: 'vendedor', activo: true } }),
      prisma.pedido.count({ where: { createdAt: { gte: hoy } } }),
      prisma.pedido.aggregate({ where: { createdAt: { gte: hoy } }, _sum: { total: true } }),
      prisma.tenant.groupBy({ by: ['plan'], _count: { id: true } }),
      prisma.tenant.count({
        where: {
          estado: 'activo',
          proximoVencimiento: { lt: new Date() },
        },
      }),
      prisma.tenant.findMany({
        where: { estado: 'activo' },
        orderBy: { ultimaActividad: 'desc' },
        take: 5,
        select: {
          id: true,
          codigo: true,
          razonSocial: true,
          plan: true,
          cantidadPedidosMes: true,
          ultimaActividad: true,
        },
      }),
    ]);

    // Almacenamiento total
    const storage = await prisma.tenant.aggregate({ _sum: { almacenamientoMb: true } });

    const planes: Record<string, number> = {};
    for (const p of tenantsPorPlan) {
      planes[p.plan] = p._count.id;
    }

    successResponse(res, {
      totalEmpresas: totalTenants,
      empresasActivas: tenantsActivos,
      totalVendedoresActivos: totalVendedores,
      pedidosHoy,
      montoVendidoHoy: montoHoy._sum.total || 0,
      empresasPorPlan: planes,
      empresasConPlanVencido: tenantsVencidos,
      topEmpresasPorActividad: topTenants,
      almacenamientoTotalMb: storage._sum.almacenamientoMb || 0,
    });
  } catch (err) {
    next(err);
  }
});

// ══════════════════════════════════════════════════════════
// GESTIÓN DE EMPRESAS (TENANTS)
// ══════════════════════════════════════════════════════════

// ─── GET /api/super/tenants ──────────────────────────────

router.get('/tenants', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const search = req.query.search as string | undefined;
    const estado = req.query.estado as string | undefined;
    const plan = req.query.plan as string | undefined;

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { razonSocial: { contains: search, mode: 'insensitive' } },
        { codigo: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (estado) where.estado = estado;
    if (plan) where.plan = plan;

    const tenants = await prisma.tenant.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        codigo: true,
        razonSocial: true,
        email: true,
        plan: true,
        estado: true,
        maxVendedores: true,
        moduloGps: true,
        moduloMp: true,
        moduloFirma: true,
        moduloEmail: true,
        contactoNombre: true,
        contactoTelefono: true,
        planPrecio: true,
        planMoneda: true,
        planPeriodicidad: true,
        proximoVencimiento: true,
        diasMora: true,
        cantidadUsuarios: true,
        cantidadProductos: true,
        cantidadClientes: true,
        cantidadPedidosMes: true,
        ultimaActividad: true,
        almacenamientoMb: true,
        createdAt: true,
      },
    });

    successResponse(res, tenants);
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/super/tenants/:id ──────────────────────────

router.get('/tenants/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const tenant = await prisma.tenant.findUnique({
      where: { id },
      include: {
        config: true,
        _count: { select: { users: true, productos: true, clientes: true, pedidos: true, cobranzas: true } },
      },
    });
    if (!tenant) throw new NotFoundError('Empresa');
    successResponse(res, tenant);
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/super/tenants ─────────────────────────────

router.post('/tenants', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      codigo, razonSocial, cuit, email, plan, maxVendedores,
      contactoNombre, contactoTelefono, contactoEmail, notas,
      moduloGps, moduloMp, moduloFirma, moduloEmail,
      planPrecio, planMoneda, planPeriodicidad,
      adminEmail, adminPassword, adminNombre,
    } = req.body;

    if (!codigo || !razonSocial || !email) {
      throw new ValidationError('codigo, razonSocial y email son obligatorios');
    }
    if (!adminEmail || !adminPassword || !adminNombre) {
      throw new ValidationError('adminEmail, adminPassword y adminNombre son obligatorios');
    }

    // Verificar que no exista
    const existing = await prisma.tenant.findUnique({ where: { codigo } });
    if (existing) throw new ValidationError(`Ya existe una empresa con código "${codigo}"`);

    // Crear todo en transacción
    const result = await prisma.$transaction(async (tx) => {
      // 1. Crear Tenant
      const tenant = await tx.tenant.create({
        data: {
          codigo,
          razonSocial,
          cuit: cuit || null,
          email,
          plan: plan || 'basico',
          maxVendedores: maxVendedores || 5,
          moduloGps: moduloGps ?? false,
          moduloMp: moduloMp ?? false,
          moduloFirma: moduloFirma ?? false,
          moduloEmail: moduloEmail ?? false,
          contactoNombre: contactoNombre || null,
          contactoTelefono: contactoTelefono || null,
          contactoEmail: contactoEmail || null,
          notas: notas || null,
          planPrecio: planPrecio || 0,
          planMoneda: planMoneda || 'USD',
          planPeriodicidad: planPeriodicidad || 'mensual',
        },
      });

      // 2. Crear TenantConfig con defaults
      await tx.tenantConfig.create({ data: { tenantId: tenant.id } });

      // 3. Crear User admin
      const passwordHash = await bcrypt.hash(adminPassword, 10);
      const adminUser = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: adminEmail,
          passwordHash,
          nombre: adminNombre,
          rol: 'admin',
        },
        select: { id: true, email: true, nombre: true, rol: true },
      });

      // 4. Condiciones de venta default
      await tx.condicionVenta.createMany({
        data: [
          { tenantId: tenant.id, codigo: 'CONTADO', nombre: 'Contado', diasPlazo: 0 },
          { tenantId: tenant.id, codigo: 'CTA_CTE_30', nombre: 'Cuenta Corriente 30 días', diasPlazo: 30 },
        ],
      });

      // 5. Denominaciones default
      const denoms = [10000, 5000, 2000, 1000, 500, 200, 100, 50, 20, 10];
      await tx.denominacion.createMany({
        data: denoms.map((valor) => ({
          tenantId: tenant.id,
          tipo: valor >= 100 ? 'billete' : 'moneda',
          valor,
        })),
      });

      // 6. Política default
      await tx.politicaComercial.create({
        data: {
          tenantId: tenant.id,
          nombre: 'Descuento máximo sin aprobación',
          evento: 'pedido.descuento',
          condiciones: { maxDescuento: 15 },
          accion: 'bloquear',
          mensaje: 'El descuento supera el máximo permitido. Requiere aprobación del supervisor.',
          prioridad: 10,
        },
      });

      return { tenant, adminUser };
    });

    successResponse(res, {
      tenant: result.tenant,
      adminUser: result.adminUser,
      loginUrl: `/api/auth/login (tenantCodigo: "${codigo}")`,
    }, 201);
  } catch (err) {
    next(err);
  }
});

// ─── PUT /api/super/tenants/:id ──────────────────────────

router.put('/tenants/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;

    const existing = await prisma.tenant.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Empresa');

    const allowedFields = [
      'razonSocial', 'cuit', 'email', 'plan', 'maxVendedores', 'estado',
      'moduloGps', 'moduloMp', 'moduloFirma', 'moduloEmail',
      'contactoNombre', 'contactoTelefono', 'contactoEmail', 'notas',
      'planPrecio', 'planMoneda', 'planPeriodicidad', 'proximoVencimiento', 'diasMora',
      'logo', 'colorPrimario', 'colorSecundario', 'nombreApp',
    ];

    const data: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        data[field] = req.body[field];
      }
    }
    // Convertir fecha si viene como string
    if (data.proximoVencimiento && typeof data.proximoVencimiento === 'string') {
      data.proximoVencimiento = new Date(data.proximoVencimiento as string);
    }

    const updated = await prisma.tenant.update({ where: { id }, data });
    successResponse(res, updated);
  } catch (err) {
    next(err);
  }
});

// ─── PUT /api/super/tenants/:id/suspend ──────────────────

router.put('/tenants/:id/suspend', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const tenant = await prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundError('Empresa');

    const updated = await prisma.tenant.update({
      where: { id },
      data: { estado: 'suspendido' },
    });

    successResponse(res, { id: updated.id, estado: updated.estado, mensaje: `Empresa "${updated.razonSocial}" suspendida` });
  } catch (err) {
    next(err);
  }
});

// ─── PUT /api/super/tenants/:id/activate ─────────────────

router.put('/tenants/:id/activate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const tenant = await prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundError('Empresa');

    const updated = await prisma.tenant.update({
      where: { id },
      data: { estado: 'activo', diasMora: 0 },
    });

    successResponse(res, { id: updated.id, estado: updated.estado, mensaje: `Empresa "${updated.razonSocial}" reactivada` });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/super/tenants/:id ───────────────────────

router.delete('/tenants/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const tenant = await prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundError('Empresa');

    await prisma.tenant.update({
      where: { id },
      data: { estado: 'cancelado' },
    });

    successResponse(res, { mensaje: `Empresa "${tenant.razonSocial}" marcada como cancelada (datos no eliminados)` });
  } catch (err) {
    next(err);
  }
});

// ══════════════════════════════════════════════════════════
// USUARIOS DE UNA EMPRESA
// ══════════════════════════════════════════════════════════

router.get('/tenants/:id/users', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.params.id as string;
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundError('Empresa');

    const users = await prisma.user.findMany({
      where: { tenantId },
      select: { id: true, email: true, nombre: true, rol: true, activo: true, lastLogin: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    successResponse(res, users);
  } catch (err) {
    next(err);
  }
});

router.post('/tenants/:id/users', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.params.id as string;
    const { email, password, nombre, rol } = req.body;

    if (!email || !password || !nombre || !rol) {
      throw new ValidationError('email, password, nombre y rol son obligatorios');
    }

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundError('Empresa');

    // Verificar duplicado
    const existing = await prisma.user.findUnique({
      where: { tenantId_email: { tenantId, email } },
    });
    if (existing) throw new ValidationError('Ya existe un usuario con ese email en esta empresa');

    // Verificar límite de vendedores
    if (rol === 'vendedor') {
      const count = await prisma.user.count({ where: { tenantId, rol: 'vendedor', activo: true } });
      if (count >= tenant.maxVendedores) {
        throw new ValidationError(`Límite de vendedores alcanzado (${tenant.maxVendedores})`);
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { tenantId, email, passwordHash, nombre, rol },
      select: { id: true, email: true, nombre: true, rol: true, activo: true, createdAt: true },
    });

    successResponse(res, user, 201);
  } catch (err) {
    next(err);
  }
});

// ══════════════════════════════════════════════════════════
// ESTADÍSTICAS DE UNA EMPRESA
// ══════════════════════════════════════════════════════════

router.get('/tenants/:id/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.params.id as string;
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundError('Empresa');

    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);

    const [
      usuarios,
      productos,
      clientes,
      pedidosMes,
      montoMes,
      cobranzasMes,
      montoCobranzasMes,
      syncLogs,
    ] = await Promise.all([
      prisma.user.count({ where: { tenantId } }),
      prisma.producto.count({ where: { tenantId } }),
      prisma.cliente.count({ where: { tenantId } }),
      prisma.pedido.count({ where: { tenantId, createdAt: { gte: inicioMes } } }),
      prisma.pedido.aggregate({ where: { tenantId, createdAt: { gte: inicioMes } }, _sum: { total: true } }),
      prisma.cobranza.count({ where: { tenantId, createdAt: { gte: inicioMes } } }),
      prisma.cobranza.aggregate({ where: { tenantId, createdAt: { gte: inicioMes } }, _sum: { total: true } }),
      prisma.syncLog.findMany({
        where: { tenantId },
        orderBy: { startedAt: 'desc' },
        take: 10,
        select: { id: true, direction: true, entityType: true, recordCount: true, status: true, startedAt: true },
      }),
    ]);

    successResponse(res, {
      usuarios,
      productos,
      clientes,
      pedidosMes,
      montoVendidoMes: montoMes._sum.total || 0,
      cobranzasMes,
      montoCobranzasMes: montoCobranzasMes._sum.total || 0,
      ultimosSyncLogs: syncLogs,
    });
  } catch (err) {
    next(err);
  }
});

// ══════════════════════════════════════════════════════════
// IMPERSONATE
// ══════════════════════════════════════════════════════════

router.post('/tenants/:id/impersonate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.params.id as string;
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundError('Empresa');

    // Buscar el primer admin de la empresa
    const admin = await prisma.user.findFirst({
      where: { tenantId, rol: 'admin', activo: true },
    });
    if (!admin) throw new NotFoundError('No se encontró un admin activo en esta empresa');

    const payload: JwtPayload & { impersonated: boolean; impersonatedBy: string } = {
      id: admin.id,
      tenantId: tenant.id,
      email: admin.email,
      rol: admin.rol,
      tenantCodigo: tenant.codigo,
      impersonated: true,
      impersonatedBy: req.superAdmin!.email,
    };

    const token = jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: '4h',
    } as jwt.SignOptions);

    successResponse(res, {
      token,
      tenant: { id: tenant.id, codigo: tenant.codigo, razonSocial: tenant.razonSocial },
      user: { id: admin.id, email: admin.email, nombre: admin.nombre },
      expiraEn: '4 horas',
    });
  } catch (err) {
    next(err);
  }
});

// ══════════════════════════════════════════════════════════
// BILLING
// ══════════════════════════════════════════════════════════

router.get('/billing', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const tenants = await prisma.tenant.findMany({
      where: { estado: { not: 'cancelado' } },
      select: {
        id: true,
        codigo: true,
        razonSocial: true,
        plan: true,
        planPrecio: true,
        planMoneda: true,
        planPeriodicidad: true,
        proximoVencimiento: true,
        diasMora: true,
        estado: true,
        contactoNombre: true,
        contactoEmail: true,
      },
      orderBy: { diasMora: 'desc' },
    });

    const totalRecaudacionMensual = tenants.reduce((acc, t) => {
      if (t.estado !== 'activo') return acc;
      if (t.planPeriodicidad === 'anual') return acc + t.planPrecio / 12;
      return acc + t.planPrecio;
    }, 0);

    const morosos = tenants.filter((t) => t.diasMora > 0);
    const vencidos = tenants.filter(
      (t) => t.proximoVencimiento && t.proximoVencimiento < new Date(),
    );

    successResponse(res, {
      empresas: tenants,
      totalRecaudacionMensualEstimada: Math.round(totalRecaudacionMensual * 100) / 100,
      empresasMorosas: morosos.length,
      empresasConPlanVencido: vencidos.length,
    });
  } catch (err) {
    next(err);
  }
});

// ══════════════════════════════════════════════════════════
// BACKUP
// ══════════════════════════════════════════════════════════

// ─── GET /api/super/backup/tenants ─────────────────────

router.get('/backup/tenants', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const tenants = await prisma.tenant.findMany({
      select: {
        id: true,
        codigo: true,
        razonSocial: true,
        plan: true,
        estado: true,
        ultimaActividad: true,
      },
      orderBy: { razonSocial: 'asc' },
    });

    const backupDir = getBackupDir();
    const result = tenants.map((t) => {
      let ultimoBackup: { fecha: string; tamaño: number; fileName: string } | null = null;

      if (fs.existsSync(backupDir)) {
        const files = fs.readdirSync(backupDir)
          .filter((f) => f.startsWith(`backup_${t.codigo}_`) && f.endsWith('.zip'))
          .sort()
          .reverse();

        if (files.length > 0) {
          const stat = fs.statSync(path.join(backupDir, files[0]));
          ultimoBackup = {
            fecha: stat.mtime.toISOString(),
            tamaño: Math.round(stat.size / 1024),
            fileName: files[0],
          };
        }
      }

      return { ...t, ultimoBackup };
    });

    successResponse(res, result);
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/super/backup/tenants/:id/generate ──────

router.post('/backup/tenants/:id/generate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.params.id as string;
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundError('Empresa');

    const { filePath, fileName } = await generateTenantBackup(tenantId);

    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Type', 'application/zip');

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/super/backup/tenants/:id/download/:fileName

router.get('/backup/tenants/:id/download/:fileName', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.params.id as string;
    const fileName = req.params.fileName as string;

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundError('Empresa');

    // Validate filename to prevent path traversal
    if (!fileName.startsWith(`backup_${tenant.codigo}_`) || !fileName.endsWith('.zip') || fileName.includes('..')) {
      throw new ValidationError('Nombre de archivo inválido');
    }

    const filePath = path.join(getBackupDir(), fileName);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundError('Archivo de backup');
    }

    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Type', 'application/zip');

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/super/backup/tenants/:id/restore ──────

const restoreUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/zip' || file.originalname.toLowerCase().endsWith('.zip')) {
      cb(null, true);
    } else {
      cb(new ValidationError('Solo se permiten archivos ZIP') as unknown as Error);
    }
  },
});

router.post('/backup/tenants/:id/restore', restoreUpload.single('backup'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.params.id as string;
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundError('Empresa');

    if (!req.file) throw new ValidationError('Se requiere un archivo ZIP de backup');

    const result = await restoreTenantBackup(req.file.buffer, tenantId);

    successResponse(res, result);
  } catch (err) {
    next(err);
  }
});

// ══════════════════════════════════════════════════════════
// ACTIVIDAD GLOBAL
// ══════════════════════════════════════════════════════════

router.get('/activity', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const [pedidosHoy, cobranzasHoy, jornadasActivas, loginsHoy] = await Promise.all([
      prisma.pedido.count({ where: { createdAt: { gte: hoy } } }),
      prisma.cobranza.count({ where: { createdAt: { gte: hoy } } }),
      prisma.jornada.count({ where: { estado: 'activa' } }),
      prisma.user.count({ where: { lastLogin: { gte: hoy } } }),
    ]);

    // Últimas 50 actividades mezclando pedidos, cobranzas y jornadas
    const [pedidos, cobranzas, jornadas] = await Promise.all([
      prisma.pedido.findMany({
        take: 20,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, total: true, createdAt: true, tenantId: true,
          tenant: { select: { codigo: true, razonSocial: true } },
          vendedor: { select: { nombre: true } },
        },
      }),
      prisma.cobranza.findMany({
        take: 20,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, total: true, createdAt: true, tenantId: true,
          tenant: { select: { codigo: true, razonSocial: true } },
          vendedor: { select: { nombre: true } },
        },
      }),
      prisma.jornada.findMany({
        take: 20,
        orderBy: { fecha: 'desc' },
        select: {
          id: true, estado: true, fecha: true, tenantId: true,
          vendedor: { select: { nombre: true, tenant: { select: { codigo: true, razonSocial: true } } } },
        },
      }),
    ]);

    const actividades = [
      ...pedidos.map((p) => ({
        tipo: 'pedido' as const,
        tenantCodigo: p.tenant.codigo,
        tenantNombre: p.tenant.razonSocial,
        usuario: p.vendedor.nombre,
        detalle: `Pedido por $${p.total}`,
        monto: p.total,
        fecha: p.createdAt,
      })),
      ...cobranzas.map((c) => ({
        tipo: 'cobranza' as const,
        tenantCodigo: c.tenant.codigo,
        tenantNombre: c.tenant.razonSocial,
        usuario: c.vendedor.nombre,
        detalle: `Cobranza por $${c.total}`,
        monto: c.total,
        fecha: c.createdAt,
      })),
      ...jornadas.map((j) => ({
        tipo: 'jornada' as const,
        tenantCodigo: j.vendedor.tenant.codigo,
        tenantNombre: j.vendedor.tenant.razonSocial,
        usuario: j.vendedor.nombre,
        detalle: `Jornada ${j.estado}`,
        monto: null,
        fecha: j.fecha,
      })),
    ]
      .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
      .slice(0, 50);

    successResponse(res, {
      stats: { pedidosHoy, cobranzasHoy, jornadasActivas, loginsHoy },
      actividades,
    });
  } catch (err) {
    next(err);
  }
});

// ══════════════════════════════════════════════════════════
// SYNC STATUS GLOBAL
// ══════════════════════════════════════════════════════════

router.get('/sync', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [syncsHoy, erroresHoy] = await Promise.all([
      prisma.syncLog.count({ where: { startedAt: { gte: hoy } } }),
      prisma.syncLog.count({ where: { startedAt: { gte: hoy }, status: 'error' } }),
    ]);

    // Todos los tenants con su último sync y conteos
    const tenants = await prisma.tenant.findMany({
      select: {
        id: true,
        codigo: true,
        razonSocial: true,
        erpTipo: true,
        estado: true,
      },
      orderBy: { razonSocial: 'asc' },
    });

    const tenantSyncs = await Promise.all(
      tenants.map(async (t) => {
        const [ultimoSync, syncsHoyTenant, erroresHoyTenant] = await Promise.all([
          prisma.syncLog.findFirst({
            where: { tenantId: t.id },
            orderBy: { startedAt: 'desc' },
            select: { startedAt: true, status: true, entityType: true },
          }),
          prisma.syncLog.count({ where: { tenantId: t.id, startedAt: { gte: hoy } } }),
          prisma.syncLog.count({ where: { tenantId: t.id, startedAt: { gte: hoy }, status: 'error' } }),
        ]);

        const sinSync24h = !ultimoSync || ultimoSync.startedAt < hace24h;

        return {
          ...t,
          ultimoSync: ultimoSync ? {
            fecha: ultimoSync.startedAt,
            status: ultimoSync.status,
            entidad: ultimoSync.entityType,
          } : null,
          syncsHoy: syncsHoyTenant,
          erroresHoy: erroresHoyTenant,
          sinSync24h,
        };
      }),
    );

    const sinSync24hCount = tenantSyncs.filter((t) => t.sinSync24h && t.erpTipo !== 'standalone').length;

    successResponse(res, {
      stats: { syncsHoy, erroresHoy, sinSync24h: sinSync24hCount },
      tenants: tenantSyncs,
    });
  } catch (err) {
    next(err);
  }
});

// ══════════════════════════════════════════════════════════
// STORAGE
// ══════════════════════════════════════════════════════════

router.get('/storage', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [totalStorage, totalProductos, totalClientes, totalPedidos] = await Promise.all([
      prisma.tenant.aggregate({ _sum: { almacenamientoMb: true } }),
      prisma.producto.count(),
      prisma.cliente.count(),
      prisma.pedido.count(),
    ]);

    const tenants = await prisma.tenant.findMany({
      select: {
        id: true,
        codigo: true,
        razonSocial: true,
        cantidadProductos: true,
        cantidadClientes: true,
        cantidadPedidosMes: true,
        almacenamientoMb: true,
        estado: true,
      },
      orderBy: { almacenamientoMb: 'desc' },
    });

    successResponse(res, {
      stats: {
        totalAlmacenamientoMb: totalStorage._sum.almacenamientoMb || 0,
        totalProductos,
        totalClientes,
        totalPedidos,
      },
      tenants,
    });
  } catch (err) {
    next(err);
  }
});

// ══════════════════════════════════════════════════════════
// MI CUENTA (Super Admin)
// ══════════════════════════════════════════════════════════

router.put('/me', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.superAdmin!.superAdminId;
    const { nombre, email, currentPassword, newPassword } = req.body;

    const admin = await prisma.superAdmin.findUnique({ where: { id } });
    if (!admin) throw new NotFoundError('Super Admin');

    const data: Record<string, unknown> = {};
    if (nombre !== undefined) data.nombre = nombre;
    if (email !== undefined) {
      const dup = await prisma.superAdmin.findUnique({ where: { email } });
      if (dup && dup.id !== id) throw new ValidationError('Ya existe otro super admin con ese email');
      data.email = email;
    }

    if (newPassword) {
      if (!currentPassword) throw new ValidationError('Se requiere la contraseña actual');
      const valid = await bcrypt.compare(currentPassword, admin.passwordHash);
      if (!valid) throw new ValidationError('La contraseña actual es incorrecta');
      if (newPassword.length < 6) throw new ValidationError('La nueva contraseña debe tener al menos 6 caracteres');
      data.passwordHash = await bcrypt.hash(newPassword, 10);
    }

    const updated = await prisma.superAdmin.update({
      where: { id },
      data,
      select: { id: true, email: true, nombre: true, createdAt: true, lastLogin: true },
    });

    successResponse(res, updated);
  } catch (err) {
    next(err);
  }
});

// ══════════════════════════════════════════════════════════
// LOGS DEL SISTEMA
// ══════════════════════════════════════════════════════════

router.get('/logs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const tipo = (req.query.tipo as string) || 'all';

    const offset = (page - 1) * limit;

    // Mapa tenantId → codigo para lookup
    const tenantsList = await prisma.tenant.findMany({ select: { id: true, codigo: true } });
    const tenantMap = new Map(tenantsList.map((t) => [t.id, t.codigo]));

    type LogItem = {
      id: string;
      tipo: string;
      tenantId: string;
      tenantCodigo: string;
      entidad: string;
      registros: number;
      estado: string;
      fecha: Date;
    };

    const items: LogItem[] = [];
    let totalCount = 0;

    // SyncLogs
    if (tipo === 'all' || tipo === 'sync') {
      const [syncLogs, syncCount] = await Promise.all([
        prisma.syncLog.findMany({
          take: limit,
          skip: tipo !== 'all' ? offset : 0,
          orderBy: { startedAt: 'desc' },
        }),
        prisma.syncLog.count(),
      ]);
      items.push(
        ...syncLogs.map((s) => ({
          id: String(s.id),
          tipo: 'sync',
          tenantId: s.tenantId,
          tenantCodigo: tenantMap.get(s.tenantId) || s.tenantId,
          entidad: `${s.direction}:${s.entityType}`,
          registros: s.recordCount,
          estado: s.status,
          fecha: s.startedAt,
        })),
      );
      totalCount += syncCount;
    }

    // ImportLogs
    if (tipo === 'all' || tipo === 'import') {
      const [importLogs, importCount] = await Promise.all([
        prisma.importLog.findMany({
          take: limit,
          skip: tipo !== 'all' ? offset : 0,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.importLog.count(),
      ]);
      items.push(
        ...importLogs.map((i) => ({
          id: i.id,
          tipo: 'import',
          tenantId: i.tenantId,
          tenantCodigo: tenantMap.get(i.tenantId) || i.tenantId,
          entidad: i.entityType,
          registros: i.imported + i.updated,
          estado: i.errors > 0 ? 'error' : 'ok',
          fecha: i.createdAt,
        })),
      );
      totalCount += importCount;
    }

    // IntercambioLogs
    if (tipo === 'all' || tipo === 'intercambio') {
      const [intercambioLogs, intercambioCount] = await Promise.all([
        prisma.intercambioLog.findMany({
          take: limit,
          skip: tipo !== 'all' ? offset : 0,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.intercambioLog.count(),
      ]);
      items.push(
        ...intercambioLogs.map((l) => ({
          id: l.id,
          tipo: 'intercambio',
          tenantId: l.tenantId,
          tenantCodigo: tenantMap.get(l.tenantId) || l.tenantId,
          entidad: l.direccion,
          registros: Array.isArray(l.archivos) ? (l.archivos as Array<{ registros?: number }>).reduce((acc, a) => acc + (a.registros || 0), 0) : 0,
          estado: l.estado,
          fecha: l.createdAt,
        })),
      );
      totalCount += intercambioCount;
    }

    // Ordenar por fecha y paginar si es "all"
    items.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

    const paginatedItems = tipo === 'all' ? items.slice(offset, offset + limit) : items;
    const totalPages = Math.ceil(totalCount / limit);

    successResponse(res, {
      items: paginatedItems,
      pagination: { total: totalCount, page, limit, totalPages },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
