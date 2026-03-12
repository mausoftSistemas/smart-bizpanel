import { useState } from 'react'
import { AlertTriangle, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react'
import type { ColumnMapping } from '../../components/ColumnMapperUI'
import { cn } from '../../lib/utils'

interface ImportPreviewProps {
  entityType: string
  data: Record<string, unknown>[]
  mappings: ColumnMapping[]
  totalRows: number
  defaultValues: Record<string, string>
}

const entityLabels: Record<string, string> = {
  productos: 'Productos',
  clientes: 'Clientes',
  precios: 'Precios por cliente',
  facturas: 'Facturas / Cuenta corriente',
}

// Campos obligatorios por entidad (debe coincidir con backend)
const requiredByEntity: Record<string, string[]> = {
  productos: ['codigo', 'nombre', 'precioLista'],
  clientes: ['codigo', 'nombre'],
  facturas: ['clienteCodigo', 'tipo', 'numero', 'fecha', 'monto'],
  precios: ['clienteCodigo', 'productoCodigo', 'precioEspecial'],
}

interface RowValidation {
  rowIndex: number
  errors: string[]
}

function validatePreviewRows(
  rows: Record<string, unknown>[],
  mappings: ColumnMapping[],
  entityType: string,
  defaultValues: Record<string, string>,
): RowValidation[] {
  const required = requiredByEntity[entityType] || []
  const results: RowValidation[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const errors: string[] = []

    for (const field of required) {
      const mapping = mappings.find((m) => m.target === field)
      const hasDefault = defaultValues[field] && defaultValues[field].trim() !== ''

      if (!mapping?.source && !hasDefault) {
        errors.push(`"${field}" no mapeado ni tiene valor por defecto`)
        continue
      }

      if (mapping?.source) {
        const value = row[mapping.source]
        if (value === undefined || value === null || String(value).trim() === '') {
          if (!hasDefault) {
            errors.push(`"${field}" vacío en la fila`)
          }
        }
      }
    }

    // Validación de precio numérico
    if (entityType === 'productos') {
      const precioMapping = mappings.find((m) => m.target === 'precioLista')
      if (precioMapping?.source) {
        const val = row[precioMapping.source]
        if (val !== undefined && val !== null && val !== '') {
          const num = Number(val)
          if (isNaN(num) || num < 0) errors.push('precioLista no es un número válido')
        }
      }
    }

    if (entityType === 'precios') {
      const precioMapping = mappings.find((m) => m.target === 'precioEspecial')
      if (precioMapping?.source) {
        const val = row[precioMapping.source]
        if (val !== undefined && val !== null && val !== '') {
          const num = Number(val)
          if (isNaN(num) || num < 0) errors.push('precioEspecial no es un número válido')
        }
      }
    }

    if (entityType === 'facturas') {
      const montoMapping = mappings.find((m) => m.target === 'monto')
      if (montoMapping?.source) {
        const val = row[montoMapping.source]
        if (val !== undefined && val !== null && val !== '') {
          if (isNaN(Number(val))) errors.push('monto no es un número válido')
        }
      }
    }

    results.push({ rowIndex: i, errors })
  }

  return results
}

export default function ImportPreview({ entityType, data, mappings, totalRows, defaultValues }: ImportPreviewProps) {
  const [showErrors, setShowErrors] = useState(true)
  const previewRows = data.slice(0, 10)
  const mappedColumns = mappings.filter((m) => m.source && m.target)

  const validations = validatePreviewRows(previewRows, mappings, entityType, defaultValues)
  const errorRows = validations.filter((v) => v.errors.length > 0)
  const validRows = validations.filter((v) => v.errors.length === 0)

  // Obtener el valor mapeado para mostrar (aplica defaults)
  const getCellValue = (row: Record<string, unknown>, mapping: ColumnMapping): string => {
    const value = row[mapping.source]
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value)
    }
    if (defaultValues[mapping.target]) {
      return defaultValues[mapping.target]
    }
    return ''
  }

  // Determinar si una celda tiene error
  const isCellError = (rowValidation: RowValidation, targetField: string): boolean => {
    return rowValidation.errors.some((e) => e.includes(`"${targetField}"`))
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Vista previa</h2>
        <p className="text-sm text-muted-foreground">
          Revisá los datos antes de importar. Mostrando {previewRows.length} de {totalRows} filas.
        </p>
      </div>

      {/* Resumen */}
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-border p-3 text-center">
          <p className="text-sm text-muted-foreground">Tipo</p>
          <p className="text-base font-semibold">{entityLabels[entityType]}</p>
        </div>
        <div className="rounded-lg border border-border p-3 text-center">
          <p className="text-sm text-muted-foreground">Filas totales</p>
          <p className="text-base font-semibold">{totalRows}</p>
        </div>
        <div className="rounded-lg border border-border p-3 text-center">
          <p className="text-sm text-muted-foreground">Campos mapeados</p>
          <p className="text-base font-semibold">{mappedColumns.length}</p>
        </div>
        <div className="rounded-lg border border-border p-3 text-center">
          <p className="text-sm text-muted-foreground">Preview válidas</p>
          <p className={cn('text-base font-semibold', errorRows.length > 0 ? 'text-warning' : 'text-success')}>
            {validRows.length} / {previewRows.length}
          </p>
        </div>
      </div>

      {/* Errores de validación */}
      {errorRows.length > 0 && (
        <div className="rounded-lg border border-warning/30 bg-warning/5">
          <button
            type="button"
            onClick={() => setShowErrors(!showErrors)}
            className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium"
          >
            <div className="flex items-center gap-2 text-warning">
              <AlertTriangle size={15} />
              {errorRows.length} fila{errorRows.length > 1 ? 's' : ''} con posibles problemas
            </div>
            {showErrors ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {showErrors && (
            <div className="border-t border-warning/20 px-4 py-3 space-y-1.5">
              {errorRows.map((v) => (
                <div key={v.rowIndex} className="text-xs">
                  <span className="font-medium text-warning">Fila {v.rowIndex + 1}:</span>{' '}
                  <span className="text-muted-foreground">{v.errors.join('; ')}</span>
                </div>
              ))}
              <p className="text-xs text-muted-foreground mt-2">
                Nota: estas validaciones son orientativas. El servidor hará la validación final al importar.
              </p>
            </div>
          )}
        </div>
      )}

      {errorRows.length === 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/5 px-4 py-3 text-sm text-success">
          <CheckCircle size={15} />
          Todas las filas de la vista previa pasaron la validación
        </div>
      )}

      {/* Tabla de datos mapeados */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">#</th>
              {mappedColumns.map((m) => (
                <th key={m.target} className="px-3 py-2 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">
                  {m.target}
                  <span className="ml-1 text-[10px] font-normal opacity-60">← {m.source}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {previewRows.map((row, i) => {
              const validation = validations[i]
              const hasErrors = validation.errors.length > 0
              return (
                <tr
                  key={i}
                  className={cn(
                    'border-b border-border last:border-0 transition-colors',
                    hasErrors ? 'bg-destructive/[0.03]' : '',
                  )}
                >
                  <td className="px-3 py-2 text-muted-foreground text-xs">
                    <span className="flex items-center gap-1">
                      {hasErrors && <AlertTriangle size={10} className="text-warning" />}
                      {i + 1}
                    </span>
                  </td>
                  {mappedColumns.map((m) => {
                    const cellError = isCellError(validation, m.target)
                    const value = getCellValue(row, m)
                    const isDefault = (row[m.source] === undefined || row[m.source] === null || String(row[m.source]).trim() === '') && defaultValues[m.target]
                    return (
                      <td
                        key={m.target}
                        className={cn(
                          'px-3 py-2 max-w-48 truncate',
                          cellError ? 'text-destructive font-medium' : '',
                          isDefault ? 'text-muted-foreground italic' : '',
                        )}
                        title={value}
                      >
                        {value || <span className="text-muted-foreground/50">—</span>}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {totalRows > 10 && (
        <p className="text-center text-xs text-muted-foreground">
          ... y {totalRows - 10} filas más que se procesarán al importar
        </p>
      )}
    </div>
  )
}
