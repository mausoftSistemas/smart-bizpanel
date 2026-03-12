import ColumnMapperUI, { type ColumnMapping } from '../../components/ColumnMapperUI'

interface ColumnMapperProps {
  entityType: string
  sourceColumns: string[]
  mappings: ColumnMapping[]
  onMappingsChange: (mappings: ColumnMapping[]) => void
}

const fieldsByEntity: Record<string, { key: string; label: string; required?: boolean }[]> = {
  productos: [
    { key: 'codigoErp', label: 'Código ERP', required: true },
    { key: 'nombre', label: 'Nombre', required: true },
    { key: 'precio', label: 'Precio', required: true },
    { key: 'categoria', label: 'Categoría' },
    { key: 'unidadMedida', label: 'Unidad de medida' },
    { key: 'codigoBarras', label: 'Código de barras' },
    { key: 'stock', label: 'Stock' },
    { key: 'iva', label: 'IVA %' },
  ],
  clientes: [
    { key: 'codigoErp', label: 'Código ERP', required: true },
    { key: 'razonSocial', label: 'Razón social', required: true },
    { key: 'cuit', label: 'CUIT' },
    { key: 'direccion', label: 'Dirección' },
    { key: 'localidad', label: 'Localidad' },
    { key: 'provincia', label: 'Provincia' },
    { key: 'telefono', label: 'Teléfono' },
    { key: 'email', label: 'Email' },
    { key: 'condicionVenta', label: 'Condición de venta' },
    { key: 'limiteCredito', label: 'Límite de crédito' },
    { key: 'lat', label: 'Latitud' },
    { key: 'lng', label: 'Longitud' },
  ],
  precios: [
    { key: 'codigoCliente', label: 'Código cliente', required: true },
    { key: 'codigoProducto', label: 'Código producto', required: true },
    { key: 'precio', label: 'Precio', required: true },
    { key: 'descuento', label: 'Descuento %' },
  ],
  facturas: [
    { key: 'codigoCliente', label: 'Código cliente', required: true },
    { key: 'tipo', label: 'Tipo (factura/nc/nd)', required: true },
    { key: 'numero', label: 'Número comprobante', required: true },
    { key: 'fecha', label: 'Fecha', required: true },
    { key: 'monto', label: 'Monto', required: true },
    { key: 'saldo', label: 'Saldo' },
    { key: 'vencimiento', label: 'Vencimiento' },
  ],
}

export default function ColumnMapper({ entityType, sourceColumns, mappings, onMappingsChange }: ColumnMapperProps) {
  const fields = fieldsByEntity[entityType] || []

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">3. Mapear columnas</h2>
        <p className="text-sm text-muted-foreground">
          Asociá cada columna del archivo con el campo correspondiente. Los campos con * son obligatorios.
        </p>
      </div>

      <ColumnMapperUI
        sourceColumns={sourceColumns}
        targetFields={fields}
        mappings={mappings}
        onMappingChange={onMappingsChange}
      />
    </div>
  )
}
