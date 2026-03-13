-- Columnas faltantes en CobranzaMedio
ALTER TABLE "CobranzaMedio" ADD COLUMN IF NOT EXISTS "fotoComprobante" TEXT;
ALTER TABLE "CobranzaMedio" ADD COLUMN IF NOT EXISTS "estado" TEXT NOT NULL DEFAULT 'pendiente';
ALTER TABLE "CobranzaMedio" ADD COLUMN IF NOT EXISTS "codigoMedioPago" TEXT;
ALTER TABLE "CobranzaMedio" ADD COLUMN IF NOT EXISTS "numeroReferencia" TEXT;
ALTER TABLE "CobranzaMedio" ADD COLUMN IF NOT EXISTS "plazaCheque" TEXT;
ALTER TABLE "CobranzaMedio" ADD COLUMN IF NOT EXISTS "fechaEmision" TIMESTAMP(3);
ALTER TABLE "CobranzaMedio" ADD COLUMN IF NOT EXISTS "fechaVencimiento" TIMESTAMP(3);
ALTER TABLE "CobranzaMedio" ADD COLUMN IF NOT EXISTS "cotizacion" DOUBLE PRECISION NOT NULL DEFAULT 1;
ALTER TABLE "CobranzaMedio" ADD COLUMN IF NOT EXISTS "cuitAcreedor" TEXT;
ALTER TABLE "CobranzaMedio" ADD COLUMN IF NOT EXISTS "titularTarjeta" TEXT;
ALTER TABLE "CobranzaMedio" ADD COLUMN IF NOT EXISTS "codigoAutorizacion" TEXT;
ALTER TABLE "CobranzaMedio" ADD COLUMN IF NOT EXISTS "codigoLote" TEXT;
ALTER TABLE "CobranzaMedio" ADD COLUMN IF NOT EXISTS "cuotas" INTEGER;
ALTER TABLE "CobranzaMedio" ADD COLUMN IF NOT EXISTS "numeroCupon" TEXT;

-- Columnas ERP en Cobranza
ALTER TABLE "Cobranza" ADD COLUMN IF NOT EXISTS "horaInicio" TEXT;
ALTER TABLE "Cobranza" ADD COLUMN IF NOT EXISTS "horaFin" TEXT;
ALTER TABLE "Cobranza" ADD COLUMN IF NOT EXISTS "numeroRecibo" TEXT;
ALTER TABLE "Cobranza" ADD COLUMN IF NOT EXISTS "latitud" DOUBLE PRECISION;
ALTER TABLE "Cobranza" ADD COLUMN IF NOT EXISTS "longitud" DOUBLE PRECISION;
ALTER TABLE "Cobranza" ADD COLUMN IF NOT EXISTS "codigoVendedor" TEXT;

-- Tabla CobranzaImputacion si no existe
CREATE TABLE IF NOT EXISTS "CobranzaImputacion" (
    "id" SERIAL NOT NULL,
    "cobranzaId" TEXT NOT NULL,
    "comprobanteId" TEXT,
    "comprobanteTipo" TEXT NOT NULL,
    "comprobanteNumero" TEXT NOT NULL,
    "montoOriginal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "montoImputado" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cotizacion" DOUBLE PRECISION NOT NULL DEFAULT 1,

    CONSTRAINT "CobranzaImputacion_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CobranzaImputacion" DROP CONSTRAINT IF EXISTS "CobranzaImputacion_cobranzaId_fkey";
ALTER TABLE "CobranzaImputacion" ADD CONSTRAINT "CobranzaImputacion_cobranzaId_fkey" FOREIGN KEY ("cobranzaId") REFERENCES "Cobranza"("id") ON DELETE CASCADE ON UPDATE CASCADE;
