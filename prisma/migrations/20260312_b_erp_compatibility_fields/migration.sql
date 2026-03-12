-- ═══ Producto: campos ERP ═══
ALTER TABLE "Producto" ADD COLUMN "codigoRubro" TEXT;
ALTER TABLE "Producto" ADD COLUMN "nombreRubro" TEXT;
ALTER TABLE "Producto" ADD COLUMN "codigoSubrubro" TEXT;
ALTER TABLE "Producto" ADD COLUMN "nombreSubrubro" TEXT;
ALTER TABLE "Producto" ADD COLUMN "codigoDeposito" TEXT;
ALTER TABLE "Producto" ADD COLUMN "nombreDeposito" TEXT;
ALTER TABLE "Producto" ADD COLUMN "listaPrecioId" TEXT;
ALTER TABLE "Producto" ADD COLUMN "nombreListaPrecio" TEXT;
ALTER TABLE "Producto" ADD COLUMN "impuestoInterno" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Producto" ADD COLUMN "costoNeto" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Producto" ADD COLUMN "codigoEstado" TEXT;
ALTER TABLE "Producto" ADD COLUMN "resumenUniMedida" TEXT;
ALTER TABLE "Producto" ADD COLUMN "codigoUnidad" TEXT;
ALTER TABLE "Producto" ADD COLUMN "nombreUnidad" TEXT;

-- ═══ Cliente: campos ERP ═══
ALTER TABLE "Cliente" ADD COLUMN "codigoPostal" TEXT;
ALTER TABLE "Cliente" ADD COLUMN "tipoDni" TEXT;
ALTER TABLE "Cliente" ADD COLUMN "codigoArca" TEXT;
ALTER TABLE "Cliente" ADD COLUMN "codigoEstado" TEXT;

-- ═══ User: campos ERP ═══
ALTER TABLE "User" ADD COLUMN "codigoVendedor" TEXT;
ALTER TABLE "User" ADD COLUMN "codigoPersona" TEXT;
ALTER TABLE "User" ADD COLUMN "codigoZona" TEXT;

-- ═══ Pedido: campos ERP ═══
ALTER TABLE "Pedido" ADD COLUMN "horaInicio" TEXT;
ALTER TABLE "Pedido" ADD COLUMN "horaFin" TEXT;
ALTER TABLE "Pedido" ADD COLUMN "fechaEntrega" TIMESTAMP(3);
ALTER TABLE "Pedido" ADD COLUMN "netoTotal" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Pedido" ADD COLUMN "cantidadItems" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Pedido" ADD COLUMN "latitud" DOUBLE PRECISION;
ALTER TABLE "Pedido" ADD COLUMN "longitud" DOUBLE PRECISION;
ALTER TABLE "Pedido" ADD COLUMN "codigoEstado" TEXT NOT NULL DEFAULT '0';
ALTER TABLE "Pedido" ADD COLUMN "condicionVtaCodigo" TEXT;
ALTER TABLE "Pedido" ADD COLUMN "listaPrecioUsada" TEXT;

-- ═══ PedidoItem: campos ERP ═══
ALTER TABLE "PedidoItem" ADD COLUMN "codigoCombo" TEXT;
ALTER TABLE "PedidoItem" ADD COLUMN "precioNeto" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "PedidoItem" ADD COLUMN "listaPrecio" TEXT;
ALTER TABLE "PedidoItem" ADD COLUMN "bultoUnidad" INTEGER NOT NULL DEFAULT 1;

-- ═══ Cobranza: campos ERP ═══
ALTER TABLE "Cobranza" ADD COLUMN "horaInicio" TEXT;
ALTER TABLE "Cobranza" ADD COLUMN "horaFin" TEXT;
ALTER TABLE "Cobranza" ADD COLUMN "numeroRecibo" TEXT;
ALTER TABLE "Cobranza" ADD COLUMN "latitud" DOUBLE PRECISION;
ALTER TABLE "Cobranza" ADD COLUMN "longitud" DOUBLE PRECISION;
ALTER TABLE "Cobranza" ADD COLUMN "codigoVendedor" TEXT;

