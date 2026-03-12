import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, CheckCircle, AlertCircle, Clock, Loader2, Package, Users, ShoppingCart, Banknote } from 'lucide-react'
import { toast } from 'sonner'
import api from '../../api/client'
import { cn, formatDateTime } from '../../lib/utils'

interface SyncLog {
  id: string
  direction: string
  entityType: string
  recordCount: number
  status: string
  errorDetail: string | null
  startedAt: string
  finishedAt: string | null
}

const entityIcons: Record<string, React.ReactNode> = {
  productos: <Package size={20} />,
  clientes: <Users size={20} />,
  pedidos: <ShoppingCart size={20} />,
  cobranzas: <Banknote size={20} />,
}

export default function SyncStatus() {
  const queryClient = useQueryClient()

  const { data: logs, isLoading } = useQuery({
    queryKey: ['sync-logs'],
    queryFn: async () => {
      try {
        const { data: res } = await api.get('/admin/sync-log?limit=50')
        return res.data as SyncLog[]
      } catch {
        return []
      }
    },
    refetchInterval: 15000,
  })

  const forceMutation = useMutation({
    mutationFn: () => api.post('/admin/sync/force'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sync-logs'] })
      toast.success('Sincronización forzada completada')
    },
    onError: () => toast.error('Error al forzar sincronización'),
  })

  // Calcular resumen por entidad
  const entities = ['productos', 'clientes', 'pedidos', 'cobranzas']
  const entitySummaries = entities.map((entity) => {
    const entityLogs = (logs || []).filter((l) => l.entityType === entity)
    const lastSync = entityLogs[0]
    const totalSynced = entityLogs.filter((l) => l.status === 'success').reduce((sum, l) => sum + l.recordCount, 0)
    const errorCount = entityLogs.filter((l) => l.status === 'error').length
    return { entity, lastSync, totalSynced, errorCount }
  })

  const statusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle size={16} className="text-success" />
      case 'error': return <AlertCircle size={16} className="text-destructive" />
      default: return <Clock size={16} className="text-warning" />
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sincronización</h1>
          <p className="text-sm text-muted-foreground">Estado de sincronización con el ERP</p>
        </div>
        <button
          onClick={() => forceMutation.mutate()}
          disabled={forceMutation.isPending}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {forceMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Forzar Sync Ahora
        </button>
      </div>

      {/* Cards por entidad */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {entitySummaries.map(({ entity, lastSync, totalSynced, errorCount }) => (
          <div key={entity} className={cn(
            'rounded-xl border p-5',
            errorCount > 0 ? 'border-destructive/30' : 'border-border',
          )}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                {entityIcons[entity]}
              </div>
              {lastSync && statusIcon(lastSync.status)}
            </div>
            <h3 className="text-sm font-semibold capitalize">{entity}</h3>
            <div className="mt-2 space-y-1 text-xs text-muted-foreground">
              <div>Última sync: {lastSync ? formatDateTime(lastSync.startedAt) : 'Nunca'}</div>
              <div>Registros sincronizados: <span className="font-medium text-foreground">{totalSynced}</span></div>
              {errorCount > 0 && (
                <div className="text-destructive font-medium">{errorCount} error(es)</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Log de sincronizaciones */}
      <div className="rounded-xl border border-border bg-card">
        <div className="border-b border-border px-5 py-3">
          <h2 className="font-semibold">Historial de sincronización</h2>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center p-12 text-muted-foreground">
            <Loader2 size={20} className="animate-spin mr-2" /> Cargando...
          </div>
        ) : !logs?.length ? (
          <div className="flex items-center justify-center p-12 text-muted-foreground">
            No hay registros de sincronización
          </div>
        ) : (
          <div className="divide-y divide-border">
            {logs.map((log) => (
              <div key={log.id} className="flex items-start gap-3 px-5 py-3">
                <div className="mt-0.5">{statusIcon(log.status)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'inline-flex rounded px-1.5 py-0.5 text-[10px] font-bold uppercase',
                      log.direction === 'pull' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600',
                    )}>
                      {log.direction}
                    </span>
                    <span className="text-sm font-medium capitalize">{log.entityType}</span>
                    <span className="text-xs text-muted-foreground">{log.recordCount} registros</span>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{formatDateTime(log.startedAt)}</span>
                    {log.finishedAt && (
                      <span>→ {formatDateTime(log.finishedAt)}</span>
                    )}
                  </div>
                  {log.status === 'error' && log.errorDetail && (
                    <p className="mt-1 text-xs text-destructive truncate">{log.errorDetail}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
