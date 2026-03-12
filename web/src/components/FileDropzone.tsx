import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, File, X } from 'lucide-react'
import { cn } from '../lib/utils'

interface FileDropzoneProps {
  onFileAccepted: (file: File) => void
  file: File | null
  onClear: () => void
  accept?: Record<string, string[]>
}

const defaultAccept = {
  'text/csv': ['.csv'],
  'text/plain': ['.txt'],
  'application/json': ['.json'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-excel': ['.xls'],
}

export default function FileDropzone({ onFileAccepted, file, onClear, accept = defaultAccept }: FileDropzoneProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        onFileAccepted(acceptedFiles[0])
      }
    },
    [onFileAccepted],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    maxFiles: 1,
    multiple: false,
  })

  if (file) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-4">
        <File size={20} className="text-primary" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{file.name}</p>
          <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
        </div>
        <button
          onClick={onClear}
          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <X size={16} />
        </button>
      </div>
    )
  }

  return (
    <div
      {...getRootProps()}
      className={cn(
        'flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors',
        isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/30',
      )}
    >
      <input {...getInputProps()} />
      <Upload size={32} className={cn('mb-3', isDragActive ? 'text-primary' : 'text-muted-foreground')} />
      <p className="text-sm font-medium">
        {isDragActive ? 'Soltá el archivo aquí' : 'Arrastrá un archivo o hacé clic para seleccionar'}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">CSV, TXT, JSON, Excel (.xlsx, .xls)</p>
    </div>
  )
}
