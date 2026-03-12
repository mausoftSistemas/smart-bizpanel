import { useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Upload, Loader2, CheckCircle, Download, AlertCircle } from 'lucide-react'
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

export default function ImportWizard() {
  const [step, setStep] = useState(0)
  const [entityType, setEntityType] = useState('productos')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null)
  const [mappings, setMappings] = useState<ColumnMapping[]>([])
  const [updateExisting, setUpdateExisting] = useState(true)
  const [skipErrors, setSkipErrors] = useState(true)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)

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

    // Convertir de [{source, target}] a {target: source}
    const mapping: Record<string, string> = {}
    for (const m of activeMappings) {
      mapping[m.target] = m.source
    }

    setImporting(true)
    try {
      const { data: res } = await api.post('/import/map', {
        fileId: uploadResult.fileId,
        entityType,
        mapping,
        options: {
          updateExisting,
          skipErrors,
        },
      })
      setResult(res.data)
      setStep(3)
      toast.success('Importación completada')
    } catch (err: unknown) {
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
      a.download = `template_${entityType}.${format}`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch {
      toast.error('Error al descargar template')
    }
  }

  const canNext = () => {
    if (step === 0) return !!uploadResult && !!entityType
    if (step === 1) return mappings.filter((m) => m.source && m.target).length > 0
    if (step === 2) return true
    return false
  }

  const handleNext = () => {
    if (step === 2) {
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
    setResult(null)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Importar datos</h1>
          <p className="text-sm text-muted-foreground">
            Subí archivos CSV, TXT, JSON o Excel para importar datos al sistema
          </p>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => downloadTemplate('csv')}
            className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
          >
            <Download size={12} /> CSV
          </button>
          <button
            onClick={() => downloadTemplate('xlsx')}
            className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
          >
            <Download size={12} /> Excel
          </button>
        </div>
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

      {/* Content */}
      <div className="rounded-xl border border-border bg-card p-6">
        {step === 0 && (
          <FileUpload
            file={file}
            onFileAccepted={handleFileAccepted}
            onClear={() => {
              setFile(null)
              setUploadResult(null)
            }}
            entityType={entityType}
            onEntityTypeChange={setEntityType}
            uploading={uploading}
            uploadResult={uploadResult}
          />
        )}
        {step === 1 && uploadResult && (
          <div className="space-y-6">
            <ColumnMapper
              entityType={entityType}
              sourceColumns={uploadResult.columns}
              mappings={mappings}
              onMappingsChange={setMappings}
            />
            <div className="space-y-3 rounded-lg border border-border p-4">
              <h3 className="text-sm font-medium">Opciones</h3>
              <label className="flex items-center gap-3">
                <input type="checkbox" checked={updateExisting} onChange={(e) => setUpdateExisting(e.target.checked)} className="h-4 w-4 rounded border-input" />
                <span className="text-sm">Actualizar registros existentes (por código)</span>
              </label>
              <label className="flex items-center gap-3">
                <input type="checkbox" checked={skipErrors} onChange={(e) => setSkipErrors(e.target.checked)} className="h-4 w-4 rounded border-input" />
                <span className="text-sm">Continuar si una fila falla</span>
              </label>
            </div>
          </div>
        )}
        {step === 2 && uploadResult && (
          <ImportPreview
            entityType={entityType}
            data={uploadResult.preview}
            mappings={mappings}
            totalRows={uploadResult.totalRows}
          />
        )}
        {step === 3 && result && (
          <div className="flex flex-col items-center py-8 text-center">
            <CheckCircle size={48} className="mb-4 text-success" />
            <h2 className="text-xl font-semibold">Importación completada</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-4">
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
                <p className="text-2xl font-bold text-destructive">{result.errors.length}</p>
                <p className="text-sm text-muted-foreground">Errores</p>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="mt-6 w-full max-h-60 overflow-y-auto rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-left">
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
            )}

            <button
              onClick={reset}
              className="mt-6 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Nueva importación
            </button>
          </div>
        )}
      </div>

      {/* Navigation */}
      {step < 3 && (
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
            disabled={!canNext() || importing}
            className="flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50 hover:bg-primary/90 transition-colors"
          >
            {importing ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Importando...
              </>
            ) : step === 2 ? (
              <>
                <Upload size={16} />
                Importar
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
