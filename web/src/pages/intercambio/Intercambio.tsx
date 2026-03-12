import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  Upload,
  Download,
  FileText,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Archive,
  Calendar,
} from 'lucide-react'
import { toast } from 'sonner'
import api from '../../api/client'
import { cn, formatDate } from '../../lib/utils'

// ─── Tipos ─────────────────────────────────────────────

interface UploadedFile {
  fileId: string
  fileName: string
  columns: string[]
  rows: number
  configEncontrada: { id: string; nombre: string } | null
  mappingSugerido: { source: string; mapping: Record<string, string> } | null
  estado: 'listo' | 'pendiente'
  // Estado local para entidad seleccionada
  entidad?: string
}

interface BatchResult {
  archivo: string
  entidad: string
  importados: number
  actualizados: number
  errores: number
  detalleErrores?: string[]
}

interface ExportPreview {
  pedidos: { cabeceras: number; items: number; nuevos: number }
  cobranzas: { cabeceras: number; mediosPago: number; docImputados: number; nuevas: number }
  excusas: { total: number; nuevas: number }
}

interface ExportLog {
  id: string
  archivos: { nombre: string; bytes: number }[]
  createdAt: string
}

// ─── Constantes ────────────────────────────────────────

const ENTIDAD_OPTIONS = [
  { value: 'productos', label: 'Productos' },
  { value: 'clientes', label: 'Clientes' },
  { value: 'clientesTelefono', label: 'Tel. Clientes' },
  { value: 'condicionesVenta', label: 'Cond. Venta' },
  { value: 'cuentaCorriente', label: 'Cta Corriente' },
  { value: 'motivosNoCompra', label: 'Motivos' },
  { value: 'rutas', label: 'Rutas' },
  { value: 'vendedores', label: 'Vendedores' },
]

// ─── Componente Principal ──────────────────────────────

