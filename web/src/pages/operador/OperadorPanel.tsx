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
  LogOut,
} from 'lucide-react'
import { toast } from 'sonner'
import api from '../../api/client'
import { useAuth } from '../../hooks/useAuth'
import { cn, formatDate } from '../../lib/utils'
import { useNavigate } from 'react-router-dom'

// ─── Tipos ─────────────────────────────────────────────

interface UploadedFile {
  fileId: string
  fileName: string
  columns: string[]
  rows: number
  configEncontrada: { id: string; nombre: string } | null
  mappingSugerido: { source: string; mapping: Record<string, string> } | null
  estado: 'listo' | 'pendiente'
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

// ─── Componente Principal ──────────────────────────────

export default function OperadorPanel() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header simple */}
      <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
            BV
          </div>
          <span className="text-lg font-semibold">BizVentas</span>
          <span className="hidden text-sm text-muted-foreground sm:inline">
            — Intercambio ERP
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
              {user?.nombre?.charAt(0).toUpperCase() || 'O'}
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-medium">{user?.nombre}</p>
              <p className="text-[11px] text-muted-foreground">Operador ERP</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted transition-colors"
            title="Cerrar sesion"
          >
            <LogOut size={14} />
            <span className="hidden sm:inline">Salir</span>
          </button>
        </div>
      </header>

      {/* Contenido */}
      <main className="flex-1 p-4 lg:p-8">
        <div className="mx-auto max-w-5xl">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold">Intercambio de Archivos ERP</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Subi archivos del ERP al sistema o baja datos para importar al ERP
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <UploadCard />
            <DownloadCard />
          </div>
        </div>
      </main>
    </div>
  )
}

// ═══ CARD SUBIR ═══════════════════════════════════════

