-- ══════════════════════════════════════════════════════════
-- Columnas faltantes en tablas existentes
-- ══════════════════════════════════════════════════════════

-- User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordTemp" BOOLEAN NOT NULL DEFAULT true;

-- Pedido
ALTER TABLE "Pedido" ADD COLUMN IF NOT EXISTS "numero" INTEGER;
ALTER TABLE "Pedido" ADD COLUMN IF NOT EXISTS "descuentoMonto" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Pedido" ADD COLUMN IF NOT EXISTS "vendedorOriginalId" TEXT;

-- PedidoItem
ALTER TABLE "PedidoItem" ADD COLUMN IF NOT EXISTS "tipoVenta" TEXT NOT NULL DEFAULT 'venta';

-- Cobranza
ALTER TABLE "Cobranza" ADD COLUMN IF NOT EXISTS "jornadaId" TEXT;
ALTER TABLE "Cobranza" ADD COLUMN IF NOT EXISTS "observaciones" TEXT;
ALTER TABLE "Cobranza" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Jornada
ALTER TABLE "Jornada" ADD COLUMN IF NOT EXISTS "totalDevoluciones" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Jornada" ADD COLUMN IF NOT EXISTS "cantidadNoCompras" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Jornada" ADD COLUMN IF NOT EXISTS "fueTardanza" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Jornada" ADD COLUMN IF NOT EXISTS "observaciones" TEXT;

-- Visita
ALTER TABLE "Visita" ADD COLUMN IF NOT EXISTS "motivoNoCompraId" TEXT;
ALTER TABLE "Visita" ADD COLUMN IF NOT EXISTS "observaciones" TEXT;

-- ══════════════════════════════════════════════════════════
-- Tablas nuevas
-- ══════════════════════════════════════════════════════════

-- MappingGuardado
CREATE TABLE IF NOT EXISTS "MappingGuardado" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "columnasArchivo" JSONB NOT NULL,
    "huella" TEXT NOT NULL,
    "mapping" JSONB NOT NULL,
    "defaultValues" JSONB,
    "opciones" JSONB,
    "vecesUsado" INTEGER NOT NULL DEFAULT 1,
    "creadoPorIA" BOOLEAN NOT NULL DEFAULT true,
    "confirmado" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MappingGuardado_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MappingGuardado_tenantId_entityType_huella_key" ON "MappingGuardado"("tenantId", "entityType", "huella");

-- Rendicion
CREATE TABLE IF NOT EXISTS "Rendicion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "vendedorId" TEXT NOT NULL,
    "jornadaId" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "detalleBilletes" JSONB NOT NULL,
    "totalEfectivo" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalCheques" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cantidadCheques" INTEGER NOT NULL DEFAULT 0,
    "totalTransferencias" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalBilleteras" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalRetenciones" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalTarjetas" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalMercadoPago" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalRecaudado" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalEsperado" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "diferencia" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "observaciones" TEXT,
    "aprobadoPor" TEXT,
    "motivoRechazo" TEXT,
    "fechaAprobacion" TIMESTAMP(3),
    "appLocalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Rendicion_pkey" PRIMARY KEY ("id")
);

-- RendicionCheque
CREATE TABLE IF NOT EXISTS "RendicionCheque" (
    "id" SERIAL NOT NULL,
    "rendicionId" TEXT NOT NULL,
    "banco" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    "fechaCobro" TIMESTAMP(3),
    "plaza" TEXT,
    "cuitLibrador" TEXT,
    "entregado" BOOLEAN NOT NULL DEFAULT false,
    "recibidoPor" TEXT,
    "fechaRecepcion" TIMESTAMP(3),

    CONSTRAINT "RendicionCheque_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "RendicionCheque" DROP CONSTRAINT IF EXISTS "RendicionCheque_rendicionId_fkey";
ALTER TABLE "RendicionCheque" ADD CONSTRAINT "RendicionCheque_rendicionId_fkey" FOREIGN KEY ("rendicionId") REFERENCES "Rendicion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Presupuesto
CREATE TABLE IF NOT EXISTS "Presupuesto" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "vendedorId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "vigenciaHasta" TIMESTAMP(3),
    "estado" TEXT NOT NULL DEFAULT 'vigente',
    "pedidoGeneradoId" TEXT,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "observaciones" TEXT,
    "appLocalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Presupuesto_pkey" PRIMARY KEY ("id")
);

-- PresupuestoItem
CREATE TABLE IF NOT EXISTS "PresupuestoItem" (
    "id" SERIAL NOT NULL,
    "presupuestoId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "productoCodigo" TEXT NOT NULL,
    "productoNombre" TEXT NOT NULL,
    "cantidad" DOUBLE PRECISION NOT NULL,
    "unidadTipo" TEXT NOT NULL DEFAULT 'unidad',
    "precioUnitario" DOUBLE PRECISION NOT NULL,
    "descuentoPorcentaje" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "subtotal" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "PresupuestoItem_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PresupuestoItem" DROP CONSTRAINT IF EXISTS "PresupuestoItem_presupuestoId_fkey";
ALTER TABLE "PresupuestoItem" ADD CONSTRAINT "PresupuestoItem_presupuestoId_fkey" FOREIGN KEY ("presupuestoId") REFERENCES "Presupuesto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- FotoEvidencia
CREATE TABLE IF NOT EXISTS "FotoEvidencia" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "vendedorId" TEXT NOT NULL,
    "clienteId" TEXT,
    "visitaId" TEXT,
    "pedidoId" TEXT,
    "tipo" TEXT NOT NULL,
    "fotoUrl" TEXT NOT NULL,
    "latitud" DOUBLE PRECISION,
    "longitud" DOUBLE PRECISION,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "appLocalId" TEXT,

    CONSTRAINT "FotoEvidencia_pkey" PRIMARY KEY ("id")
);

-- Firma
CREATE TABLE IF NOT EXISTS "Firma" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "vendedorId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "pedidoId" TEXT,
    "cobranzaId" TEXT,
    "devolucionId" TEXT,
    "tipo" TEXT NOT NULL,
    "firmaUrl" TEXT NOT NULL,
    "firmante" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "appLocalId" TEXT,

    CONSTRAINT "Firma_pkey" PRIMARY KEY ("id")
);

-- Formulario
CREATE TABLE IF NOT EXISTS "Formulario" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "campos" JSONB NOT NULL,
    "esActivo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Formulario_pkey" PRIMARY KEY ("id")
);

-- FormularioRespuesta
CREATE TABLE IF NOT EXISTS "FormularioRespuesta" (
    "id" TEXT NOT NULL,
    "formularioId" TEXT NOT NULL,
    "vendedorId" TEXT NOT NULL,
    "clienteId" TEXT,
    "visitaId" TEXT,
    "respuestas" JSONB NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "appLocalId" TEXT,

    CONSTRAINT "FormularioRespuesta_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "FormularioRespuesta" DROP CONSTRAINT IF EXISTS "FormularioRespuesta_formularioId_fkey";
ALTER TABLE "FormularioRespuesta" ADD CONSTRAINT "FormularioRespuesta_formularioId_fkey" FOREIGN KEY ("formularioId") REFERENCES "Formulario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- SugerenciaVenta
CREATE TABLE IF NOT EXISTS "SugerenciaVenta" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "prioridad" INTEGER NOT NULL DEFAULT 0,
    "motivo" TEXT,
    "esActivo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "SugerenciaVenta_pkey" PRIMARY KEY ("id")
);
