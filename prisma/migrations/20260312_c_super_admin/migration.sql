-- CreateTable
CREATE TABLE "SuperAdmin" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLogin" TIMESTAMP(3),

    CONSTRAINT "SuperAdmin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SuperAdmin_email_key" ON "SuperAdmin"("email");

-- AlterTable: Agregar campos de contacto y facturación al Tenant
ALTER TABLE "Tenant" ADD COLUMN "contactoNombre" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "contactoTelefono" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "contactoEmail" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "notas" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "planPrecio" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Tenant" ADD COLUMN "planMoneda" TEXT NOT NULL DEFAULT 'USD';
ALTER TABLE "Tenant" ADD COLUMN "planPeriodicidad" TEXT NOT NULL DEFAULT 'mensual';
ALTER TABLE "Tenant" ADD COLUMN "proximoVencimiento" TIMESTAMP(3);
ALTER TABLE "Tenant" ADD COLUMN "diasMora" INTEGER NOT NULL DEFAULT 0;

-- AlterTable: Agregar métricas de uso al Tenant
ALTER TABLE "Tenant" ADD COLUMN "cantidadUsuarios" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Tenant" ADD COLUMN "cantidadProductos" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Tenant" ADD COLUMN "cantidadClientes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Tenant" ADD COLUMN "cantidadPedidosMes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Tenant" ADD COLUMN "ultimaActividad" TIMESTAMP(3);
ALTER TABLE "Tenant" ADD COLUMN "almacenamientoMb" DOUBLE PRECISION NOT NULL DEFAULT 0;
