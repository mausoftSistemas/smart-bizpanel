-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "razonSocial" TEXT NOT NULL,
    "cuit" TEXT,
    "email" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'basico',
    "maxVendedores" INTEGER NOT NULL DEFAULT 5,
    "estado" TEXT NOT NULL DEFAULT 'activo',
    "moduloGps" BOOLEAN NOT NULL DEFAULT false,
    "moduloMp" BOOLEAN NOT NULL DEFAULT false,
    "moduloFirma" BOOLEAN NOT NULL DEFAULT false,
    "moduloEmail" BOOLEAN NOT NULL DEFAULT false,
    "erpTipo" TEXT NOT NULL DEFAULT 'standalone',
    "erpUrl" TEXT,
    "erpCredenciales" JSONB,
    "erpMapping" JSONB,
    "logo" TEXT,
    "colorPrimario" TEXT NOT NULL DEFAULT '#1565C0',
    "colorSecundario" TEXT NOT NULL DEFAULT '#00E5FF',
    "nombreApp" TEXT NOT NULL DEFAULT 'BizVentas',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantConfig" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'ARS',
    "formatoFecha" TEXT NOT NULL DEFAULT 'dd/MM/yyyy',
    "ivaDefault" DOUBLE PRECISION NOT NULL DEFAULT 21,
    "montoMinimoPedido" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "montoMaximoPedido" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "permitePedidoSinStock" BOOLEAN NOT NULL DEFAULT true,
    "requiereFirma" BOOLEAN NOT NULL DEFAULT false,
    "permiteEfectivo" BOOLEAN NOT NULL DEFAULT true,
    "permiteCheque" BOOLEAN NOT NULL DEFAULT true,
    "permiteTransferencia" BOOLEAN NOT NULL DEFAULT true,
    "permiteBilletera" BOOLEAN NOT NULL DEFAULT true,
    "permiteMercadoPago" BOOLEAN NOT NULL DEFAULT false,
    "jornadaObligatoria" BOOLEAN NOT NULL DEFAULT true,
    "horaInicioMin" TEXT NOT NULL DEFAULT '06:00',
    "horaInicioMax" TEXT NOT NULL DEFAULT '09:00',
    "horaFinMax" TEXT NOT NULL DEFAULT '21:00',
    "requiereGeoInicio" BOOLEAN NOT NULL DEFAULT false,
    "maxDescuentoVendedor" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "maxDescuentoSupervisor" DOUBLE PRECISION NOT NULL DEFAULT 20,
    "diasLimiteDevolucion" INTEGER NOT NULL DEFAULT 30,
    "devolucionRequiereFoto" BOOLEAN NOT NULL DEFAULT true,
    "devolucionRequiereAprobacion" BOOLEAN NOT NULL DEFAULT true,
    "trackingIntervaloSeg" INTEGER NOT NULL DEFAULT 30,
    "trackingActivo" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "rol" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "lastLogin" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Producto" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "categoria" TEXT,
    "marca" TEXT,
    "precioLista" DOUBLE PRECISION NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'ARS',
    "stockBulto" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "stockUnidad" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "equivalencia" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unidadMedida" TEXT NOT NULL DEFAULT 'UN',
    "ivaPorcentaje" DOUBLE PRECISION NOT NULL DEFAULT 21,
    "pesoKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "codigoBarras" TEXT,
    "imagenUrl" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "erpId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Producto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cliente" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "direccion" TEXT,
    "ciudad" TEXT,
    "provincia" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "cuit" TEXT,
    "condicionIva" TEXT,
    "condicionVenta" TEXT,
    "listaPrecioId" TEXT,
    "saldoCuenta" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "limiteCredito" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "latitud" DOUBLE PRECISION,
    "longitud" DOUBLE PRECISION,
    "vendedorId" TEXT,
    "rutaId" TEXT,
    "canal" TEXT,
    "segmento" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "erpId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pedido" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "vendedorId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "tipoComprobante" TEXT,
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "descuentoGlobal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "observaciones" TEXT,
    "jornadaId" TEXT,
    "appLocalId" TEXT,
    "erpId" TEXT,
    "erpSynced" BOOLEAN NOT NULL DEFAULT false,
    "erpError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pedido_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PedidoItem" (
    "id" SERIAL NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "productoCodigo" TEXT NOT NULL,
    "productoNombre" TEXT NOT NULL,
    "cantidad" DOUBLE PRECISION NOT NULL,
    "unidadTipo" TEXT NOT NULL DEFAULT 'unidad',
    "precioUnitario" DOUBLE PRECISION NOT NULL,
    "descuentoPorcentaje" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "subtotal" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "PedidoItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cobranza" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "vendedorId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'confirmado',
    "appLocalId" TEXT,
    "erpId" TEXT,
    "erpSynced" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cobranza_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CobranzaMedio" (
    "id" SERIAL NOT NULL,
    "cobranzaId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'ARS',
    "datos" JSONB NOT NULL,

    CONSTRAINT "CobranzaMedio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CuentaCorriente" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "tipoMovimiento" TEXT NOT NULL,
    "numero" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL,
    "fechaVencimiento" TIMESTAMP(3),
    "debe" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "haber" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "saldo" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "erpId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CuentaCorriente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Jornada" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "vendedorId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "horaInicio" TIMESTAMP(3) NOT NULL,
    "horaFin" TIMESTAMP(3),
    "estado" TEXT NOT NULL DEFAULT 'activa',
    "inicioLat" DOUBLE PRECISION,
    "inicioLng" DOUBLE PRECISION,
    "finLat" DOUBLE PRECISION,
    "finLng" DOUBLE PRECISION,
    "clientesPlan" INTEGER NOT NULL DEFAULT 0,
    "clientesVisitados" INTEGER NOT NULL DEFAULT 0,
    "totalVendido" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalCobrado" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "kmRecorridos" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "appLocalId" TEXT,

    CONSTRAINT "Jornada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Visita" (
    "id" TEXT NOT NULL,
    "jornadaId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "vendedorId" TEXT NOT NULL,
    "fechaHora" TIMESTAMP(3) NOT NULL,
    "tipo" TEXT NOT NULL,
    "resultado" TEXT,
    "pedidoId" TEXT,
    "monto" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "latitud" DOUBLE PRECISION,
    "longitud" DOUBLE PRECISION,
    "appLocalId" TEXT,

    CONSTRAINT "Visita_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GpsPoint" (
    "id" SERIAL NOT NULL,
    "jornadaId" TEXT NOT NULL,
    "vendedorId" TEXT NOT NULL,
    "latitud" DOUBLE PRECISION NOT NULL,
    "longitud" DOUBLE PRECISION NOT NULL,
    "velocidad" DOUBLE PRECISION,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "bateria" INTEGER,

    CONSTRAINT "GpsPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ruta" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "diaSemana" INTEGER,
    "vendedorId" TEXT,

    CONSTRAINT "Ruta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RutaCliente" (
    "id" SERIAL NOT NULL,
    "rutaId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RutaCliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Devolucion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "vendedorId" TEXT NOT NULL,
    "pedidoOriginalId" TEXT,
    "facturaNumero" TEXT,
    "tipo" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "motivoGeneral" TEXT,
    "aprobadaPor" TEXT,
    "fechaAprobacion" TIMESTAMP(3),
    "ncNumero" TEXT,
    "erpId" TEXT,
    "erpSynced" BOOLEAN NOT NULL DEFAULT false,
    "appLocalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Devolucion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DevolucionItem" (
    "id" SERIAL NOT NULL,
    "devolucionId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "productoCodigo" TEXT NOT NULL,
    "productoNombre" TEXT NOT NULL,
    "cantidadDevuelta" DOUBLE PRECISION NOT NULL,
    "precioUnitario" DOUBLE PRECISION NOT NULL,
    "motivo" TEXT,
    "lote" TEXT,
    "subtotal" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "DevolucionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PoliticaComercial" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "evento" TEXT NOT NULL,
    "condiciones" JSONB NOT NULL,
    "accion" TEXT NOT NULL,
    "accionParams" JSONB,
    "mensaje" TEXT,
    "prioridad" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PoliticaComercial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrecioCliente" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "precio" DOUBLE PRECISION NOT NULL,
    "descuento" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "moneda" TEXT NOT NULL DEFAULT 'ARS',
    "vigenciaDesde" TIMESTAMP(3),
    "vigenciaHasta" TIMESTAMP(3),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrecioCliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CondicionVenta" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "diasPlazo" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CondicionVenta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MotivoNoCompra" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MotivoNoCompra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Objetivo" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "vendedorId" TEXT,
    "tipo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "metrica" TEXT NOT NULL,
    "valorObjetivo" DOUBLE PRECISION NOT NULL,
    "valorActual" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "productoId" TEXT,
    "categoriaId" TEXT,
    "periodoInicio" TIMESTAMP(3) NOT NULL,
    "periodoFin" TIMESTAMP(3) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Objetivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mensaje" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "vendedorId" TEXT,
    "titulo" TEXT NOT NULL,
    "cuerpo" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'info',
    "leido" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Mensaje_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Billetera" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "alias" TEXT,
    "cbu" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Billetera_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Denominacion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "valor" DOUBLE PRECISION NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'ARS',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Denominacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncLog" (
    "id" SERIAL NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "recordCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "errorDetail" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "SyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_codigo_key" ON "Tenant"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "TenantConfig_tenantId_key" ON "TenantConfig"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "User_tenantId_email_key" ON "User"("tenantId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "Producto_tenantId_codigo_key" ON "Producto"("tenantId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_tenantId_codigo_key" ON "Cliente"("tenantId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "PrecioCliente_tenantId_clienteId_productoId_key" ON "PrecioCliente"("tenantId", "clienteId", "productoId");

-- CreateIndex
CREATE UNIQUE INDEX "CondicionVenta_tenantId_codigo_key" ON "CondicionVenta"("tenantId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "MotivoNoCompra_tenantId_codigo_key" ON "MotivoNoCompra"("tenantId", "codigo");

-- AddForeignKey
ALTER TABLE "TenantConfig" ADD CONSTRAINT "TenantConfig_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Producto" ADD CONSTRAINT "Producto_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cliente" ADD CONSTRAINT "Cliente_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_vendedorId_fkey" FOREIGN KEY ("vendedorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoItem" ADD CONSTRAINT "PedidoItem_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cobranza" ADD CONSTRAINT "Cobranza_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cobranza" ADD CONSTRAINT "Cobranza_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cobranza" ADD CONSTRAINT "Cobranza_vendedorId_fkey" FOREIGN KEY ("vendedorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CobranzaMedio" ADD CONSTRAINT "CobranzaMedio_cobranzaId_fkey" FOREIGN KEY ("cobranzaId") REFERENCES "Cobranza"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CuentaCorriente" ADD CONSTRAINT "CuentaCorriente_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Jornada" ADD CONSTRAINT "Jornada_vendedorId_fkey" FOREIGN KEY ("vendedorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visita" ADD CONSTRAINT "Visita_jornadaId_fkey" FOREIGN KEY ("jornadaId") REFERENCES "Jornada"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visita" ADD CONSTRAINT "Visita_vendedorId_fkey" FOREIGN KEY ("vendedorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GpsPoint" ADD CONSTRAINT "GpsPoint_jornadaId_fkey" FOREIGN KEY ("jornadaId") REFERENCES "Jornada"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ruta" ADD CONSTRAINT "Ruta_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RutaCliente" ADD CONSTRAINT "RutaCliente_rutaId_fkey" FOREIGN KEY ("rutaId") REFERENCES "Ruta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DevolucionItem" ADD CONSTRAINT "DevolucionItem_devolucionId_fkey" FOREIGN KEY ("devolucionId") REFERENCES "Devolucion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoliticaComercial" ADD CONSTRAINT "PoliticaComercial_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
