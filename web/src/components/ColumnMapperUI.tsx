import { ArrowRight, Check, Sparkles } from 'lucide-react'
import { cn } from '../lib/utils'

export interface ColumnMapping {
  source: string
  target: string
}

export interface TargetField {
  key: string
  label: string
  required?: boolean
}

interface ColumnMapperUIProps {
  sourceColumns: string[]
  targetFields: TargetField[]
  mappings: ColumnMapping[]
  onMappingChange: (mappings: ColumnMapping[]) => void
}

// ─── Auto-mapeo inteligente ────────────────────────────

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quitar acentos
    .replace(/[^a-z0-9]/g, '')       // solo alfanumérico
}

// Alias comunes que la gente usa en sus archivos
const ALIASES: Record<string, string[]> = {
  codigo: ['cod', 'code', 'codart', 'codarticulo', 'codigoarticulo', 'codprod', 'codigoproducto', 'sku', 'ref', 'referencia', 'codcli', 'codigocliente', 'id'],
  nombre: ['descripcion', 'desc', 'nombre', 'articulo', 'producto', 'item', 'razonsocial', 'denominacion', 'detalle'],
  preciolista: ['precio', 'preciov', 'precioventa', 'pvp', 'preciounit', 'preciounitario', 'importe', 'valor', 'price'],
  stockunidad: ['stock', 'cantidad', 'existencia', 'disponible', 'saldo', 'qty'],
  stockbulto: ['stockbulto', 'bultos', 'cajas'],
  categoria: ['rubro', 'familia', 'linea', 'grupo', 'category', 'cat'],
  marca: ['marca', 'brand'],
  unidadmedida: ['unidad', 'um', 'umed', 'unit'],
  ivaporcentaje: ['iva', 'impuesto', 'tax', 'alicuota'],
  codigobarras: ['ean', 'barcode', 'codbarra', 'codbarras', 'gtin', 'upc'],
  moneda: ['moneda', 'currency', 'mon'],
  equivalencia: ['equivalencia', 'equiv', 'factor'],
  cuit: ['cuit', 'rut', 'nif', 'ruc', 'documento', 'doc', 'cuil'],
  condicioniva: ['condiva', 'condicioniva', 'tipoiva', 'catfiscal', 'categoriafiscal'],
  condicionventa: ['condventa', 'condicionventa', 'condpago', 'formapago'],
  direccion: ['direccion', 'domicilio', 'address', 'dir', 'calle'],
  ciudad: ['ciudad', 'localidad', 'loc', 'city', 'partido'],
  provincia: ['provincia', 'prov', 'state', 'estado', 'region'],
  telefono: ['telefono', 'tel', 'phone', 'celular', 'movil', 'fono'],
  email: ['email', 'mail', 'correo', 'emailcontacto'],
  limitecredito: ['limitecredito', 'limite', 'creditlimit', 'credito'],
  vendedorcodigo: ['vendedor', 'codvendedor', 'vendedorcodigo', 'seller'],
  clientecodigo: ['cliente', 'codcliente', 'clientecodigo', 'codigocliente'],
  productocodigo: ['producto', 'codproducto', 'productocodigo', 'codigoproducto', 'articulo'],
  precioespecial: ['precio', 'precioesp', 'precioespecial', 'preciounit'],
  descuentoporcentaje: ['descuento', 'desc', 'dto', 'discount', 'bonificacion', 'bonif'],
  tipo: ['tipo', 'tipocomprobante', 'tipomov', 'type'],
  numero: ['numero', 'nro', 'nrocomprobante', 'numcomprobante', 'comprobante', 'num'],
  fecha: ['fecha', 'date', 'fec', 'fechaemision'],
  fechavencimiento: ['vencimiento', 'vto', 'fechavto', 'fechavencimiento', 'duedate'],
  monto: ['monto', 'total', 'importe', 'amount', 'valor'],
  observaciones: ['observaciones', 'obs', 'notas', 'comentario', 'notes'],
  descripcion: ['descripcion', 'desc', 'detalle', 'description'],
}

function similarity(a: string, b: string): number {
  const na = normalize(a)
  const nb = normalize(b)
  if (na === nb) return 1
  if (na.includes(nb) || nb.includes(na)) return 0.8
  // Levenshtein-ish: si empiezan igual
  const minLen = Math.min(na.length, nb.length)
  let common = 0
  for (let i = 0; i < minLen; i++) {
    if (na[i] === nb[i]) common++
    else break
  }
  return common / Math.max(na.length, nb.length)
}

