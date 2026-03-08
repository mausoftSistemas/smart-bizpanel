import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { logger } from './logger';

/**
 * Auto-seed: si la DB está vacía (0 tenants), crea datos demo.
 * Idempotente — usa upsert y count checks para no duplicar.
 * Se ejecuta automáticamente al arrancar la API.
 */
export async function autoSeed(prisma: PrismaClient): Promise<void> {
  const tenantCount = await prisma.tenant.count();
  if (tenantCount > 0) {
    logger.info('Auto-seed: DB already has data, skipping');
    return;
  }

  logger.info('Auto-seed: empty DB detected, seeding demo data...');

  // Tenant demo
  const tenant = await prisma.tenant.create({
    data: {
      codigo: 'demo',
      razonSocial: 'Empresa Demo S.A.',
      cuit: '30-12345678-9',
      email: 'admin@demo.com',
      plan: 'premium',
      maxVendedores: 10,
      moduloGps: true,
      moduloFirma: true,
      moduloEmail: true,
    },
  });

  await prisma.tenantConfig.create({ data: { tenantId: tenant.id } });

  // Usuarios
  const adminHash = await bcrypt.hash('admin123', 10);
  await prisma.user.create({
    data: { tenantId: tenant.id, email: 'admin@demo.com', passwordHash: adminHash, nombre: 'Administrador', rol: 'admin' },
  });

  const supervisorHash = await bcrypt.hash('supervisor123', 10);
  await prisma.user.create({
    data: { tenantId: tenant.id, email: 'supervisor@demo.com', passwordHash: supervisorHash, nombre: 'María Supervisora', rol: 'supervisor' },
  });

  const vendedorHash = await bcrypt.hash('vendedor123', 10);
  const vendedor = await prisma.user.create({
    data: { tenantId: tenant.id, email: 'vendedor@demo.com', passwordHash: vendedorHash, nombre: 'Juan Vendedor', rol: 'vendedor' },
  });

  // Productos
  const productosData = [
    { codigo: 'PROD001', nombre: 'Coca-Cola 500ml', precioLista: 1500, categoria: 'Bebidas', stockUnidad: 200 },
    { codigo: 'PROD002', nombre: 'Pepsi 500ml', precioLista: 1400, categoria: 'Bebidas', stockUnidad: 150 },
    { codigo: 'PROD003', nombre: 'Galletitas Oreo', precioLista: 2200, categoria: 'Galletitas', stockUnidad: 80 },
    { codigo: 'PROD004', nombre: 'Fideos Matarazzo 500g', precioLista: 1800, categoria: 'Almacén', stockUnidad: 120 },
    { codigo: 'PROD005', nombre: 'Aceite Cocinero 1L', precioLista: 3500, categoria: 'Almacén', stockUnidad: 60 },
  ];
  for (const p of productosData) {
    await prisma.producto.create({ data: { tenantId: tenant.id, ...p } });
  }

  // Clientes
  const clientesData = [
    { codigo: 'CLI001', nombre: 'Almacén Don José', direccion: 'Av. Rivadavia 1234', ciudad: 'CABA', cuit: '20-33445566-7', condicionIva: 'Responsable Inscripto' },
    { codigo: 'CLI002', nombre: 'Kiosco La Esquina', direccion: 'Córdoba 567', ciudad: 'Rosario', cuit: '27-22334455-1', condicionIva: 'Monotributista' },
    { codigo: 'CLI003', nombre: 'Super Barrio', direccion: 'San Martín 890', ciudad: 'Mendoza', cuit: '30-44556677-8', condicionIva: 'Responsable Inscripto' },
  ];
  for (const c of clientesData) {
    await prisma.cliente.create({ data: { tenantId: tenant.id, vendedorId: vendedor.id, ...c } });
  }

  const productos = await prisma.producto.findMany({ where: { tenantId: tenant.id } });
  const clientes = await prisma.cliente.findMany({ where: { tenantId: tenant.id } });

  // Condiciones de venta
  for (const cv of [
    { codigo: 'CONTADO', nombre: 'Contado', diasPlazo: 0 },
    { codigo: 'CTA_CTE_30', nombre: 'Cuenta Corriente 30 días', diasPlazo: 30 },
    { codigo: 'CTA_CTE_60', nombre: 'Cuenta Corriente 60 días', diasPlazo: 60 },
  ]) {
    await prisma.condicionVenta.create({ data: { tenantId: tenant.id, ...cv } });
  }

  // Motivos de no compra
  for (const m of [
    { codigo: 'SIN_DINERO', descripcion: 'Sin dinero disponible' },
    { codigo: 'STOCK_OK', descripcion: 'Tiene suficiente stock' },
    { codigo: 'CERRADO', descripcion: 'Local cerrado' },
    { codigo: 'COMPETENCIA', descripcion: 'Compró a la competencia' },
    { codigo: 'OTRO', descripcion: 'Otro motivo' },
  ]) {
    await prisma.motivoNoCompra.create({ data: { tenantId: tenant.id, ...m } });
  }

  // Ruta
  await prisma.ruta.create({
    data: {
      tenantId: tenant.id, nombre: 'Ruta Lunes - Centro', diaSemana: 1, vendedorId: vendedor.id,
      clientes: { create: clientes.map((c, i) => ({ clienteId: c.id, orden: i + 1 })) },
    },
  });

  // Precio especial
  if (productos.length > 0 && clientes.length > 0) {
    await prisma.precioCliente.create({
      data: { tenantId: tenant.id, clienteId: clientes[0].id, productoId: productos[0].id, precio: 1350, descuento: 10 },
    });
  }

  // Objetivos
  const inicioMes = new Date();
  inicioMes.setDate(1);
  inicioMes.setHours(0, 0, 0, 0);
  const finMes = new Date(inicioMes);
  finMes.setMonth(finMes.getMonth() + 1);
  finMes.setDate(0);

  await prisma.objetivo.create({
    data: { tenantId: tenant.id, tipo: 'general', nombre: 'Venta mensual', metrica: 'monto_venta', valorObjetivo: 500000, periodoInicio: inicioMes, periodoFin: finMes },
  });
  await prisma.objetivo.create({
    data: { tenantId: tenant.id, vendedorId: vendedor.id, tipo: 'focal', nombre: 'Push Coca-Cola', metrica: 'cantidad_pedidos', valorObjetivo: 50, productoId: productos[0]?.id, periodoInicio: inicioMes, periodoFin: finMes },
  });

  // Mensaje, billetera, denominaciones, política
  await prisma.mensaje.create({
    data: { tenantId: tenant.id, titulo: 'Bienvenido a BizVentas', cuerpo: 'El sistema está listo para operar. ¡Buenas ventas!', tipo: 'info' },
  });

  await prisma.billetera.create({
    data: { tenantId: tenant.id, nombre: 'Mercado Pago', alias: 'empresa.demo.mp' },
  });

  for (const valor of [10000, 5000, 2000, 1000, 500, 200, 100, 50, 20, 10]) {
    await prisma.denominacion.create({
      data: { tenantId: tenant.id, tipo: valor >= 100 ? 'billete' : 'moneda', valor },
    });
  }

  await prisma.politicaComercial.create({
    data: {
      tenantId: tenant.id, nombre: 'Descuento máximo sin aprobación', evento: 'pedido.descuento',
      condiciones: { maxDescuento: 15 }, accion: 'bloquear',
      mensaje: 'El descuento supera el máximo permitido. Requiere aprobación del supervisor.', prioridad: 10,
    },
  });

  logger.info('Auto-seed: completed! Users: admin@demo.com/admin123, supervisor@demo.com/supervisor123, vendedor@demo.com/vendedor123');
}
