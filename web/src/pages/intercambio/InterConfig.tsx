import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Settings,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Save,
  Download,
  Upload,
  GripVertical,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import api from '../../api/client'
import { cn } from '../../lib/utils'

// ─── Tipos ─────────────────────────────────────────────

interface ArchivoConfig {
  id?: string
  direccion: string
  nombre: string
  nombreArchivo: string
  entidad: string
  esDetalle: boolean
  archivoPadreId?: string
  campoRelacion?: string
  formatoArchivo: string
  separador: string
  encoding: string
  tieneEncabezado: boolean
  saltarFilas: number
  formatoFecha: string
  separadorDecimal: string
  mapeoColumnas: Record<string, string>
  valoresDefault?: Record<string, unknown>
  actualizarExist: boolean
  campoUnico: string
  soloNuevos: boolean
  filtroEstado?: string
  orden: number
}

interface IntercambioConfig {
  id: string
  nombre: string
  activo: boolean
  archivos: ArchivoConfig[]
}

const ENTIDAD_OPTIONS_IMPORT = [
  'productos', 'clientes', 'clientesTelefono', 'condicionesVenta',
  'cuentaCorriente', 'motivosNoCompra', 'rutas', 'vendedores',
]

const ENTIDAD_OPTIONS_EXPORT = [
  'pedidosCabecera', 'pedidosDetalle', 'cobranzasCabecera',
  'cobranzasDetallePagos', 'cobranzasDocImputados', 'excusas',
]

const ENCODING_OPTIONS = ['latin1', 'utf-8', 'windows-1252']
const SEPARADOR_OPTIONS = [
  { value: ';', label: 'Punto y coma (;)' },
  { value: ',', label: 'Coma (,)' },
  { value: '|', label: 'Pipe (|)' },
  { value: '\t', label: 'Tab' },
]
const FORMATO_FECHA_OPTIONS = ['yyyyMMdd', 'dd/MM/yyyy', 'dd-MM-yyyy', 'yyyy-MM-dd', 'ddMMyyyy']

// ─── Componente Principal ──────────────────────────────

