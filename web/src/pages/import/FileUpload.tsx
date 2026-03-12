import { Loader2, CheckCircle, Package, Users, DollarSign, FileText, Download } from 'lucide-react'
import FileDropzone from '../../components/FileDropzone'
import { cn } from '../../lib/utils'

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
  onDownloadTemplate: (format: 'csv' | 'xlsx') => void
}

const entityTypes = [
  {
    value: 'productos',
    label: 'Productos',
    description: 'Artículos, precios, stock, categorías',
    icon: Package,
  },
  {
    value: 'clientes',
    label: 'Clientes',
    description: 'Razón social, CUIT, dirección, contacto',
    icon: Users,
  },
  {
    value: 'precios',
    label: 'Precios por cliente',
    description: 'Precios especiales y descuentos',
    icon: DollarSign,
  },
  {
    value: 'facturas',
    label: 'Facturas / Cuenta corriente',
    description: 'Comprobantes, montos, vencimientos',
    icon: FileText,
  },
]

export default function FileUpload({
  file,
  onFileAccepted,
  onClear,
  entityType,
  onEntityTypeChange,
  uploading,
  uploadResult,
  onDownloadTemplate,
}: FileUploadProps) {
  return (
    <div className="space-y-6">
      {/* Paso 1: Tipo de datos */}
      <div>
        <h2 className="text-lg font-semibold">¿Qué vas a importar?</h2>
        <p className="text-sm text-muted-foreground">Elegí el tipo de datos que contiene tu archivo</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {entityTypes.map((type) => {
          const Icon = type.icon
          const selected = entityType === type.value
          return (
            <button
              key={type.value}
              onClick={() => onEntityTypeChange(type.value)}
              className={cn(
                'flex items-start gap-3 rounded-lg border p-4 text-left transition-colors',
                selected
                  ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                  : 'border-border hover:border-primary/50 hover:bg-muted/30',
              )}
            >
              <Icon size={20} className={selected ? 'text-primary mt-0.5' : 'text-muted-foreground mt-0.5'} />
              <div>
                <span className={cn('text-sm font-medium', selected && 'text-primary')}>{type.label}</span>
                <p className="text-xs text-muted-foreground mt-0.5">{type.description}</p>
              </div>
            </button>
          )
        })}
      </div>

      {/* Descargar template */}
      <div className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-muted/20 px-4 py-3">
        <span className="flex-1 text-xs text-muted-foreground">
          ¿No sabés qué formato usar? Descargá una plantilla de ejemplo:
        </span>
        <button
          onClick={() => onDownloadTemplate('csv')}
          className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted transition-colors"
        >
          <Download size={11} /> CSV
        </button>
        <button
          onClick={() => onDownloadTemplate('xlsx')}
          className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted transition-colors"
        >
          <Download size={11} /> Excel
        </button>
      </div>

      {/* Paso 2: Subir archivo */}
      <div>
        <h2 className="text-lg font-semibold">Subí tu archivo</h2>
        <p className="mb-3 text-sm text-muted-foreground">Formatos: CSV, TXT, JSON o Excel — máximo 20 MB</p>
        <FileDropzone file={file} onFileAccepted={onFileAccepted} onClear={onClear} />
      </div>

      {/* Estado: procesando */}
      {uploading && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-4 text-sm">
          <Loader2 size={16} className="animate-spin text-primary" />
          Procesando archivo...
        </div>
      )}

      {/* Estado: listo */}
      {uploadResult && !uploading && (
        <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/5 p-4 text-sm">
          <CheckCircle size={16} className="text-success" />
          <span>
            <strong>{uploadResult.totalRows}</strong> filas detectadas con{' '}
            <strong>{uploadResult.columns.length}</strong> columnas:{' '}
            <span className="text-muted-foreground">{uploadResult.columns.join(', ')}</span>
          </span>
        </div>
      )}
    </div>
  )
}
