import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, CheckCircle, AlertCircle, Clock, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import api from '../../api/client'
import { cn, formatDateTime } from '../../lib/utils'

interface SyncLog {
  id: string
  tipo: string
  entidad: string
  estado: string
  registros: number
  errores: number
  mensaje: string | null
  createdAt: string
}

export default function SyncStatus() {
  const queryClient = useQueryClient()

  const { data: logs, isLoading } = useQuery({
    queryKey: ['sync-logs'],
    queryFn: async () => {
      try {
        const { data: res } = await api.get('/sync/logs?limit=50')
        return res.data as SyncLog[]
      } catch {
        return []
      }
    },
    refetchInterval: 15000,
  })

  const pullMutation = useMutation({
    mutationFn: () => api.post('/sync/pull'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sync-logs'] })
      toast.success('Sincronización pull iniciada')
    },
    onError: () => toast.error('Error al iniciar sync pull'),
  })

  const pushMutation = useMutation({
    mutationFn: () => api.post('/sync/push'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sync-logs'] })
      toast.success('Sincronización push iniciada')
    },
    onError: () => toast.error('Error al iniciar sync push'),
  })

  const statusIcon = (estado: string) => {
    switch (estado) {
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
        <div className="flex gap-2">
          <button
            onClick={() => pullMutation.mutate()}
            disabled={pullMutation.isPending}
            className="flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            {pullMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Pull (traer datos)
          </button>
          <button
            onClick={() => pushMutation.mutate()}
            disabled={pushMutation.isPending}
            className="flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {pushMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Push (enviar datos)
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="border-b border-border px-5 py-3">
          <h2 className="font-semibold">Historial de sincronización</h2>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center p-12 text-muted-foreground">Cargando...</div>
        ) : !logs?.length ? (
          <div className="flex items-center justify-center p-12 text-muted-foreground">No hay registros de sincronización</div>
        ) : (
          <div className="divide-y divide-border">
            {logs.map((log) => (
              <div key={log.id} className="flex items-start gap-3 px-5 py-3">
                <div className="mt-0.5">{statusIcon(log.estado)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'inline-flex rounded px-1.5 py-0.5 text-xs font-medium uppercase',
                      log.tipo === 'pull' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600',
                    )}>
                      {log.tipo}
                    </span>
                    <span className="text-sm font-medium capitalize">{log.entidad}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{log.registros} registros</span>
                    {log.errores > 0 && <span className="text-destructive">{log.errores} errores</span>}
                    <span>{formatDateTime(log.createdAt)}</span>
                  </div>
                  {log.mensaje && <p className="mt-1 text-xs text-muted-foreground">{log.mensaje}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
