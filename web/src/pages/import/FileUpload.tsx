import { Loader2, CheckCircle } from 'lucide-react'
import FileDropzone from '../../components/FileDropzone'

interface UploadResult {
  fileId: string
  fileName: string
  columns: string[]
  preview: Record<string, unknown>[]
  totalRows: number
}

interface FileUploadProps {
  file: File | null
  onFileAccepted: (file: File) => void
  onClear: () => void
  entityType: string
  onEntityTypeChange: (type: string) => void
  uploading?: boolean
  uploadResult?: UploadResult | null
}

const entityTypes = [
  { value: 'productos', label: 'Productos' },
  { value: 'clientes', label: 'Clientes' },
  { value: 'precios', label: 'Precios por cliente' },
  { value: 'facturas', label: 'Facturas / Cuenta corriente' },
]

export default function FileUpload({
  file,
  onFileAccepted,
  onClear,
  entityType,
  onEntityTypeChange,
  uploading,
  uploadResult,
}: FileUploadProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">1. Seleccionar tipo de datos</h2>
        <p className="text-sm text-muted-foreground">Elegí qué tipo de datos vas a importar</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {entityTypes.map((type) => (
          <button
            key={type.value}
            onClick={() => onEntityTypeChange(type.value)}
            className={`rounded-lg border p-4 text-left text-sm font-medium transition-colors ${
              entityType === type.value
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-border hover:border-primary/50'
            }`}
          >
            {type.label}
          </button>
        ))}
      </div>

      <div>
        <h2 className="text-lg font-semibold">2. Subir archivo</h2>
        <p className="mb-3 text-sm text-muted-foreground">Formatos soportados: CSV, TXT, JSON, Excel (max 20MB)</p>
        <FileDropzone file={file} onFileAccepted={onFileAccepted} onClear={onClear} />
      </div>

      {uploading && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-4 text-sm">
          <Loader2 size={16} className="animate-spin text-primary" />
          Procesando archivo...
        </div>
      )}

      {uploadResult && !uploading && (
        <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/5 p-4 text-sm">
          <CheckCircle size={16} className="text-success" />
          <span>
            <strong>{uploadResult.totalRows}</strong> filas detectadas, <strong>{uploadResult.columns.length}</strong> columnas:
            <span className="ml-1 text-muted-foreground">{uploadResult.columns.join(', ')}</span>
          </span>
        </div>
      )}
    </div>
  )
}