-- ═══ CobranzaMedio: campos ERP explícitos ═══
ALTER TABLE "CobranzaMedio" ADD COLUMN "codigoMedioPago" TEXT;
ALTER TABLE "CobranzaMedio" ADD COLUMN "numeroReferencia" TEXT;
ALTER TABLE "CobranzaMedio" ADD COLUMN "plazaCheque" TEXT;
ALTER TABLE "CobranzaMedio" ADD COLUMN "fechaEmision" TIMESTAMP(3);
ALTER TABLE "CobranzaMedio" ADD COLUMN "fechaVencimiento" TIMESTAMP(3);
ALTER TABLE "CobranzaMedio" ADD COLUMN "cotizacion" DOUBLE PRECISION NOT NULL DEFAULT 1;
ALTER TABLE "CobranzaMedio" ADD COLUMN "cuitAcreedor" TEXT;
ALTER TABLE "CobranzaMedio" ADD COLUMN "titularTarjeta" TEXT;
ALTER TABLE "CobranzaMedio" ADD COLUMN "codigoAutorizacion" TEXT;
ALTER TABLE "CobranzaMedio" ADD COLUMN "codigoLote" TEXT;
ALTER TABLE "CobranzaMedio" ADD COLUMN "cuotas" INTEGER;
ALTER TABLE "CobranzaMedio" ADD COLUMN "numeroCupon" TEXT;

-- ═══ CobranzaImputacion: nueva tabla ═══
CREATE TABLE "CobranzaImputacion" (
    "id" SERIAL NOT NULL,
    "cobranzaId" TEXT NOT NULL,
    "tipoComprobante" TEXT NOT NULL,
    "sucursal" TEXT NOT NULL,
    "numeroComprobante" TEXT NOT NULL,
    "importeCobrado" DOUBLE PRECISION NOT NULL,
    "numeroCuota" INTEGER NOT NULL DEFAULT 1,
    "letraComprobante" TEXT,

    CONSTRAINT "CobranzaImputacion_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CobranzaImputacion" ADD CONSTRAINT "CobranzaImputacion_cobranzaId_fkey" FOREIGN KEY ("cobranzaId") REFERENCES "Cobranza"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ═══ CuentaCorriente: campos ERP ═══
ALTER TABLE "CuentaCorriente" ADD COLUMN "sucursal" TEXT;
ALTER TABLE "CuentaCorriente" ADD COLUMN "tipoLetra" TEXT;
ALTER TABLE "CuentaCorriente" ADD COLUMN "cuotas" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "CuentaCorriente" ADD COLUMN "vendedorId" TEXT;
ALTER TABLE "CuentaCorriente" ADD COLUMN "importeCobrado" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "CuentaCorriente" ADD COLUMN "importeFactura" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "CuentaCorriente" ADD COLUMN "saldoComprobante" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "CuentaCorriente" ADD COLUMN "codigoEstado" TEXT;

-- ═══ RutaCliente: campos ERP ═══
ALTER TABLE "RutaCliente" ADD COLUMN "horaVisita" TEXT;

-- ═══ Visita: campos ERP ═══
ALTER TABLE "Visita" ADD COLUMN "codigoZona" TEXT;
ALTER TABLE "Visita" ADD COLUMN "codigoNoCompra" TEXT;
ALTER TABLE "Visita" ADD COLUMN "horaRegistro" TEXT;
ALTER TABLE "Visita" ADD COLUMN "codigoVendedor" TEXT;
ALTER TABLE "Visita" ADD COLUMN "codigoCliente" TEXT;

-- ═══ CondicionVenta: campos ERP ═══
ALTER TABLE "CondicionVenta" ADD COLUMN "descripcion" TEXT;
ALTER TABLE "CondicionVenta" ADD COLUMN "moneda" TEXT NOT NULL DEFAULT 'ARS';
ALTER TABLE "CondicionVenta" ADD COLUMN "recargo" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "CondicionVenta" ADD COLUMN "bonificacion" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "CondicionVenta" ADD COLUMN "contado" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "CondicionVenta" ADD COLUMN "observacion" TEXT;
ALTER TABLE "CondicionVenta" ADD COLUMN "ventaFija" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CondicionVenta" ADD COLUMN "fechaVto" TIMESTAMP(3);
ALTER TABLE "CondicionVenta" ADD COLUMN "limiteCredito" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "CondicionVenta" ADD COLUMN "codigoEstado" TEXT;

-- ═══ MotivoNoCompra: campos ERP ═══
ALTER TABLE "MotivoNoCompra" ADD COLUMN "codigoEstado" TEXT;

-- ═══ ClienteTelefono: agregar relación + codigoControl ═══
ALTER TABLE "ClienteTelefono" ADD COLUMN "codigoControl" TEXT;
ALTER TABLE "ClienteTelefono" ADD CONSTRAINT "ClienteTelefono_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
