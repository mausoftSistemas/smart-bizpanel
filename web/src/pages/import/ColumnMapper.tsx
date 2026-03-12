import { useEffect, useRef, useState } from 'react'
import { Settings2, ChevronDown, ChevronUp, Loader2, CheckCircle, AlertTriangle, Sparkles } from 'lucide-react'
import ColumnMapperUI, { autoMapColumns, type ColumnMapping, type TargetField } from '../../components/ColumnMapperUI'
import api from '../../api/client'

interface AutoMapInfo {
  source: 'saved' | 'similar' | 'ai' | 'none'
  nombre?: string
  confidence: number
  notas?: string
}

interface ColumnMapperProps {
  entityType: string
  sourceColumns: string[]
  sampleData: Record<string, unknown>[]
  mappings: ColumnMapping[]
  onMappingsChange: (mappings: ColumnMapping[]) => void
  defaultValues: Record<string, string>
  onDefaultValuesChange: (defaults: Record<string, string>) => void
}

// Campos exactos del backend (ENTITY_TEMPLATES)
const fieldsByEntity: Record<string, TargetField[]> = {
  productos: [
    { key: 'codigo', label: 'Código', required: true },
    { key: 'nombre', label: 'Nombre / Descripción', required: true },
    { key: 'precioLista', label: 'Precio de lista', required: true },
    { key: 'descripcion', label: 'Descripción larga' },
    { key: 'categoria', label: 'Categoría / Rubro' },
    { key: 'marca', label: 'Marca' },
    { key: 'moneda', label: 'Moneda' },
    { key: 'stockBulto', label: 'Stock (bultos)' },
    { key: 'stockUnidad', label: 'Stock (unidades)' },
    { key: 'equivalencia', label: 'Equivalencia (un. por bulto)' },
    { key: 'unidadMedida', label: 'Unidad de medida' },
    { key: 'ivaPorcentaje', label: 'IVA %' },
    { key: 'codigoBarras', label: 'Código de barras' },
  ],
  clientes: [
    { key: 'codigo', label: 'Código', required: true },
    { key: 'nombre', label: 'Razón social / Nombre', required: true },
    { key: 'cuit', label: 'CUIT / Documento' },
    { key: 'condicionIva', label: 'Condición IVA' },
    { key: 'condicionVenta', label: 'Condición de venta' },
    { key: 'direccion', label: 'Dirección' },
    { key: 'ciudad', label: 'Ciudad / Localidad' },
    { key: 'provincia', label: 'Provincia' },
    { key: 'telefono', label: 'Teléfono' },
    { key: 'email', label: 'Email' },
    { key: 'limiteCredito', label: 'Límite de crédito' },
    { key: 'vendedorCodigo', label: 'Código vendedor' },
  ],
  precios: [
    { key: 'clienteCodigo', label: 'Código de cliente', required: true },
    { key: 'productoCodigo', label: 'Código de producto', required: true },
    { key: 'precioEspecial', label: 'Precio especial', required: true },
    { key: 'descuentoPorcentaje', label: 'Descuento %' },
  ],
  facturas: [
    { key: 'clienteCodigo', label: 'Código de cliente', required: true },
    { key: 'tipo', label: 'Tipo (factura/nc/nd)', required: true },
    { key: 'numero', label: 'Número comprobante', required: true },
    { key: 'fecha', label: 'Fecha', required: true },
    { key: 'monto', label: 'Monto', required: true },
    { key: 'fechaVencimiento', label: 'Fecha vencimiento' },
    { key: 'observaciones', label: 'Observaciones' },
  ],
}

// Valores por defecto sugeridos para campos opcionales
const suggestedDefaults: Record<string, Record<string, { label: string; placeholder: string; defaultValue?: string }>> = {
  productos: {
    moneda: { label: 'Moneda', placeholder: 'Ej: ARS, USD', defaultValue: 'ARS' },
    ivaPorcentaje: { label: 'IVA %', placeholder: 'Ej: 21', defaultValue: '21' },
    unidadMedida: { label: 'Unidad de medida', placeholder: 'Ej: UN, KG, LT', defaultValue: 'UN' },
    equivalencia: { label: 'Equivalencia', placeholder: 'Ej: 1', defaultValue: '1' },
  },
  clientes: {
    condicionIva: { label: 'Condición IVA', placeholder: 'Ej: Responsable Inscripto' },
    condicionVenta: { label: 'Condición de venta', placeholder: 'Ej: Contado' },
  },
  facturas: {
    tipo: { label: 'Tipo', placeholder: 'Ej: factura' },
  },
  precios: {},
}

