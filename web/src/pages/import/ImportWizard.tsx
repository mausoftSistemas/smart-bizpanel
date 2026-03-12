import { useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Upload, Loader2, CheckCircle, AlertCircle, Download, RefreshCw, Save } from 'lucide-react'
import { toast } from 'sonner'
import api from '../../api/client'
import type { ColumnMapping } from '../../components/ColumnMapperUI'
import FileUpload from './FileUpload'
import ColumnMapper from './ColumnMapper'
import ImportPreview from './ImportPreview'
import { cn } from '../../lib/utils'

const steps = ['Archivo', 'Mapeo', 'Vista previa', 'Resultado']

interface UploadResult {
  fileId: string
  fileName: string
  columns: string[]
  preview: Record<string, unknown>[]
  totalRows: number
}

interface ImportResult {
  imported: number
  updated: number
  skipped: number
  errors: { row: number; error: string; data: Record<string, unknown> }[]
}

const entityListRoutes: Record<string, string> = {
  productos: '/productos',
  clientes: '/clientes',
  precios: '/productos',
  facturas: '/clientes',
}

export default function ImportWizard() {
  const [step, setStep] = useState(0)
  const [entityType, setEntityType] = useState('productos')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null)
  const [mappings, setMappings] = useState<ColumnMapping[]>([])
  const [defaultValues, setDefaultValues] = useState<Record<string, string>>({})
  const [updateExisting, setUpdateExisting] = useState(true)
  const [skipErrors, setSkipErrors] = useState(true)
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [saveMapping, setSaveMapping] = useState(true)
  const [mappingName, setMappingName] = useState('')

  const handleFileAccepted = useCallback(async (f: File) => {
    setFile(f)
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', f)
      const { data: res } = await api.post('/import/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setUploadResult(res.data)
      // Reset mappings cuando se sube nuevo archivo
      setMappings([])
      setDefaultValues({})
      // Nombre del mapeo basado en el nombre del archivo
      const baseName = f.name.replace(/\.[^/.]+$/, '')
      setMappingName(baseName)
      toast.success(`Archivo procesado: ${res.data.totalRows} filas, ${res.data.columns.length} columnas`)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message || 'Error al subir el archivo'
      toast.error(msg)
      setFile(null)
    } finally {
      setUploading(false)
    }
  }, [])

  const handleImport = async () => {
    if (!uploadResult) return
    const activeMappings = mappings.filter((m) => m.source && m.target)
    if (activeMappings.length === 0) {
      toast.error('Mapeá al menos un campo')
      return
    }

    // Convertir [{source, target}] a {target: source}
    const mapping: Record<string, string> = {}
    for (const m of activeMappings) {
      mapping[m.target] = m.source
    }

    // Filtrar defaultValues vacíos
    const cleanDefaults: Record<string, string> = {}
    for (const [k, v] of Object.entries(defaultValues)) {
      if (v && v.trim()) cleanDefaults[k] = v.trim()
    }

    setImporting(true)
    setImportProgress(0)

    // Simular progreso visual (el backend no envía progreso real)
    const progressInterval = setInterval(() => {
      setImportProgress((prev) => {
        if (prev >= 90) return prev
        return prev + Math.random() * 15
      })
    }, 500)

    try {
      const { data: res } = await api.post('/import/map', {
        fileId: uploadResult.fileId,
        entityType,
        mapping,
        options: {
          updateExisting,
          skipErrors,
          defaultValues: Object.keys(cleanDefaults).length > 0 ? cleanDefaults : undefined,
        },
      })
      clearInterval(progressInterval)
      setImportProgress(100)
      setResult(res.data)
      setStep(3)
      toast.success('Importación completada')
    } catch (err: unknown) {
      clearInterval(progressInterval)
      setImportProgress(0)
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message || 'Error al importar'
      toast.error(msg)
    } finally {
      setImporting(false)
    }
  }

  const downloadTemplate = async (format: 'csv' | 'xlsx') => {
    try {
      const response = await api.get(`/import/templates/${entityType}?format=${format}`, {
        responseType: 'blob',
      })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = `plantilla_${entityType}.${format}`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch {
      toast.error('Error al descargar la plantilla')
    }
  }

  const downloadErrorsCsv = () => {
    if (!result || result.errors.length === 0) return

    const headers = ['Fila', 'Error', ...Object.keys(result.errors[0]?.data || {})]
    const rows = result.errors.map((err) => {
      const dataValues = Object.values(err.data || {}).map((v) => String(v ?? '').replace(/"/g, '""'))
      return [String(err.row), `"${err.error.replace(/"/g, '""')}"`, ...dataValues.map((v) => `"${v}"`)].join(',')
    })

    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `errores_importacion_${entityType}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const canNext = () => {
    if (step === 0) return !!uploadResult && !!entityType
    if (step === 1) return mappings.filter((m) => m.source && m.target).length > 0
    if (step === 2) return true
    return false
  }

  const handleNext = () => {
    if (step === 2) {
      // Guardar mapeo fire-and-forget antes de importar
      if (saveMapping && mappingName.trim() && uploadResult) {
        const activeMappings = mappings.filter((m) => m.source && m.target)
        const mapping: Record<string, string> = {}
        for (const m of activeMappings) mapping[m.target] = m.source
        api.post('/import/save-mapping', {
          entityType,
          nombre: mappingName.trim(),
          columnasArchivo: uploadResult.columns,
          mapping,
          defaultValues: Object.keys(defaultValues).length > 0 ? defaultValues : undefined,
        }).catch(() => { /* silencioso */ })
      }
      handleImport()
    } else {
      setStep((s) => s + 1)
    }
  }

  const reset = () => {
    setStep(0)
    setFile(null)
    setUploadResult(null)
    setMappings([])
    setDefaultValues({})
    setResult(null)
    setImportProgress(0)
    setSaveMapping(true)
    setMappingName('')
  }

  const hasErrors = result && result.errors.length > 0
  const totalProcessed = result ? result.imported + result.updated + result.skipped + result.errors.length : 0

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Importar datos</h1>
        <p className="text-sm text-muted-foreground">
          Subí archivos CSV, TXT, JSON o Excel para cargar datos al sistema
        </p>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2">
        {steps.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition-colors',
                i === step
                  ? 'bg-primary text-primary-foreground'
                  : i < step
                    ? 'bg-success text-success-foreground'
                    : 'bg-muted text-muted-foreground',
              )}
            >
              {i < step ? <CheckCircle size={14} /> : i + 1}
            </div>
            <span className={cn('hidden text-sm sm:inline', i === step ? 'font-medium' : 'text-muted-foreground')}>
              {label}
            </span>
            {i < steps.length - 1 && <div className="mx-1 h-px w-6 bg-border sm:w-10" />}
          </div>
        ))}
      </div>

      {/* Contenido */}
      <div className="rounded-xl border border-border bg-card p-6">
        {/* PASO 1: Archivo */}
        {step === 0 && (
          <FileUpload
            file={file}
            onFileAccepted={handleFileAccepted}
            onClear={() => {
              setFile(null)
              setUploadResult(null)
              setMappings([])
            }}
            entityType={entityType}
            onEntityTypeChange={(type) => {
              setEntityType(type)
              setMappings([])
              setDefaultValues({})
            }}
            uploading={uploading}
            uploadResult={uploadResult}
            onDownloadTemplate={downloadTemplate}
          />
        )}

        {/* PASO 2: Mapeo */}
        {step === 1 && uploadResult && (
          <div className="space-y-6">
            <ColumnMapper
              entityType={entityType}
              sourceColumns={uploadResult.columns}
              sampleData={uploadResult.preview}
              mappings={mappings}
              onMappingsChange={setMappings}
              defaultValues={defaultValues}
              onDefaultValuesChange={setDefaultValues}
            />
            <div className="space-y-3 rounded-lg border border-border p-4">
              <h3 className="text-sm font-medium">Opciones de importación</h3>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={updateExisting}
                  onChange={(e) => setUpdateExisting(e.target.checked)}
                  className="h-4 w-4 rounded border-input accent-primary"
                />
                <div>
                  <span className="text-sm">Actualizar registros existentes</span>
                  <p className="text-xs text-muted-foreground">Si ya existe un registro con el mismo código, se actualizan sus datos</p>
                </div>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={skipErrors}
                  onChange={(e) => setSkipErrors(e.target.checked)}
                  className="h-4 w-4 rounded border-input accent-primary"
                />
                <div>
                  <span className="text-sm">Continuar si una fila falla</span>
                  <p className="text-xs text-muted-foreground">Las filas con error se omiten y el resto se importa</p>
                </div>
              </label>
            </div>

            {/* Guardar mapeo */}
            <div className="space-y-3 rounded-lg border border-border p-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={saveMapping}
                  onChange={(e) => setSaveMapping(e.target.checked)}
                  className="h-4 w-4 rounded border-input accent-primary"
                />
                <div className="flex items-center gap-1.5">
                  <Save size={14} className="text-muted-foreground" />
                  <span className="text-sm">Guardar mapeo para la próxima vez</span>
                </div>
              </label>
              {saveMapping && (
                <div className="ml-7">
                  <input
                    type="text"
                    value={mappingName}
                    onChange={(e) => setMappingName(e.target.value)}
                    placeholder="Nombre del mapeo (ej: Exportación de Tango)"
                    className="h-8 w-full rounded-md border border-input bg-background px-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* PASO 3: Vista previa */}
        {step === 2 && uploadResult && (
          <ImportPreview
            entityType={entityType}
            data={uploadResult.preview}
            mappings={mappings}
            totalRows={uploadResult.totalRows}
            defaultValues={defaultValues}
          />
        )}

        {/* Barra de progreso durante importación */}
        {importing && (
          <div className="py-12 text-center space-y-4">
            <Loader2 size={40} className="mx-auto animate-spin text-primary" />
            <p className="text-sm font-medium">Importando datos...</p>
            <div className="mx-auto max-w-xs">
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${Math.min(importProgress, 100)}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {Math.round(importProgress)}% — No cierres esta pestaña
              </p>
            </div>
          </div>
        )}

        {/* PASO 4: Resultado */}
        {step === 3 && result && !importing && (
          <div className="flex flex-col items-center py-8 text-center">
            {hasErrors ? (
              <AlertCircle size={48} className="mb-4 text-warning" />
            ) : (
              <CheckCircle size={48} className="mb-4 text-success" />
            )}

            <h2 className="text-xl font-semibold">
              {hasErrors ? 'Importación completada con observaciones' : 'Importación exitosa'}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Se procesaron {totalProcessed} filas de {entityType}
            </p>

            {/* Contadores */}
            <div className="mt-6 grid w-full gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-border p-4">
                <p className="text-2xl font-bold text-success">{result.imported}</p>
                <p className="text-sm text-muted-foreground">Creados</p>
              </div>
              <div className="rounded-lg border border-border p-4">
                <p className="text-2xl font-bold text-primary">{result.updated}</p>
                <p className="text-sm text-muted-foreground">Actualizados</p>
              </div>
              <div className="rounded-lg border border-border p-4">
                <p className="text-2xl font-bold text-muted-foreground">{result.skipped}</p>
                <p className="text-sm text-muted-foreground">Omitidos</p>
              </div>
              <div className="rounded-lg border border-border p-4">
                <p className={cn('text-2xl font-bold', result.errors.length > 0 ? 'text-destructive' : 'text-muted-foreground')}>
                  {result.errors.length}
                </p>
                <p className="text-sm text-muted-foreground">Errores</p>
              </div>
            </div>

            {/* Detalle de errores */}
            {result.errors.length > 0 && (
              <div className="mt-6 w-full space-y-3">
                <div className="max-h-60 overflow-y-auto rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-left">
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium text-destructive">
                    <AlertCircle size={14} />
                    Errores ({result.errors.length})
                  </div>
                  {result.errors.slice(0, 20).map((err, i) => (
                    <div key={i} className="border-b border-destructive/10 py-1.5 text-xs last:border-0">
                      <span className="font-medium">Fila {err.row}:</span> {err.error}
                    </div>
                  ))}
                  {result.errors.length > 20 && (
                    <p className="mt-2 text-xs text-muted-foreground">... y {result.errors.length - 20} errores más</p>
                  )}
                </div>

                <button
                  onClick={downloadErrorsCsv}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-muted transition-colors"
                >
                  <Download size={13} />
                  Descargar errores en CSV
                </button>
              </div>
            )}

            {/* Acciones finales */}
            <div className="mt-6 flex items-center gap-3">
              <button
                onClick={reset}
                className="flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
              >
                <RefreshCw size={14} />
                Nueva importación
              </button>
              {entityListRoutes[entityType] && (
                <a
                  href={entityListRoutes[entityType]}
                  className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Ir al listado
                </a>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Navegación */}
      {step < 3 && !importing && (
        <div className="flex justify-between">
          <button
            onClick={() => setStep((s) => s - 1)}
            disabled={step === 0}
            className="flex items-center gap-1 rounded-lg border border-border px-4 py-2 text-sm font-medium disabled:opacity-50 hover:bg-muted transition-colors"
          >
            <ChevronLeft size={16} />
            Anterior
          </button>
          <button
            onClick={handleNext}
            disabled={!canNext()}
            className="flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50 hover:bg-primary/90 transition-colors"
          >
            {step === 2 ? (
              <>
                <Upload size={16} />
                Importar ahora
              </>
            ) : (
              <>
                Siguiente
                <ChevronRight size={16} />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