export default function InterConfig() {
  const queryClient = useQueryClient()

  const { data: configs, isLoading } = useQuery({
    queryKey: ['intercambio-config'],
    queryFn: async () => {
      const { data: res } = await api.get('/intercambio/config')
      return res.data as IntercambioConfig[]
    },
  })

  const [selectedConfig, setSelectedConfig] = useState<IntercambioConfig | null>(null)
  const [nombre, setNombre] = useState('')
  const [importFiles, setImportFiles] = useState<ArchivoConfig[]>([])
  const [exportFiles, setExportFiles] = useState<ArchivoConfig[]>([])

  useEffect(() => {
    if (configs && configs.length > 0 && !selectedConfig) {
      selectConfig(configs[0])
    }
  }, [configs]) // eslint-disable-line react-hooks/exhaustive-deps

  const selectConfig = (config: IntercambioConfig) => {
    setSelectedConfig(config)
    setNombre(config.nombre)
    setImportFiles(config.archivos.filter((a) => a.direccion === 'import'))
    setExportFiles(config.archivos.filter((a) => a.direccion === 'export'))
  }

  const createNew = () => {
    setSelectedConfig(null)
    setNombre('Nueva Configuración')
    setImportFiles(defaultImportFiles())
    setExportFiles(defaultExportFiles())
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const archivos = [
        ...importFiles.map((f, i) => ({ ...f, orden: i })),
        ...exportFiles.map((f, i) => ({ ...f, orden: i })),
      ]
      const { data: res } = await api.post('/intercambio/config', {
        id: selectedConfig?.id || undefined,
        nombre,
        archivos,
      })
      return res.data as IntercambioConfig
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['intercambio-config'] })
      setSelectedConfig(data)
      toast.success('Configuración guardada')
    },
    onError: () => toast.error('Error al guardar'),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/intercambio/config/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['intercambio-config'] })
      setSelectedConfig(null)
      setNombre('')
      setImportFiles([])
      setExportFiles([])
      toast.success('Configuración eliminada')
    },
    onError: () => toast.error('Error al eliminar'),
  })

  const exportConfigJson = () => {
    const data = {
      nombre,
      archivos: [...importFiles, ...exportFiles],
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `config_${nombre.replace(/\s+/g, '_').toLowerCase()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Configuración de Intercambio</h1>
          <p className="text-sm text-muted-foreground">Configurá cómo son los archivos de tu ERP</p>
        </div>
        <button
          onClick={createNew}
          className="flex items-center gap-1.5 rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-black/90 transition-colors"
        >
          <Plus size={16} /> Nueva Config
        </button>
      </div>

      {/* Selector de config */}
      {configs && configs.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {configs.map((c) => (
            <button
              key={c.id}
              onClick={() => selectConfig(c)}
              className={cn(
                'rounded-lg border px-3 py-1.5 text-sm transition-colors',
                selectedConfig?.id === c.id
                  ? 'border-primary bg-primary/10 font-medium'
                  : 'border-border hover:bg-muted',
              )}
            >
              {c.nombre}
            </button>
          ))}
        </div>
      )}

      {/* Editor */}
      {(selectedConfig || importFiles.length > 0 || exportFiles.length > 0) && (
        <div className="space-y-6">
          {/* Nombre */}
          <div>
            <label className="mb-1 block text-sm font-medium">Nombre de la configuración</label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="h-9 w-full max-w-md rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Card Import */}
          <div className="rounded-lg border border-border">
            <div className="flex items-center justify-between border-b bg-muted/50 px-4 py-3">
              <div>
                <div className="flex items-center gap-2">
                  <Upload size={16} className="text-green-600" />
                  <h2 className="text-sm font-semibold">Archivos de ENTRADA (ERP a BizVentas)</h2>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">Configurá cómo son los archivos que exporta tu sistema</p>
              </div>
              <button
                onClick={() => setImportFiles([...importFiles, createEmptyFile('import', importFiles.length)])}
                className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs hover:bg-muted transition-colors"
              >
                <Plus size={12} /> Agregar
              </button>
            </div>
            <div className="divide-y">
              {importFiles.map((file, idx) => (
                <FileConfigRow
                  key={idx}
                  file={file}
                  index={idx}
                  allFiles={importFiles}
                  entidadOptions={ENTIDAD_OPTIONS_IMPORT}
                  onChange={(updated) => {
                    const copy = [...importFiles]
                    copy[idx] = updated
                    setImportFiles(copy)
                  }}
                  onRemove={() => setImportFiles(importFiles.filter((_, i) => i !== idx))}
                />
              ))}
              {importFiles.length === 0 && (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">No hay archivos de entrada configurados</p>
              )}
            </div>
          </div>

          {/* Card Export */}
          <div className="rounded-lg border border-border">
            <div className="flex items-center justify-between border-b bg-muted/50 px-4 py-3">
              <div>
                <div className="flex items-center gap-2">
                  <Download size={16} className="text-blue-600" />
                  <h2 className="text-sm font-semibold">Archivos de SALIDA (BizVentas a ERP)</h2>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">Configurá cómo necesita tu sistema recibir los datos</p>
              </div>
              <button
                onClick={() => setExportFiles([...exportFiles, createEmptyFile('export', exportFiles.length)])}
                className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs hover:bg-muted transition-colors"
              >
                <Plus size={12} /> Agregar
              </button>
            </div>
            <div className="divide-y">
              {exportFiles.map((file, idx) => (
                <FileConfigRow
                  key={idx}
                  file={file}
                  index={idx}
                  allFiles={exportFiles}
                  entidadOptions={ENTIDAD_OPTIONS_EXPORT}
                  onChange={(updated) => {
                    const copy = [...exportFiles]
                    copy[idx] = updated
                    setExportFiles(copy)
                  }}
                  onRemove={() => setExportFiles(exportFiles.filter((_, i) => i !== idx))}
                />
              ))}
              {exportFiles.length === 0 && (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">No hay archivos de salida configurados</p>
              )}
            </div>
          </div>

          {/* Acciones */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !nombre.trim()}
              className="flex items-center gap-2 rounded-lg bg-black px-5 py-2.5 text-sm font-medium text-white hover:bg-black/90 disabled:opacity-50 transition-colors"
            >
              {saveMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Guardar Configuración
            </button>
            <button
              onClick={exportConfigJson}
              className="flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm hover:bg-muted transition-colors"
            >
              <Download size={16} /> Exportar JSON
            </button>
            {selectedConfig && (
              <button
                onClick={() => { if (confirm('Eliminar esta configuración?')) deleteMutation.mutate(selectedConfig.id) }}
                className="flex items-center gap-2 rounded-lg border border-destructive/30 px-4 py-2.5 text-sm text-destructive hover:bg-destructive/10 transition-colors"
              >
                <Trash2 size={16} /> Eliminar
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── FileConfigRow ─────────────────────────────────────

function FileConfigRow({
  file,
  index,
  allFiles,
  entidadOptions,
  onChange,
  onRemove,
}: {
  file: ArchivoConfig
  index: number
  allFiles: ArchivoConfig[]
  entidadOptions: string[]
  onChange: (updated: ArchivoConfig) => void
  onRemove: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [newColKey, setNewColKey] = useState('')
  const [newColValue, setNewColValue] = useState('')

  const update = (partial: Partial<ArchivoConfig>) => {
    onChange({ ...file, ...partial })
  }

  const addColumn = () => {
    if (!newColKey.trim() || !newColValue.trim()) return
    const mapeo = { ...file.mapeoColumnas, [newColKey.trim()]: newColValue.trim() }
    update({ mapeoColumnas: mapeo })
    setNewColKey('')
    setNewColValue('')
  }

  const removeColumn = (key: string) => {
    const mapeo = { ...file.mapeoColumnas }
    delete mapeo[key]
    update({ mapeoColumnas: mapeo })
  }

  return (
    <div className="px-4 py-3">
      {/* Header row */}
      <div className="flex items-center gap-3">
        <GripVertical size={14} className="cursor-grab text-muted-foreground" />
        <span className="w-5 text-center text-xs text-muted-foreground">{index + 1}</span>
        <button onClick={() => setExpanded(!expanded)} className="text-muted-foreground">
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>

        <input
          type="text"
          value={file.nombre}
          onChange={(e) => update({ nombre: e.target.value })}
          placeholder="Nombre"
          className="h-7 w-32 rounded border border-input bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-ring"
        />

        <select
          value={file.entidad}
          onChange={(e) => update({ entidad: e.target.value })}
          className="h-7 rounded border border-input bg-background px-1.5 text-xs outline-none"
        >
          <option value="">Entidad</option>
          {entidadOptions.map((e) => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>

        <input
          type="text"
          value={file.nombreArchivo}
          onChange={(e) => update({ nombreArchivo: e.target.value })}
          placeholder="ARCHIVO.TXT"
          className="h-7 w-40 rounded border border-input bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-ring"
        />

        <select
          value={file.separador}
          onChange={(e) => update({ separador: e.target.value })}
          className="h-7 rounded border border-input bg-background px-1.5 text-xs outline-none"
        >
          {SEPARADOR_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>

        <select
          value={file.encoding}
          onChange={(e) => update({ encoding: e.target.value })}
          className="h-7 rounded border border-input bg-background px-1.5 text-xs outline-none"
        >
          {ENCODING_OPTIONS.map((e) => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>

        <span className="text-xs text-muted-foreground">
          {Object.keys(file.mapeoColumnas).length} cols
        </span>

        <button onClick={onRemove} className="ml-auto text-muted-foreground hover:text-destructive transition-colors">
          <Trash2 size={14} />
        </button>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="mt-3 ml-12 space-y-3">
          {/* Opciones de formato */}
          <div className="flex flex-wrap gap-4 text-xs">
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={file.tieneEncabezado} onChange={(e) => update({ tieneEncabezado: e.target.checked })} className="rounded" />
              Con encabezado
            </label>
            <label className="flex items-center gap-1.5">
              Formato fecha:
              <select value={file.formatoFecha} onChange={(e) => update({ formatoFecha: e.target.value })} className="h-6 rounded border border-input bg-background px-1 text-xs">
                {FORMATO_FECHA_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-1.5">
              Sep. decimal:
              <select value={file.separadorDecimal} onChange={(e) => update({ separadorDecimal: e.target.value })} className="h-6 rounded border border-input bg-background px-1 text-xs">
                <option value=".">Punto (.)</option>
                <option value=",">Coma (,)</option>
              </select>
            </label>
            {file.direccion === 'import' && (
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={file.actualizarExist} onChange={(e) => update({ actualizarExist: e.target.checked })} className="rounded" />
                Actualizar existentes
              </label>
            )}
            {file.direccion === 'export' && (
              <>
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" checked={file.esDetalle} onChange={(e) => update({ esDetalle: e.target.checked })} className="rounded" />
                  Es detalle
                </label>
                {file.esDetalle && (
                  <>
                    <label className="flex items-center gap-1.5">
                      Padre:
                      <select value={file.archivoPadreId || ''} onChange={(e) => update({ archivoPadreId: e.target.value || undefined })} className="h-6 rounded border border-input bg-background px-1 text-xs">
                        <option value="">Seleccionar</option>
                        {allFiles.filter((_, i) => i !== index).map((f, i) => (
                          <option key={i} value={f.nombre}>{f.nombre}</option>
                        ))}
                      </select>
                    </label>
                    <label className="flex items-center gap-1.5">
                      Campo relación:
                      <input type="text" value={file.campoRelacion || ''} onChange={(e) => update({ campoRelacion: e.target.value })} placeholder="NRO_PED" className="h-6 w-24 rounded border border-input bg-background px-1 text-xs" />
                    </label>
                  </>
                )}
              </>
            )}
          </div>

          {/* Tabla de mapeo */}
          <div className="rounded border border-border">
            <div className="grid grid-cols-[1fr_1fr_40px] gap-2 border-b bg-muted/50 px-3 py-1.5 text-[10px] font-medium text-muted-foreground uppercase">
              <span>{file.direccion === 'import' ? 'Campo Sistema' : 'Columna ERP'}</span>
              <span>{file.direccion === 'import' ? 'Columna Archivo' : 'Campo Sistema'}</span>
              <span />
            </div>
            {Object.entries(file.mapeoColumnas).map(([key, val]) => (
              <div key={key} className="grid grid-cols-[1fr_1fr_40px] items-center gap-2 border-b last:border-0 px-3 py-1.5">
                <span className="text-xs font-mono">{key}</span>
                <span className="text-xs font-mono text-muted-foreground">{val}</span>
                <button onClick={() => removeColumn(key)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
            {/* Agregar columna */}
            <div className="grid grid-cols-[1fr_1fr_40px] items-center gap-2 px-3 py-1.5">
              <input
                type="text"
                value={newColKey}
                onChange={(e) => setNewColKey(e.target.value)}
                placeholder={file.direccion === 'import' ? 'campoLocal' : 'COL_ERP'}
                className="h-6 rounded border border-input bg-background px-1 text-xs outline-none"
              />
              <input
                type="text"
                value={newColValue}
                onChange={(e) => setNewColValue(e.target.value)}
                placeholder={file.direccion === 'import' ? 'COL_ARCHIVO' : 'campoLocal'}
                className="h-6 rounded border border-input bg-background px-1 text-xs outline-none"
                onKeyDown={(e) => e.key === 'Enter' && addColumn()}
              />
              <button onClick={addColumn} className="text-primary hover:text-primary/80">
                <Plus size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Defaults ──────────────────────────────────────────

function createEmptyFile(direccion: string, orden: number): ArchivoConfig {
  return {
    direccion,
    nombre: '',
    nombreArchivo: '',
    entidad: '',
    esDetalle: false,
    formatoArchivo: 'txt',
    separador: ';',
    encoding: 'latin1',
    tieneEncabezado: true,
    saltarFilas: 0,
    formatoFecha: 'yyyyMMdd',
    separadorDecimal: '.',
    mapeoColumnas: {},
    actualizarExist: true,
    campoUnico: 'codigo',
    soloNuevos: true,
    orden,
  }
}

function defaultImportFiles(): ArchivoConfig[] {
  return [
    { ...createEmptyFile('import', 0), nombre: 'Vendedores', nombreArchivo: 'VENDEDOR.TXT', entidad: 'vendedores' },
    { ...createEmptyFile('import', 1), nombre: 'Cond. Venta', nombreArchivo: 'COND_VENTA.TXT', entidad: 'condicionesVenta' },
    { ...createEmptyFile('import', 2), nombre: 'Motivos', nombreArchivo: 'MOTIVO_NO_COMPRA.TXT', entidad: 'motivosNoCompra' },
    { ...createEmptyFile('import', 3), nombre: 'Clientes', nombreArchivo: 'CLIENTES.TXT', entidad: 'clientes' },
    { ...createEmptyFile('import', 4), nombre: 'Tel. Clientes', nombreArchivo: 'CLIENTES_TELEFONO.TXT', entidad: 'clientesTelefono' },
    { ...createEmptyFile('import', 5), nombre: 'Rutas', nombreArchivo: 'RUTAS.TXT', entidad: 'rutas' },
    { ...createEmptyFile('import', 6), nombre: 'Artículos', nombreArchivo: 'ARTICULOS.TXT', entidad: 'productos' },
    { ...createEmptyFile('import', 7), nombre: 'Cta Corriente', nombreArchivo: 'CTACTE.TXT', entidad: 'cuentaCorriente' },
  ]
}

function defaultExportFiles(): ArchivoConfig[] {
  return [
    { ...createEmptyFile('export', 0), nombre: 'Cabecera Pedidos', nombreArchivo: 'CabeceraPedidos.txt', entidad: 'pedidosCabecera' },
    { ...createEmptyFile('export', 1), nombre: 'Detalle Pedidos', nombreArchivo: 'DetallePedidos.txt', entidad: 'pedidosDetalle', esDetalle: true, archivoPadreId: 'Cabecera Pedidos', campoRelacion: 'NRO_PED' },
    { ...createEmptyFile('export', 2), nombre: 'Cobranzas', nombreArchivo: 'Cobranzas.txt', entidad: 'cobranzasCabecera' },
    { ...createEmptyFile('export', 3), nombre: 'Detalle Pagos', nombreArchivo: 'DetallePagos.txt', entidad: 'cobranzasDetallePagos', esDetalle: true, archivoPadreId: 'Cobranzas', campoRelacion: 'NRO_COB' },
    { ...createEmptyFile('export', 4), nombre: 'Doc Imputados', nombreArchivo: 'DocImputados.txt', entidad: 'cobranzasDocImputados', esDetalle: true, archivoPadreId: 'Cobranzas', campoRelacion: 'NRO_COB' },
    { ...createEmptyFile('export', 5), nombre: 'Excusas', nombreArchivo: 'ExcusasS.txt', entidad: 'excusas' },
  ]
}