export default function ColumnMapper({
  entityType,
  sourceColumns,
  sampleData,
  mappings,
  onMappingsChange,
  defaultValues,
  onDefaultValuesChange,
}: ColumnMapperProps) {
  const fields = fieldsByEntity[entityType] || []
  const defaults = suggestedDefaults[entityType] || {}
  const [showDefaults, setShowDefaults] = useState(false)
  const autoMapped = useRef(false)
  const [loadingAutoMap, setLoadingAutoMap] = useState(false)
  const [autoMapInfo, setAutoMapInfo] = useState<AutoMapInfo | null>(null)

  // Auto-mapear al montar: primero intenta API, luego fallback local
  useEffect(() => {
    if (!autoMapped.current && sourceColumns.length > 0 && fields.length > 0) {
      autoMapped.current = true

      const tryAutoMap = async () => {
        setLoadingAutoMap(true)
        try {
          const { data: res } = await api.post('/import/auto-map', {
            entityType,
            columns: sourceColumns,
            sampleData: sampleData?.slice(0, 5),
          })
          const result = res.data
          if (result.source !== 'none' && result.mapping && Object.keys(result.mapping).length > 0) {
            // Convertir { campoSistema: columnaArchivo } a ColumnMapping[]
            const apiMappings: ColumnMapping[] = Object.entries(result.mapping as Record<string, string>).map(
              ([target, source]) => ({ source, target }),
            )
            onMappingsChange(apiMappings)
            if (result.defaultValues) {
              onDefaultValuesChange(result.defaultValues)
            }
            setAutoMapInfo({
              source: result.source,
              nombre: result.nombre,
              confidence: result.confidence,
              notas: result.notas,
            })
          } else {
            // Fallback a auto-map local
            const auto = autoMapColumns(sourceColumns, fields)
            if (auto.length > 0) onMappingsChange(auto)
            setAutoMapInfo(null)
          }
        } catch {
          // Fallback a auto-map local si la API falla
          const auto = autoMapColumns(sourceColumns, fields)
          if (auto.length > 0) onMappingsChange(auto)
          setAutoMapInfo(null)
        } finally {
          setLoadingAutoMap(false)
        }
      }
      tryAutoMap()
    }
  }, [sourceColumns, fields, onMappingsChange]) // eslint-disable-line react-hooks/exhaustive-deps

  // Inicializar defaults sugeridos si no hay ninguno
  useEffect(() => {
    if (Object.keys(defaultValues).length === 0 && Object.keys(defaults).length > 0) {
      const initial: Record<string, string> = {}
      for (const [key, cfg] of Object.entries(defaults)) {
        if (cfg.defaultValue) initial[key] = cfg.defaultValue
      }
      if (Object.keys(initial).length > 0) {
        onDefaultValuesChange(initial)
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Campos sin mapear que tienen defaults configurables
  const unmappedDefaults = Object.entries(defaults).filter(
    ([key]) => !mappings.find((m) => m.target === key && m.source),
  )

  const handleDefaultChange = (key: string, value: string) => {
    const next = { ...defaultValues }
    if (value) {
      next[key] = value
    } else {
      delete next[key]
    }
    onDefaultValuesChange(next)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Mapear columnas</h2>
        <p className="text-sm text-muted-foreground">
          Asociá cada columna de tu archivo con el campo del sistema. Los campos obligatorios están marcados.
        </p>
      </div>

      {/* Banner de auto-mapeo */}
      {loadingAutoMap && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm">
          <Loader2 size={16} className="animate-spin text-primary" />
          Analizando columnas...
        </div>
      )}
      {!loadingAutoMap && autoMapInfo?.source === 'saved' && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
          <CheckCircle size={16} />
          Mapeo encontrado: <strong>{autoMapInfo.nombre}</strong>
        </div>
      )}
      {!loadingAutoMap && autoMapInfo?.source === 'similar' && (
        <div className="flex items-center gap-2 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-200">
          <AlertTriangle size={16} />
          Mapeo similar encontrado — revisá que sea correcto
          {autoMapInfo.nombre && <span className="ml-1 font-medium">({autoMapInfo.nombre})</span>}
        </div>
      )}
      {!loadingAutoMap && autoMapInfo?.source === 'ai' && (
        <div className="flex flex-col gap-1 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200">
          <div className="flex items-center gap-2">
            <Sparkles size={16} />
            La IA sugirió este mapeo (confianza: {Math.round(autoMapInfo.confidence * 100)}%)
          </div>
          {autoMapInfo.notas && <p className="ml-6 text-xs opacity-80">{autoMapInfo.notas}</p>}
        </div>
      )}

      <ColumnMapperUI
        sourceColumns={sourceColumns}
        targetFields={fields}
        mappings={mappings}
        onMappingChange={onMappingsChange}
      />

      {/* Valores por defecto */}
      {unmappedDefaults.length > 0 && (
        <div className="rounded-lg border border-border">
          <button
            type="button"
            onClick={() => setShowDefaults(!showDefaults)}
            className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Settings2 size={15} className="text-muted-foreground" />
              Valores por defecto para campos sin mapear
            </div>
            {showDefaults ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {showDefaults && (
            <div className="border-t border-border px-4 py-3 space-y-3">
              <p className="text-xs text-muted-foreground">
                Estos valores se aplicarán a todas las filas donde el campo no esté mapeado a una columna.
              </p>
              {unmappedDefaults.map(([key, cfg]) => (
                <div key={key} className="flex items-center gap-3">
                  <label className="w-40 text-sm font-medium shrink-0">{cfg.label}</label>
                  <input
                    type="text"
                    value={defaultValues[key] || ''}
                    onChange={(e) => handleDefaultChange(key, e.target.value)}
                    placeholder={cfg.placeholder}
                    className="h-8 flex-1 rounded-md border border-input bg-background px-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