export function autoMapColumns(
  sourceColumns: string[],
  targetFields: TargetField[],
): ColumnMapping[] {
  const mappings: ColumnMapping[] = []
  const usedSources = new Set<string>()

  for (const field of targetFields) {
    const fieldNorm = normalize(field.key)
    let bestSource = ''
    let bestScore = 0

    for (const src of sourceColumns) {
      if (usedSources.has(src)) continue
      const srcNorm = normalize(src)

      // 1. Match exacto normalizado
      if (srcNorm === fieldNorm) {
        bestSource = src
        bestScore = 1
        break
      }

      // 2. Match por aliases
      const aliases = ALIASES[fieldNorm] || []
      if (aliases.includes(srcNorm)) {
        if (0.95 > bestScore) {
          bestSource = src
          bestScore = 0.95
        }
        continue
      }

      // 3. Similitud parcial
      const sim = similarity(srcNorm, fieldNorm)
      if (sim > bestScore && sim >= 0.6) {
        bestSource = src
        bestScore = sim
      }

      // 4. Similitud con aliases
      for (const alias of aliases) {
        const aliaSim = similarity(srcNorm, alias)
        if (aliaSim > bestScore && aliaSim >= 0.6) {
          bestSource = src
          bestScore = aliaSim
        }
      }
    }

    if (bestSource && bestScore >= 0.6) {
      mappings.push({ source: bestSource, target: field.key })
      usedSources.add(bestSource)
    }
  }

  return mappings
}

// ─── Componente visual ─────────────────────────────────

export default function ColumnMapperUI({
  sourceColumns,
  targetFields,
  mappings,
  onMappingChange,
}: ColumnMapperUIProps) {
  const getMapping = (targetKey: string) => mappings.find((m) => m.target === targetKey)?.source || ''
  const usedSources = new Set(mappings.map((m) => m.source).filter(Boolean))
  const mappedCount = mappings.filter((m) => m.source).length
  const requiredCount = targetFields.filter((f) => f.required).length
  const requiredMapped = targetFields.filter(
    (f) => f.required && mappings.find((m) => m.target === f.key && m.source),
  ).length

  const handleChange = (targetKey: string, sourceCol: string) => {
    const filtered = mappings.filter((m) => m.target !== targetKey)
    if (sourceCol) {
      filtered.push({ source: sourceCol, target: targetKey })
    }
    onMappingChange(filtered)
  }

  const handleAutoMap = () => {
    const auto = autoMapColumns(sourceColumns, targetFields)
    onMappingChange(auto)
  }

  return (
    <div className="space-y-4">
      {/* Header con stats y botón auto-mapeo */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          <span className={cn('font-medium', requiredMapped === requiredCount ? 'text-success' : 'text-warning')}>
            {mappedCount} de {targetFields.length} campos mapeados
          </span>
          {requiredMapped < requiredCount && (
            <span className="ml-2 text-destructive">
              ({requiredCount - requiredMapped} obligatorio{requiredCount - requiredMapped > 1 ? 's' : ''} sin mapear)
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleAutoMap}
          className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
        >
          <Sparkles size={13} />
          Auto-detectar
        </button>
      </div>

      {/* Tabla de mapeo */}
      <div className="rounded-lg border border-border overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[1fr_28px_1fr] items-center gap-3 border-b border-border bg-muted/50 px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          <span>Campo del sistema</span>
          <span />
          <span>Columna del archivo</span>
        </div>

        {/* Rows */}
        {targetFields.map((field) => {
          const mapped = getMapping(field.key)
          return (
            <div
              key={field.key}
              className={cn(
                'grid grid-cols-[1fr_28px_1fr] items-center gap-3 border-b border-border px-4 py-2.5 last:border-0 transition-colors',
                mapped ? 'bg-success/[0.03]' : '',
              )}
            >
              {/* Campo del sistema */}
              <div className="flex items-center gap-2 min-w-0">
                <div className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px]',
                  mapped
                    ? 'bg-success text-success-foreground'
                    : field.required
                      ? 'bg-destructive/10 text-destructive'
                      : 'bg-muted text-muted-foreground',
                )}>
                  {mapped ? <Check size={11} /> : field.required ? '*' : '—'}
                </div>
                <div className="min-w-0">
                  <span className="text-sm font-medium">{field.label}</span>
                  {field.required && !mapped && (
                    <span className="ml-1.5 text-[10px] text-destructive font-medium">obligatorio</span>
                  )}
                </div>
              </div>

              {/* Flecha */}
              <div className="flex items-center justify-center">
                <ArrowRight size={14} className={mapped ? 'text-success' : 'text-border'} />
              </div>

              {/* Dropdown columna archivo */}
              <select
                value={mapped}
                onChange={(e) => handleChange(field.key, e.target.value)}
                className={cn(
                  'h-8 w-full rounded-md border px-2.5 text-sm outline-none focus:ring-2 focus:ring-ring transition-colors',
                  mapped ? 'border-success/40 bg-success/5' : 'border-input bg-background',
                )}
              >
                <option value="">— Sin mapear —</option>
                {sourceColumns.map((col) => (
                  <option key={col} value={col} disabled={usedSources.has(col) && mapped !== col}>
                    {col}{usedSources.has(col) && mapped !== col ? ' (ya usado)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )
        })}
      </div>
    </div>
  )
}