export default function Intercambio() {
  const [activeTab, setActiveTab] = useState<'import' | 'export'>('import')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Intercambio con ERP</h1>
        <p className="text-sm text-muted-foreground">Subí archivos del ERP o bajá datos para importar al ERP</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-muted p-1">
        <button
          onClick={() => setActiveTab('import')}
          className={cn(
            'flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors',
            activeTab === 'import' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Upload size={16} /> Subir al Sistema
        </button>
        <button
          onClick={() => setActiveTab('export')}
          className={cn(
            'flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors',
            activeTab === 'export' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Download size={16} /> Bajar para el ERP
        </button>
      </div>

      {activeTab === 'import' ? <ImportTab /> : <ExportTab />}
    </div>
  )
}

// ═══ TAB IMPORT ════════════════════════════════════════

function ImportTab() {
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [results, setResults] = useState<BatchResult[] | null>(null)
  const [processingTime, setProcessingTime] = useState('')
  const [guardarConfig, setGuardarConfig] = useState(true)
  const [nombreConfig, setNombreConfig] = useState('')

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const { data: res } = await api.post('/intercambio/import/upload-batch', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return res.data.archivos as UploadedFile[]
    },
    onSuccess: (data) => {
      setFiles(data.map((f) => ({
        ...f,
        entidad: f.configEncontrada ? undefined : guessEntidad(f.fileName),
      })))
      setResults(null)
    },
    onError: () => toast.error('Error al subir archivos'),
  })

  const processMutation = useMutation({
    mutationFn: async () => {
      const archivos = files.map((f) => ({
        fileId: f.fileId,
        entidad: f.entidad || guessEntidad(f.fileName) || 'productos',
        mapping: f.mappingSugerido?.mapping || {},
      }))
      const { data: res } = await api.post('/intercambio/import/process-batch', {
        archivos,
        guardarConfig,
        nombreConfig: nombreConfig || 'Config ERP',
      })
      return res.data as { resultados: BatchResult[]; tiempoProcesamiento: string }
    },
    onSuccess: (data) => {
      setResults(data.resultados)
      setProcessingTime(data.tiempoProcesamiento)
      const totalImported = data.resultados.reduce((s, r) => s + r.importados + r.actualizados, 0)
      const totalErrors = data.resultados.reduce((s, r) => s + r.errores, 0)
      toast.success(`${data.resultados.length} archivos procesados: ${totalImported} registros, ${totalErrors} errores`)
    },
    onError: () => toast.error('Error al procesar archivos'),
  })

  const onDrop = useCallback(
    (accepted: File[]) => {
      if (accepted.length === 0) return
      const formData = new FormData()
      for (const f of accepted) {
        formData.append('archivos', f)
      }
      uploadMutation.mutate(formData)
    },
    [uploadMutation],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'text/plain': ['.txt'],
      'application/json': ['.json'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    },
    multiple: true,
  })

  const allReady = files.length > 0 && files.every((f) => f.estado === 'listo' || f.mappingSugerido)
  const isLoading = uploadMutation.isPending || processMutation.isPending

  return (
    <div className="space-y-4">
      {/* Dropzone */}
      {files.length === 0 && !results && (
        <div
          {...getRootProps()}
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-10 transition-colors',
            isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/30',
          )}
        >
          <input {...getInputProps()} />
          {uploadMutation.isPending ? (
            <Loader2 size={36} className="mb-3 animate-spin text-primary" />
          ) : (
            <Upload size={36} className={cn('mb-3', isDragActive ? 'text-primary' : 'text-muted-foreground')} />
          )}
          <p className="text-sm font-medium">
            {uploadMutation.isPending
              ? 'Analizando archivos...'
              : 'Arrastrá los archivos que exportaste del ERP (podés subir todos juntos)'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">TXT, CSV, XLSX, JSON</p>
        </div>
      )}

      {/* Tabla de archivos subidos */}
      {files.length > 0 && !results && (
        <div className="space-y-4">
          <div className="rounded-lg border border-border">
            <div className="grid grid-cols-[1fr_120px_80px_180px_100px] gap-2 border-b bg-muted/50 px-4 py-2 text-xs font-medium text-muted-foreground">
              <span>Archivo</span>
              <span>Entidad</span>
              <span>Filas</span>
              <span>Mapeo</span>
              <span>Estado</span>
            </div>
            {files.map((f, i) => (
              <div key={f.fileId} className="grid grid-cols-[1fr_120px_80px_180px_100px] items-center gap-2 border-b last:border-0 px-4 py-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText size={16} className="shrink-0 text-muted-foreground" />
                  <span className="text-sm font-medium truncate">{f.fileName}</span>
                </div>
                <select
                  value={f.entidad || guessEntidad(f.fileName) || ''}
                  onChange={(e) => {
                    const updated = [...files]
                    updated[i] = { ...f, entidad: e.target.value }
                    setFiles(updated)
                  }}
                  className="h-7 rounded border border-input bg-background px-1.5 text-xs outline-none"
                >
                  <option value="">Seleccionar</option>
                  {ENTIDAD_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <span className="text-sm text-muted-foreground">{f.rows.toLocaleString()}</span>
                <div className="flex items-center gap-1.5">
                  {f.configEncontrada ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700">
                      <CheckCircle size={10} /> {f.configEncontrada.nombre}
                    </span>
                  ) : f.mappingSugerido ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                      <CheckCircle size={10} /> {f.mappingSugerido.source}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-medium text-yellow-700">
                      <AlertTriangle size={10} /> Sin mapeo
                    </span>
                  )}
                </div>
                <span
                  className={cn(
                    'inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium',
                    f.estado === 'listo' || f.mappingSugerido
                      ? 'bg-green-100 text-green-700'
                      : 'bg-yellow-100 text-yellow-700',
                  )}
                >
                  {f.estado === 'listo' || f.mappingSugerido ? 'Listo' : 'Pendiente'}
                </span>
              </div>
            ))}
          </div>

          {/* Opciones */}
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={guardarConfig}
                onChange={(e) => setGuardarConfig(e.target.checked)}
                className="rounded"
              />
              Guardar configuración
            </label>
            {guardarConfig && (
              <input
                type="text"
                value={nombreConfig}
                onChange={(e) => setNombreConfig(e.target.value)}
                placeholder="Nombre (ej: Config Tango)"
                className="h-8 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            )}
          </div>

          {/* Acciones */}
          <div className="flex gap-3">
            <button
              onClick={() => processMutation.mutate()}
              disabled={!allReady || isLoading}
              className="flex items-center gap-2 rounded-lg bg-black px-5 py-2.5 text-sm font-medium text-white hover:bg-black/90 disabled:opacity-50 transition-colors"
            >
              {processMutation.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <CheckCircle size={16} />
              )}
              Procesar Todo
            </button>
            <button
              onClick={() => { setFiles([]); setResults(null) }}
              className="rounded-lg border border-border px-4 py-2.5 text-sm hover:bg-muted transition-colors"
            >
              Cancelar
            </button>
          </div>

          {/* Progress */}
          {processMutation.isPending && (
            <div className="rounded-lg bg-blue-50 p-4">
              <div className="flex items-center gap-3">
                <Loader2 size={20} className="animate-spin text-blue-600" />
                <p className="text-sm font-medium text-blue-700">Procesando archivos en orden de dependencias...</p>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-blue-200">
                <div className="h-full animate-pulse rounded-full bg-blue-500" style={{ width: '60%' }} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Resultados */}
      {results && (
        <div className="space-y-4">
          <div className="rounded-lg border border-green-200 bg-green-50 p-4">
            <p className="text-sm font-medium text-green-800">
              {results.length} archivos procesados en {processingTime}:{' '}
              {results.reduce((s, r) => s + r.importados, 0)} importados,{' '}
              {results.reduce((s, r) => s + r.actualizados, 0)} actualizados,{' '}
              {results.reduce((s, r) => s + r.errores, 0)} errores
            </p>
          </div>

          <div className="rounded-lg border border-border">
            <div className="grid grid-cols-[1fr_120px_100px_100px_80px] gap-2 border-b bg-muted/50 px-4 py-2 text-xs font-medium text-muted-foreground">
              <span>Entidad</span>
              <span>Importados</span>
              <span>Actualizados</span>
              <span>Errores</span>
              <span>Estado</span>
            </div>
            {results.map((r) => (
              <div key={r.entidad} className="grid grid-cols-[1fr_120px_100px_100px_80px] items-center gap-2 border-b last:border-0 px-4 py-2.5">
                <span className="text-sm font-medium capitalize">{r.entidad}</span>
                <span className="text-sm text-green-600">{r.importados}</span>
                <span className="text-sm text-blue-600">{r.actualizados}</span>
                <span className={cn('text-sm', r.errores > 0 ? 'text-red-600 font-medium' : 'text-muted-foreground')}>{r.errores}</span>
                <span className={cn(
                  'inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium',
                  r.errores > 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700',
                )}>
                  {r.errores > 0 ? 'Parcial' : 'OK'}
                </span>
              </div>
            ))}
          </div>

          <button
            onClick={() => { setFiles([]); setResults(null) }}
            className="rounded-lg border border-border px-4 py-2.5 text-sm hover:bg-muted transition-colors"
          >
            Nueva importación
          </button>
        </div>
      )}
    </div>
  )
}

// ═══ TAB EXPORT ════════════════════════════════════════

function ExportTab() {
  const today = new Date()
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
  const [desde, setDesde] = useState(weekAgo.toISOString().slice(0, 10))
  const [hasta, setHasta] = useState(today.toISOString().slice(0, 10))
  const [soloNuevos, setSoloNuevos] = useState(true)
  const [incluirPedidos, setIncluirPedidos] = useState(true)
  const [incluirCobranzas, setIncluirCobranzas] = useState(true)
  const [incluirExcusas, setIncluirExcusas] = useState(true)

  const { data: preview, isLoading: loadingPreview } = useQuery({
    queryKey: ['intercambio-export-preview', desde, hasta],
    queryFn: async () => {
      const { data: res } = await api.get(`/intercambio/export/preview?desde=${desde}&hasta=${hasta}`)
      return res.data as ExportPreview
    },
  })

  const { data: history } = useQuery({
    queryKey: ['intercambio-export-history'],
    queryFn: async () => {
      const { data: res } = await api.get('/intercambio/export/history?limit=10')
      return res.data as ExportLog[]
    },
  })

  const generateMutation = useMutation({
    mutationFn: async () => {
      const entidades: string[] = []
      if (incluirPedidos) entidades.push('pedidos')
      if (incluirCobranzas) entidades.push('cobranzas')
      if (incluirExcusas) entidades.push('excusas')

      const response = await api.post(
        '/intercambio/export/generate',
        { entidades, desde, hasta, soloNuevos },
        { responseType: 'blob' },
      )

      // Descargar ZIP
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      const dateStr = hasta.replace(/-/g, '')
      link.download = `export_${dateStr}.zip`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    },
    onSuccess: () => toast.success('Export generado y descargado'),
    onError: () => toast.error('Error al generar export'),
  })

  const downloadPrevious = async (logId: string) => {
    try {
      const response = await api.get(`/intercambio/export/download/${logId}`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.download = `export_${logId.substring(0, 8)}.zip`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch {
      toast.error('Export expirado o no disponible')
    }
  }

  const previewRows = [
    {
      nombre: 'CabeceraPedidos.txt',
      registros: preview?.pedidos.cabeceras || 0,
      nuevos: preview?.pedidos.nuevos || 0,
      checked: incluirPedidos,
      toggle: () => setIncluirPedidos(!incluirPedidos),
      linked: false,
    },
    {
      nombre: 'DetallePedidos.txt',
      registros: preview?.pedidos.items || 0,
      nuevos: 0,
      checked: incluirPedidos,
      toggle: () => setIncluirPedidos(!incluirPedidos),
      linked: true,
    },
    {
      nombre: 'Cobranzas.txt',
      registros: preview?.cobranzas.cabeceras || 0,
      nuevos: preview?.cobranzas.nuevas || 0,
      checked: incluirCobranzas,
      toggle: () => setIncluirCobranzas(!incluirCobranzas),
      linked: false,
    },
    {
      nombre: 'DetallePagos.txt',
      registros: preview?.cobranzas.mediosPago || 0,
      nuevos: 0,
      checked: incluirCobranzas,
      toggle: () => setIncluirCobranzas(!incluirCobranzas),
      linked: true,
    },
    {
      nombre: 'DocImputados.txt',
      registros: preview?.cobranzas.docImputados || 0,
      nuevos: 0,
      checked: incluirCobranzas,
      toggle: () => setIncluirCobranzas(!incluirCobranzas),
      linked: true,
    },
    {
      nombre: 'ExcusasS.txt',
      registros: preview?.excusas.total || 0,
      nuevos: preview?.excusas.nuevas || 0,
      checked: incluirExcusas,
      toggle: () => setIncluirExcusas(!incluirExcusas),
      linked: false,
    },
  ]

  return (
    <div className="space-y-4">
      {/* Date range */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-muted-foreground" />
          <label className="text-sm text-muted-foreground">Desde</label>
          <input
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            className="h-9 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">Hasta</label>
          <input
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            className="h-9 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      {/* Preview table */}
      <div className="rounded-lg border border-border">
        <div className="grid grid-cols-[1fr_100px_100px_60px] gap-2 border-b bg-muted/50 px-4 py-2 text-xs font-medium text-muted-foreground">
          <span>Archivo</span>
          <span>Registros</span>
          <span>Nuevos</span>
          <span>Incluir</span>
        </div>
        {loadingPreview ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={20} className="animate-spin text-muted-foreground" />
          </div>
        ) : (
          previewRows.map((row) => (
            <div key={row.nombre} className="grid grid-cols-[1fr_100px_100px_60px] items-center gap-2 border-b last:border-0 px-4 py-2.5">
              <div className="flex items-center gap-2">
                {row.linked && <span className="ml-4 text-xs text-muted-foreground">└─</span>}
                <FileText size={14} className="text-muted-foreground" />
                <span className={cn('text-sm', row.linked ? 'text-muted-foreground' : 'font-medium')}>{row.nombre}</span>
              </div>
              <span className="text-sm">{row.registros}</span>
              <span className={cn('text-sm', row.nuevos > 0 ? 'font-medium text-green-600' : 'text-muted-foreground')}>
                {row.nuevos || '—'}
              </span>
              <input
                type="checkbox"
                checked={row.checked}
                onChange={row.toggle}
                disabled={row.linked}
                className="rounded"
              />
            </div>
          ))
        )}
      </div>

      {/* Opciones y acción */}
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={soloNuevos}
            onChange={(e) => setSoloNuevos(e.target.checked)}
            className="rounded"
          />
          Solo registros nuevos (no exportados)
        </label>

        <button
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending || (!incluirPedidos && !incluirCobranzas && !incluirExcusas)}
          className="flex items-center gap-2 rounded-lg bg-black px-5 py-2.5 text-sm font-medium text-white hover:bg-black/90 disabled:opacity-50 transition-colors"
        >
          {generateMutation.isPending ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Archive size={16} />
          )}
          Generar y Descargar ZIP
        </button>
      </div>

      {/* Historial de descargas */}
      {history && history.length > 0 && (
        <div className="rounded-lg border border-border">
          <div className="border-b bg-muted/50 px-4 py-2">
            <p className="text-xs font-medium text-muted-foreground">Últimas descargas</p>
          </div>
          {history.map((log) => {
            const archivos = (log.archivos || []) as { nombre: string; bytes: number }[]
            const totalBytes = archivos.reduce((s, a) => s + (a.bytes || 0), 0)
            return (
              <div key={log.id} className="flex items-center gap-4 border-b last:border-0 px-4 py-2.5">
                <span className="text-sm text-muted-foreground">{formatDate(log.createdAt)}</span>
                <span className="text-sm">{archivos.length} archivos</span>
                <span className="text-xs text-muted-foreground">{(totalBytes / 1024).toFixed(0)} KB</span>
                <button
                  onClick={() => downloadPrevious(log.id)}
                  className="ml-auto text-xs font-medium text-primary hover:underline"
                >
                  Descargar
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Helpers ───────────────────────────────────────────

function guessEntidad(fileName: string): string | undefined {
  const name = fileName.toUpperCase().replace(/\.[^.]+$/, '')
  const map: Record<string, string> = {
    ARTICULOS: 'productos',
    PRODUCTOS: 'productos',
    CLIENTES: 'clientes',
    CLIENTES_TELEFONO: 'clientesTelefono',
    COND_VENTA: 'condicionesVenta',
    CONDVENTA: 'condicionesVenta',
    CTACTE: 'cuentaCorriente',
    CTA_CTE: 'cuentaCorriente',
    MOTIVO_NO_COMPRA: 'motivosNoCompra',
    MOTIVONOCOMPRA: 'motivosNoCompra',
    RUTAS: 'rutas',
    VENDEDOR: 'vendedores',
    VENDEDORES: 'vendedores',
  }
  return map[name]
}
