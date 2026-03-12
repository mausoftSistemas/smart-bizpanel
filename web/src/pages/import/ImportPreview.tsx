import type { ColumnMapping } from '../../components/ColumnMapperUI'

interface ImportPreviewProps {
  entityType: string
  data: Record<string, unknown>[]
  mappings: ColumnMapping[]
  totalRows: number
}

const entityLabels: Record<string, string> = {
  productos: 'Productos',
  clientes: 'Clientes',
  precios: 'Precios por cliente',
  facturas: 'Facturas',
}

export default function ImportPreview({ entityType, data, mappings, totalRows }: ImportPreviewProps) {
  const previewRows = data.slice(0, 5)
  const mappedColumns = mappings.filter((m) => m.source && m.target)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">4. Vista previa</h2>
        <p className="text-sm text-muted-foreground">
          Verificá los datos antes de importar. Se muestran las primeras 5 filas de {totalRows}.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border p-4">
          <p className="text-sm text-muted-foreground">Tipo</p>
          <p className="text-lg font-semibold">{entityLabels[entityType]}</p>
        </div>
        <div className="rounded-lg border border-border p-4">
          <p className="text-sm text-muted-foreground">Filas totales</p>
          <p className="text-lg font-semibold">{totalRows}</p>
        </div>
        <div className="rounded-lg border border-border p-4">
          <p className="text-sm text-muted-foreground">Campos mapeados</p>
          <p className="text-lg font-semibold">{mappedColumns.length}</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">#</th>
              {mappedColumns.map((m) => (
                <th key={m.target} className="px-3 py-2 text-left font-medium text-muted-foreground">
                  {m.target}
                  <span className="ml-1 text-xs font-normal">({m.source})</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {previewRows.map((row, i) => (
              <tr key={i} className="border-b border-border last:border-0">
                <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                {mappedColumns.map((m) => (
                  <td key={m.target} className="px-3 py-2 max-w-48 truncate">
                    {String(row[m.source] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
