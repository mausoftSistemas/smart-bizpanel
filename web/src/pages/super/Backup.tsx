import { useState, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { Download, Loader2, Database, Upload, AlertTriangle, X } from 'lucide-react'
import { toast } from 'sonner'
import api from '../../api/client'
import DataTable from '../../components/DataTable'
import { PlanBadge, EstadoBadge } from './SuperDashboard'
import { formatDate } from '../../lib/utils'

interface BackupInfo {
  fecha: string
  tamaño: number
  fileName: string
}

interface TenantBackup {
  id: string
  codigo: string
  razonSocial: string
  plan: string
  estado: string
  ultimaActividad: string | null
  ultimoBackup: BackupInfo | null
}

interface RestoreResult {
  registrosRestaurados: Record<string, number>
  advertencias: string[]
}

function RestoreModal({
  tenant,
  onClose,
}: {
  tenant: TenantBackup
  onClose: (restored?: boolean) => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [confirmText, setConfirmText] = useState('')
  const [restoring, setRestoring] = useState(false)
  const [result, setResult] = useState<RestoreResult | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const canRestore = file && confirmText === tenant.codigo && !restoring

  const handleRestore = async () => {
    if (!canRestore) return
    setRestoring(true)
    try {
      const formData = new FormData()
      formData.append('backup', file)
      const { data: res } = await api.post(
        `/super/backup/tenants/${tenant.id}/restore`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 180000 },
      )
      setResult(res.data as RestoreResult)
      toast.success(`Backup de "${tenant.razonSocial}" restaurado correctamente`)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message || 'Error al restaurar backup'
      toast.error(msg)
    } finally {
      setRestoring(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background border rounded-lg shadow-xl w-full max-w-lg mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Restaurar Backup</h2>
          <button onClick={() => onClose(!!result)} className="text-muted-foreground hover:text-foreground">
            <X size={20} />
          </button>
        </div>

        {result ? (
          /* Resultado */
          <div className="p-4 space-y-4">
            <div className="rounded-md bg-green-50 border border-green-200 p-3">
              <p className="text-sm font-medium text-green-800">Restore completado exitosamente</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">Registros restaurados:</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                {Object.entries(result.registrosRestaurados).map(([key, val]) => (
                  <div key={key} className="flex justify-between">
                    <span className="text-muted-foreground">{key}</span>
                    <span className="font-mono">{val}</span>
                  </div>
                ))}
              </div>
            </div>
            {result.advertencias.length > 0 && (
              <div className="rounded-md bg-amber-50 border border-amber-200 p-3 space-y-1">
                {result.advertencias.map((a, i) => (
                  <p key={i} className="text-xs text-amber-800">{a}</p>
                ))}
              </div>
            )}
            <div className="flex justify-end">
              <button
                onClick={() => onClose(true)}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Cerrar
              </button>
            </div>
          </div>
        ) : (
          /* Formulario */
          <div className="p-4 space-y-4">
            {/* Warning */}
            <div className="rounded-md bg-red-50 border border-red-200 p-3 flex gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
              <div className="text-sm text-red-800">
                <p className="font-medium">Atención: Esta accion es irreversible</p>
                <p className="mt-1">
                  Se reemplazaran TODOS los datos actuales de <strong>{tenant.razonSocial}</strong> con
                  los del archivo de backup. Los datos actuales se perderan permanentemente.
                </p>
                <p className="mt-1">
                  Los usuarios restaurados tendran una contraseña temporal y deberan cambiarla.
                </p>
              </div>
            </div>

            {/* File input */}
            <div>
              <label className="block text-sm font-medium mb-1">Archivo de backup (.zip)</label>
              <div
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed rounded-md p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept=".zip"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
                {file ? (
                  <div className="flex items-center justify-center gap-2 text-sm">
                    <Upload size={16} className="text-primary" />
                    <span className="font-medium">{file.name}</span>
                    <span className="text-muted-foreground">({(file.size / 1024).toFixed(0)} KB)</span>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    <Upload size={20} className="mx-auto mb-1" />
                    Click para seleccionar archivo ZIP
                  </div>
                )}
              </div>
            </div>

            {/* Confirm text */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Escribi <span className="font-mono bg-muted px-1 rounded">{tenant.codigo}</span> para confirmar
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={tenant.codigo}
                className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => onClose()}
                className="rounded-md border px-4 py-2 text-sm hover:bg-muted"
              >
                Cancelar
              </button>
              <button
                onClick={handleRestore}
                disabled={!canRestore}
                className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {restoring ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Restaurando...
                  </>
                ) : (
                  <>
                    <Upload size={14} />
                    Restaurar Backup
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Backup() {
  const [generatingId, setGeneratingId] = useState<string | null>(null)
  const [restoreTenant, setRestoreTenant] = useState<TenantBackup | null>(null)

  const { data: tenants = [], isLoading, refetch } = useQuery({
    queryKey: ['super-backup-tenants'],
    queryFn: async () => {
      const { data: res } = await api.get('/super/backup/tenants')
      return res.data as TenantBackup[]
    },
  })

  const handleGenerate = async (tenant: TenantBackup) => {
    setGeneratingId(tenant.id)
    try {
      const response = await api.post(
        `/super/backup/tenants/${tenant.id}/generate`,
        {},
        { responseType: 'blob' },
      )

      const blob = new Blob([response.data], { type: 'application/zip' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      const disposition = response.headers['content-disposition']
      const fileName = disposition
        ? disposition.split('filename="')[1]?.replace('"', '')
        : `backup_${tenant.codigo}.zip`
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)

      toast.success(`Backup de "${tenant.razonSocial}" generado correctamente`)
    } catch {
      toast.error(`Error al generar backup de "${tenant.razonSocial}"`)
    } finally {
      setGeneratingId(null)
    }
  }

  const handleDownload = async (tenant: TenantBackup) => {
    if (!tenant.ultimoBackup) return
    try {
      const response = await api.get(
        `/super/backup/tenants/${tenant.id}/download/${tenant.ultimoBackup.fileName}`,
        { responseType: 'blob' },
      )

      const blob = new Blob([response.data], { type: 'application/zip' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = tenant.ultimoBackup.fileName
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch {
      toast.error('Error al descargar backup')
    }
  }

  const columns: ColumnDef<TenantBackup>[] = [
    {
      accessorKey: 'razonSocial',
      header: 'Empresa',
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.razonSocial}</p>
          <p className="text-xs text-muted-foreground">{row.original.codigo}</p>
        </div>
      ),
    },
    {
      accessorKey: 'estado',
      header: 'Estado',
      cell: ({ row }) => <EstadoBadge estado={row.original.estado} />,
    },
    {
      accessorKey: 'plan',
      header: 'Plan',
      cell: ({ row }) => <PlanBadge plan={row.original.plan} />,
    },
    {
      accessorKey: 'ultimaActividad',
      header: 'Última Actividad',
      cell: ({ row }) =>
        row.original.ultimaActividad
          ? formatDate(row.original.ultimaActividad)
          : <span className="text-muted-foreground">-</span>,
    },
    {
      id: 'ultimoBackup',
      header: 'Último Backup',
      cell: ({ row }) => {
        const backup = row.original.ultimoBackup
        if (!backup) return <span className="text-muted-foreground text-xs">Nunca</span>
        return (
          <div>
            <p className="text-sm">{formatDate(backup.fecha)}</p>
            <p className="text-xs text-muted-foreground">{backup.tamaño} KB</p>
          </div>
        )
      },
    },
    {
      id: 'acciones',
      header: '',
      cell: ({ row }) => {
        const isGenerating = generatingId === row.original.id
        return (
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleGenerate(row.original)}
              disabled={isGenerating}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isGenerating ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Database size={14} />
              )}
              {isGenerating ? 'Generando...' : 'Generar Backup'}
            </button>
            {row.original.ultimoBackup && (
              <button
                onClick={() => handleDownload(row.original)}
                className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted"
                title="Descargar último backup"
              >
                <Download size={14} />
              </button>
            )}
            <button
              onClick={() => setRestoreTenant(row.original)}
              className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700 hover:bg-amber-100"
              title="Restaurar backup"
            >
              <Upload size={14} />
              Restaurar
            </button>
          </div>
        )
      },
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">BackUp por Empresa</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Generá y descargá backups completos de los datos de cada empresa en formato XLSX+ZIP
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <DataTable columns={columns} data={tenants} searchColumn="razonSocial" searchPlaceholder="Buscar empresa..." />
      )}

      {restoreTenant && (
        <RestoreModal
          tenant={restoreTenant}
          onClose={(restored) => {
            setRestoreTenant(null)
            if (restored) refetch()
          }}
        />
      )}
    </div>
  )
}
