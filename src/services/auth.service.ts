import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { UnauthorizedError, NotFoundError, ValidationError } from '../utils/errors';
import { JwtPayload } from '../middleware/auth.middleware';

const prisma = new PrismaClient();

export class AuthService {
  async login(tenantCodigo: string, email: string, password: string) {
    // 1. Buscar tenant por código
    const tenant = await prisma.tenant.findUnique({
      where: { codigo: tenantCodigo },
      include: { config: true },
    });
    if (!tenant) throw new NotFoundError('Empresa');
    if (tenant.estado !== 'activo') throw new UnauthorizedError('Empresa inactiva');

    // 2. Buscar user por email dentro del tenant
    const user = await prisma.user.findUnique({
      where: { tenantId_email: { tenantId: tenant.id, email } },
    });
    if (!user) throw new NotFoundError('Usuario');
    if (!user.activo) throw new UnauthorizedError('Usuario desactivado');

    // 3. Comparar password con bcrypt
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedError('Credenciales inválidas');

    // 4. Generar JWT
    const payload: JwtPayload = {
      id: user.id,
      tenantId: tenant.id,
      email: user.email,
      rol: user.rol,
      tenantCodigo: tenant.codigo,
    };

    const token = jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN,
    } as jwt.SignOptions);

    // 5. Actualizar lastLogin
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    // 6. Retornar
    return {
      token,
      user: {
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        rol: user.rol,
      },
      tenant: {
        id: tenant.id,
        codigo: tenant.codigo,
        razonSocial: tenant.razonSocial,
        nombreApp: tenant.nombreApp,
        colorPrimario: tenant.colorPrimario,
        colorSecundario: tenant.colorSecundario,
        logo: tenant.logo,
        moduloGps: tenant.moduloGps,
        moduloMp: tenant.moduloMp,
        moduloFirma: tenant.moduloFirma,
        moduloEmail: tenant.moduloEmail,
        config: tenant.config,
      },
    };
  }

  async register(tenantId: string, email: string, password: string, nombre: string, rol: string) {
    // Verificar que no exista
    const existing = await prisma.user.findUnique({
      where: { tenantId_email: { tenantId, email } },
    });
    if (existing) throw new ValidationError('Ya existe un usuario con ese email en esta empresa');

    // Verificar límite de vendedores
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    if (rol === 'vendedor') {
      const count = await prisma.user.count({ where: { tenantId, rol: 'vendedor', activo: true } });
      if (count >= tenant.maxVendedores) {
        throw new ValidationError(`Límite de vendedores alcanzado (${tenant.maxVendedores})`);
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: { tenantId, email, passwordHash, nombre, rol },
      select: { id: true, nombre: true, email: true, rol: true, activo: true, createdAt: true },
    });

    return user;
  }

  async me(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        nombre: true,
        email: true,
        rol: true,
        tenant: {
          select: {
            id: true,
            codigo: true,
            razonSocial: true,
            nombreApp: true,
            colorPrimario: true,
            colorSecundario: true,
            logo: true,
            moduloGps: true,
            moduloMp: true,
            moduloFirma: true,
            moduloEmail: true,
            config: true,
          },
        },
      },
    });
    if (!user) throw new NotFoundError('Usuario');
    return user;
  }

  async refresh(currentUser: JwtPayload) {
    // Verificar que el user siga activo
    const user = await prisma.user.findUnique({
      where: { id: currentUser.id },
      include: { tenant: { select: { estado: true, codigo: true } } },
    });
    if (!user || !user.activo) throw new UnauthorizedError('Usuario desactivado');
    if (user.tenant.estado !== 'activo') throw new UnauthorizedError('Empresa inactiva');

    const payload: JwtPayload = {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      rol: user.rol,
      tenantCodigo: user.tenant.codigo,
    };

    const token = jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN,
    } as jwt.SignOptions);

    return { token };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('Usuario');

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw new ValidationError('Contraseña actual incorrecta');

    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: userId }, data: { passwordHash: hashed } });
  }
}
