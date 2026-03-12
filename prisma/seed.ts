import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export async function seedDatabase(db: PrismaClient) {
  console.log('Seeding database...');

  // ═══ SUPER ADMIN ═══
  const superAdminHash = await bcrypt.hash('superadmin123', 10);
  await db.superAdmin.upsert({
    where: { email: 'superadmin@bizventas.com' },
    update: {},
    create: {
      email: 'superadmin@bizventas.com',
      passwordHash: superAdminHash,
      nombre: 'Super Administrador',
    },
  });

  // Crear tenant demo
  const tenant = await db.tenant.upsert({
    where: { codigo: 'demo' },
    update: {},
    create: {
      codigo: 'demo',
      razonSocial: 'Empresa Demo S.A.',
      cuit: '30-12345678-9',
      email: 'admin@demo.com',
      plan: 'premium',
      maxVendedores: 10,
      moduloGps: true,
      moduloMp: false,
      moduloFirma: true,
      moduloEmail: true,
    },
  });

  // Crear config del tenant
  await db.tenantConfig.upsert({
    where: { tenantId: tenant.id },
    update: {},
    create: { tenantId: tenant.id },
  });

  // Crear usuario admin
  const adminHash = await bcrypt.hash('admin123', 10);
  await db.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'admin@demo.com' } },
    update: {},
    create: { tenantId: tenant.id, email: 'admin@demo.com', passwordHash: adminHash, nombre: 'Administrador', rol: 'admin' },
  });

  // Crear supervisor
  const supervisorHash = await bcrypt.hash('supervisor123', 10);
  await db.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'supervisor@demo.com' } },
    update: {},
    create: { tenantId: tenant.id, email: 'supervisor@demo.com', passwordHash: supervisorHash, nombre: 'María Supervisora', rol: 'supervisor' },
  });

  // Crear vendedor
  const vendedorHash = await bcrypt.hash('vendedor123', 10);
  await db.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'vendedor@demo.com' } },
    update: {},
    create: { tenantId: tenant.id, email: 'vendedor@demo.com', passwordHash: vendedorHash, nombre: 'Juan Vendedor', rol: 'vendedor' },
  });

  // Crear productos
  const productosData = [
    { codigo: 'PROD001', nombre: 'Coca-Cola 500ml', precioLista: 1500, categoria: 'Bebidas', stockUnidad: 200 },
    { codigo: 'PROD002', nombre: 'Pepsi 500ml', precioLista: 1400, categoria: 'Bebidas', stockUnidad: 150 },
    { codigo: 'PROD003', nombre: 'Galletitas Oreo', precioLista: 2200, categoria: 'Galletitas', stockUnidad: 80 },
    { codigo: 'PROD004', nombre: 'Fideos Matarazzo 500g', precioLista: 1800, categoria: 'Almacén', stockUnidad: 120 },
    { codigo: 'PROD005', nombre: 'Aceite Cocinero 1L', precioLista: 3500, categoria: 'Almacén', stockUnidad: 60 },
  ];
  for (const p of productosData) {
    await db.producto.upsert({
      where: { tenantId_codigo: { tenantId: tenant.id, codigo: p.codigo } },
      update: {},
      create: { tenantId: tenant.id, ...p },
    });
  }

  // Crear clientes
  const clientesData = [
    { codigo: 'CLI001', nombre: 'Almacén Don José', direccion: 'Av. Rivadavia 1234', ciudad: 'CABA', cuit: '20-33445566-7', condicionIva: 'Responsable Inscripto' },
    { codigo: 'CLI002', nombre: 'Kiosco La Esquina', direccion: 'Córdoba 567', ciudad: 'Rosario', cuit: '27-22334455-1', condicionIva: 'Monotributista' },
    { codigo: 'CLI003', nombre: 'Super Barrio', direccion: 'San Martín 890', ciudad: 'Mendoza', cuit: '30-44556677-8', condicionIva: 'Responsable Inscripto' },
  ];
  for (const c of clientesData) {
    await db.cliente.upsert({
      where: { tenantId_codigo: { tenantId: tenant.id, codigo: c.codigo } },
      update: {},
      create: { tenantId: tenant.id, ...c },
    });
  }

  // Obtener IDs para relaciones
  const vendedor = await db.user.findUnique({
    where: { tenantId_email: { tenantId: tenant.id, email: 'vendedor@demo.com' } },
  });
  const productos = await db.producto.findMany({ where: { tenantId: tenant.id } });
  const clientes = await db.cliente.findMany({ where: { tenantId: tenant.id } });

  // Asignar vendedor a clientes
  for (const c of clientes) {
    await db.cliente.update({ where: { id: c.id }, data: { vendedorId: vendedor!.id } });
  }

  // Condiciones de venta
  const condiciones = [
    { codigo: 'CONTADO', nombre: 'Contado', diasPlazo: 0 },
    { codigo: 'CTA_CTE_30', nombre: 'Cuenta Corriente 30 días', diasPlazo: 30 },
    { codigo: 'CTA_CTE_60', nombre: 'Cuenta Corriente 60 días', diasPlazo: 60 },
  ];
  for (const cv of condiciones) {
    await db.condicionVenta.upsert({
      where: { tenantId_codigo: { tenantId: tenant.id, codigo: cv.codigo } },
      update: {},
      create: { tenantId: tenant.id, ...cv },
    });
  }

  // Motivos de no compra
  const motivos = [
    { codigo: 'SIN_DINERO', descripcion: 'Sin dinero disponible' },
    { codigo: 'STOCK_OK', descripcion: 'Tiene suficiente stock' },
    { codigo: 'CERRADO', descripcion: 'Local cerrado' },
    { codigo: 'COMPETENCIA', descripcion: 'Compró a la competencia' },
    { codigo: 'OTRO', descripcion: 'Otro motivo' },
  ];
  for (const m of motivos) {
    await db.motivoNoCompra.upsert({
      where: { tenantId_codigo: { tenantId: tenant.id, codigo: m.codigo } },
      update: {},
      create: { tenantId: tenant.id, ...m },
    });
  }

  // Ruta con clientes (solo crear si no existe ninguna)
  const rutaCount = await db.ruta.count({ where: { tenantId: tenant.id } });
  if (rutaCount === 0) {
    await db.ruta.create({
      data: {
        tenantId: tenant.id,
        nombre: 'Ruta Lunes - Centro',
        diaSemana: 1,
        vendedorId: vendedor!.id,
        clientes: {
          create: clientes.map((c, i) => ({ clienteId: c.id, orden: i + 1 })),
        },
      },
    });
  }

  // Precios especiales para primer cliente
  if (productos.length > 0 && clientes.length > 0) {
    await db.precioCliente.upsert({
      where: {
        tenantId_clienteId_productoId: {
          tenantId: tenant.id,
          clienteId: clientes[0].id,
          productoId: productos[0].id,
        },
      },
      update: {},
      create: {
        tenantId: tenant.id,
        clienteId: clientes[0].id,
        productoId: productos[0].id,
        precio: 1350,
        descuento: 10,
      },
    });
  }

  // Objetivos (solo crear si no existen)
  const objCount = await db.objetivo.count({ where: { tenantId: tenant.id } });
  if (objCount === 0) {
    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);
    const finMes = new Date(inicioMes);
    finMes.setMonth(finMes.getMonth() + 1);
    finMes.setDate(0);

    await db.objetivo.create({
      data: { tenantId: tenant.id, tipo: 'general', nombre: 'Venta mensual', metrica: 'monto_venta', valorObjetivo: 500000, periodoInicio: inicioMes, periodoFin: finMes },
    });
    await db.objetivo.create({
      data: { tenantId: tenant.id, vendedorId: vendedor!.id, tipo: 'focal', nombre: 'Push Coca-Cola', metrica: 'cantidad_pedidos', valorObjetivo: 50, productoId: productos[0]?.id, periodoInicio: inicioMes, periodoFin: finMes },
    });
  }

  // Mensaje de bienvenida (solo si no hay mensajes)
  const msgCount = await db.mensaje.count({ where: { tenantId: tenant.id } });
  if (msgCount === 0) {
    await db.mensaje.create({
      data: { tenantId: tenant.id, vendedorId: null, titulo: 'Bienvenido a BizVentas', cuerpo: 'El sistema está listo para operar. ¡Buenas ventas!', tipo: 'info' },
    });
  }

  // Billeteras (solo si no hay)
  const billCount = await db.billetera.count({ where: { tenantId: tenant.id } });
  if (billCount === 0) {
    await db.billetera.create({
      data: { tenantId: tenant.id, nombre: 'Mercado Pago', alias: 'empresa.demo.mp' },
    });
  }

  // Denominaciones (solo si no hay)
  const denomCount = await db.denominacion.count({ where: { tenantId: tenant.id } });
  if (denomCount === 0) {
    const denoms = [10000, 5000, 2000, 1000, 500, 200, 100, 50, 20, 10];
    for (const valor of denoms) {
      await db.denominacion.create({
        data: { tenantId: tenant.id, tipo: valor >= 100 ? 'billete' : 'moneda', valor },
      });
    }
  }

  // Política comercial (solo si no hay)
  const polCount = await db.politicaComercial.count({ where: { tenantId: tenant.id } });
  if (polCount === 0) {
    await db.politicaComercial.create({
      data: {
        tenantId: tenant.id, nombre: 'Descuento máximo sin aprobación', evento: 'pedido.descuento',
        condiciones: { maxDescuento: 15 }, accion: 'bloquear',
        mensaje: 'El descuento supera el máximo permitido. Requiere aprobación del supervisor.', prioridad: 10,
      },
    });
  }

  console.log('Seed completed!');
  console.log('  SUPER ADMIN: superadmin@bizventas.com / superadmin123');
  console.log('  admin@demo.com / admin123 (rol: admin)');
  console.log('  supervisor@demo.com / supervisor123 (rol: supervisor)');
  console.log('  vendedor@demo.com / vendedor123 (rol: vendedor)');
  console.log('  Tenant código: demo');
}

// Ejecución directa con: ts-node prisma/seed.ts
seedDatabase(prisma)
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