function UploadCard() {
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [results, setResults] = useState<BatchResult[] | null>(null)
  const [noConfig, setNoConfig] = useState(false)

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const { data: res } = await api.post('/intercambio/import/upload-batch', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return res.data.archivos as UploadedFile[]
    },
    onSuccess: (data) => {
      // Verificar si todos los archivos tienen config/mapeo
      const sinMapeo = data.filter((f) => !f.configEncontrada && !f.mappingSugerido)
      if (sinMapeo.length > 0) {
        setNoConfig(true)
        setFiles([])
      } else {
        setNoConfig(false)
        setFiles(data)
      }
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
        guardarConfig: false,
      })
      return res.data as { resultados: BatchResult[]; tiempoProcesamiento: string }
    },
    onSuccess: (data) => {
      setResults(data.resultados)
      const totalImported = data.resultados.reduce((s, r) => s + r.importados + r.actualizados, 0)
      const totalErrors = data.resultados.reduce((s, r) => s + r.errores, 0)
      toast.success(`${totalImported} registros procesados, ${totalErrors} errores`)
    },
    onError: () => toast.error('Error al procesar archivos'),
  })

  const onDrop = useCallback(
    (accepted: File[]) => {
      if (accepted.length === 0) return
      const formData = new FormData()
      for (const f of accepted) formData.append('archivos', f)
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
    <div className="flex flex-col rounded-2xl border-2 border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20">
      {/* Header card */}
      <div className="flex items-center gap-3 border-b border-blue-200 dark:border-blue-900 p-5">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400">
          <Upload size={24} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-blue-900 dark:text-blue-100">Subir Datos al Sistema</h2>
          <p className="text-sm text-blue-600/70 dark:text-blue-400/70">ERP → BizVentas</p>
        </div>
      </div>

      <div className="flex-1 p-5 space-y-4">
        {/* Estado: sin archivos, mostrar dropzone */}
        {files.length === 0 && !results && !noConfig && (
          <div
            {...getRootProps()}
            className={cn(
              'flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-colors',
              isDragActive
                ? 'border-blue-500 bg-blue-100/50'
                : 'border-blue-300 hover:border-blue-400 hover:bg-blue-100/30 dark:border-blue-800 dark:hover:border-blue-700',
            )}
          >
            <input {...getInputProps()} />
            {uploadMutation.isPending ? (
              <Loader2 size={32} className="mb-3 animate-spin text-blue-500" />
            ) : (
              <Upload size={32} className={cn('mb-3', isDragActive ? 'text-blue-500' : 'text-blue-400')} />
            )}
            <p className="text-sm font-medium text-center">
              {uploadMutation.isPending
                ? 'Analizando archivos...'
                : 'Arrastra los archivos que exportaste del ERP'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">TXT, CSV, XLSX, JSON — podes subir todos juntos</p>
          </div>
        )}

        {/* Sin config */}
        {noConfig && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
            <div className="flex items-start gap-3">
              <AlertTriangle size={20} className="mt-0.5 shrink-0 text-amber-600" />
              <div>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  Configuracion de mapeo no encontrada
                </p>
                <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                  El administrador debe configurar el mapeo de archivos en Intercambio ERP → Configuracion antes de poder procesar archivos.
                </p>
              </div>
            </div>
            <button
              onClick={() => setNoConfig(false)}
              className="mt-3 rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-medium hover:bg-amber-100 transition-colors dark:border-amber-700 dark:hover:bg-amber-900/30"
            >
              Intentar de nuevo
            </button>
          </div>
        )}

        {/* Archivos listos para procesar */}
        {files.length > 0 && !results && (
          <div className="space-y-3">
            <div className="rounded-lg border border-border overflow-hidden">
              {files.map((f) => (
                <div key={f.fileId} className="flex items-center gap-3 border-b last:border-0 px-3 py-2.5 bg-background">
                  <FileText size={14} className="shrink-0 text-muted-foreground" />
                  <span className="text-sm font-medium truncate flex-1">{f.fileName}</span>
                  <span className="text-xs text-muted-foreground">{f.rows} filas</span>
                  {f.configEncontrada || f.mappingSugerido ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      <CheckCircle size={10} /> Listo
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-medium text-yellow-700">
                      <AlertTriangle size={10} /> Sin mapeo
                    </span>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => processMutation.mutate()}
                disabled={!allReady || isLoading}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {processMutation.isPending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <CheckCircle size={16} />
                )}
                Procesar Todo
              </button>
              <button
                onClick={() => setFiles([])}
                className="rounded-lg border border-border px-4 py-2.5 text-sm hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
            </div>

            {processMutation.isPending && (
              <div className="rounded-lg bg-blue-100 p-3 dark:bg-blue-900/30">
                <div className="flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin text-blue-600" />
                  <p className="text-sm text-blue-700 dark:text-blue-300">Procesando archivos...</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Resultados */}
        {results && (
          <div className="space-y-3">
            <div className="rounded-lg border border-green-300 bg-green-50 p-3 dark:border-green-800 dark:bg-green-950/30">
              <p className="text-sm font-medium text-green-800 dark:text-green-200">
                {results.reduce((s, r) => s + r.importados, 0)} importados,{' '}
                {results.reduce((s, r) => s + r.actualizados, 0)} actualizados,{' '}
                {results.reduce((s, r) => s + r.errores, 0)} errores
              </p>
            </div>

            <div className="rounded-lg border border-border overflow-hidden">
              {results.map((r) => (
                <div key={r.entidad} className="flex items-center gap-3 border-b last:border-0 px-3 py-2.5 bg-background">
                  <span className="text-sm font-medium capitalize flex-1">{r.entidad}</span>
                  <span className="text-xs text-green-600">{r.importados} imp.</span>
                  <span className="text-xs text-blue-600">{r.actualizados} act.</span>
                  <span className={cn('text-xs', r.errores > 0 ? 'text-red-600 font-medium' : 'text-muted-foreground')}>
                    {r.errores} err.
                  </span>
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
              className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted transition-colors"
            >
              Nueva importacion
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ═══ CARD BAJAR ═══════════════════════════════════════

function DownloadCard() {
  const today = new Date()
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
  const [desde, setDesde] = useState(weekAgo.toISOString().slice(0, 10))
  const [hasta, setHasta] = useState(today.toISOString().slice(0, 10))

  const { data: preview, isLoading: loadingPreview } = useQuery({
    queryKey: ['op-export-preview', desde, hasta],
    queryFn: async () => {
      const { data: res } = await api.get(`/intercambio/export/preview?desde=${desde}&hasta=${hasta}`)
      return res.data as ExportPreview
    },
  })

  const { data: history } = useQuery({
    queryKey: ['op-export-history'],
    queryFn: async () => {
      const { data: res } = await api.get('/intercambio/export/history?limit=10')
      return res.data as ExportLog[]
    },
  })

  const generateMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post(
        '/intercambio/export/generate',
        { entidades: ['pedidos', 'cobranzas', 'excusas'], desde, hasta, soloNuevos: true },
        { responseType: 'blob' },
      )
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.download = `export_${hasta.replace(/-/g, '')}.zip`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    },
    onSuccess: () => toast.success('Archivo generado y descargado'),
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

  const totalPedidos = preview?.pedidos.cabeceras || 0
  const totalCobranzas = preview?.cobranzas.cabeceras || 0
  const totalExcusas = preview?.excusas.total || 0

  return (
    <div className="flex flex-col rounded-2xl border-2 border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20">
      {/* Header card */}
      <div className="flex items-center gap-3 border-b border-emerald-200 dark:border-emerald-900 p-5">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400">
          <Download size={24} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-emerald-900 dark:text-emerald-100">Bajar Datos para el ERP</h2>
          <p className="text-sm text-emerald-600/70 dark:text-emerald-400/70">BizVentas → ERP</p>
        </div>
      </div>

      <div className="flex-1 p-5 space-y-4">
        {/* Rango de fechas */}
        <div className="flex flex-wrap items-center gap-3">
          <Calendar size={14} className="text-muted-foreground" />
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">Desde</label>
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)}
              className="h-8 rounded-lg border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">Hasta</label>
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)}
              className="h-8 rounded-lg border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
          </div>
        </div>

        {/* Preview */}
        {loadingPreview ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 size={20} className="animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-border bg-background p-3 text-center">
              <p className="text-2xl font-bold">{totalPedidos}</p>
              <p className="text-xs text-muted-foreground">Pedidos</p>
            </div>
            <div className="rounded-lg border border-border bg-background p-3 text-center">
              <p className="text-2xl font-bold">{totalCobranzas}</p>
              <p className="text-xs text-muted-foreground">Cobranzas</p>
            </div>
            <div className="rounded-lg border border-border bg-background p-3 text-center">
              <p className="text-2xl font-bold">{totalExcusas}</p>
              <p className="text-xs text-muted-foreground">Excusas</p>
            </div>
          </div>
        )}

        {/* Boton generar */}
        <button
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending || (totalPedidos === 0 && totalCobranzas === 0 && totalExcusas === 0)}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
        >
          {generateMutation.isPending ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Archive size={16} />
          )}
          Generar y Descargar ZIP
        </button>

        {/* Historial */}
        {history && history.length > 0 && (
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="border-b bg-muted/50 px-3 py-2">
              <p className="text-xs font-medium text-muted-foreground">Ultimas descargas</p>
            </div>
            {history.slice(0, 10).map((log) => {
              const archivos = (log.archivos || []) as { nombre: string; bytes: number }[]
              const totalBytes = archivos.reduce((s, a) => s + (a.bytes || 0), 0)
              return (
                <div key={log.id} className="flex items-center gap-3 border-b last:border-0 px-3 py-2 bg-background">
                  <span className="text-xs text-muted-foreground">{formatDate(log.createdAt)}</span>
                  <span className="text-xs flex-1">{archivos.length} archivos</span>
                  <span className="text-xs text-muted-foreground">{(totalBytes / 1024).toFixed(0)} KB</span>
                  <button
                    onClick={() => downloadPrevious(log.id)}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Descargar
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
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
