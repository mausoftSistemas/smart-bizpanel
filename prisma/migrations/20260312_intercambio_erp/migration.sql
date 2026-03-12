-- CreateTable
CREATE TABLE "IntercambioConfig" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntercambioConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArchivoConfig" (
    "id" TEXT NOT NULL,
    "intercambioId" TEXT NOT NULL,
    "direccion" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "nombreArchivo" TEXT NOT NULL,
    "entidad" TEXT NOT NULL,
    "esDetalle" BOOLEAN NOT NULL DEFAULT false,
    "archivoPadreId" TEXT,
    "campoRelacion" TEXT,
    "formatoArchivo" TEXT NOT NULL DEFAULT 'txt',
    "separador" TEXT NOT NULL DEFAULT ';',
    "encoding" TEXT NOT NULL DEFAULT 'latin1',
    "tieneEncabezado" BOOLEAN NOT NULL DEFAULT true,
    "saltarFilas" INTEGER NOT NULL DEFAULT 0,
    "formatoFecha" TEXT NOT NULL DEFAULT 'yyyyMMdd',
    "separadorDecimal" TEXT NOT NULL DEFAULT '.',
    "mapeoColumnas" JSONB NOT NULL,
    "valoresDefault" JSONB,
    "actualizarExist" BOOLEAN NOT NULL DEFAULT true,
    "campoUnico" TEXT DEFAULT 'codigo',
    "soloNuevos" BOOLEAN NOT NULL DEFAULT true,
    "filtroEstado" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ArchivoConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntercambioLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "direccion" TEXT NOT NULL,
    "usuario" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'ok',
    "archivos" JSONB NOT NULL,
    "erroresDetalle" JSONB,
    "archivoZipPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntercambioLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClienteTelefono" (
    "id" SERIAL NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'telefono',
    "numero" TEXT NOT NULL,
    "contacto" TEXT,
    "principal" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ClienteTelefono_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ArchivoConfig" ADD CONSTRAINT "ArchivoConfig_intercambioId_fkey" FOREIGN KEY ("intercambioId") REFERENCES "IntercambioConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
