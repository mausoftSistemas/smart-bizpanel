import { useQuery } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { RefreshCw, AlertTriangle, Clock } from 'lucide-react'
import api from '../../api/client'
import StatsCard from '../../components/StatsCard'
import DataTable from '../../components/DataTable'
import { formatDateTime } from '../../lib/utils'

interface SyncStats {
  syncsHoy: number
  erroresHoy: number
  sinSync24h: number
}

interface TenantSync {
  id: string
  codigo: string
  razonSocial: string
  erpTipo: string
  estado: string
  ultimoSync: { fecha: string; status: string; entidad: string } | null
  syncsHoy: number
  erroresHoy: number
  sinSync24h: boolean
}

interface SyncData {
  stats: SyncStats
  tenants: TenantSync[]
}

const statusBadge: Record<string, string> = {
  success: 'bg-green-100 text-green-700',
  error: 'bg-red-100 text-red-700',
}

const columns: ColumnDef<TenantSync>[] = [
  {
    accessorKey: 'razonSocial',
    header: 'Empresa',
    cell: ({ row }) => (
      <div>
        <p className="text-sm font-medium">{row.original.razonSocial}</p>
        <p className="text-[11px] text-muted-foreground">{row.original.codigo}</p>
      </div>
    ),
  },
  {
    accessorKey: 'erpTipo',
    header: 'ERP',
    cell: ({ row }) => (
      <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium">
        {row.original.erpTipo}
      </span>
    ),
  },
  {
    id: 'ultimoSync',
    header: 'Último Sync',
    cell: ({ row }) => {
      const sync = row.original.ultimoSync
      if (!sync) return <span className="text-xs text-muted-foreground">Nunca</span>
      return (
        <div>
          <p className="text-xs">{formatDateTime(sync.fecha)}</p>
          <p className="text-[11px] text-muted-foreground">{sync.entidad}</p>
        </div>
      )
    },
  },
  {
    id: 'estado',
    header: 'Estado',
    cell: ({ row }) => {
      const sync = row.original.ultimoSync
      if (!sync) return <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">sin datos</span>
      return (
        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${statusBadge[sync.status] || 'bg-muted'}`}>
          {sync.status}
        </span>
      )
    },
  },
  {
    accessorKey: 'syncsHoy',
    header: 'Syncs Hoy',
    cell: ({ row }) => <span className="font-mono text-sm">{row.original.syncsHoy}</span>,
  },
  {
    accessorKey: 'erroresHoy',
    header: 'Errores',
    cell: ({ row }) => (
      <span className={`font-mono text-sm ${row.original.erroresHoy > 0 ? 'text-red-600 font-medium' : ''}`}>
        {row.original.erroresHoy}
      </span>
    ),
  },
]

export default function SyncStatusGlobal() {
  const { data, isLoading } = useQuery({
    queryKey: ['super-sync'],
    queryFn: async () => {
      const { data: res } = await api.get('/super/sync')
      return res.data as SyncData
    },
    refetchInterval: 30000,
  })

  const stats = data?.stats || { syncsHoy: 0, erroresHoy: 0, sinSync24h: 0 }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Sync Status Global</h1>
        <p className="text-sm text-muted-foreground">Estado de sincronización de todas las empresas</p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl border border-border bg-muted/30" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatsCard title="Syncs Hoy" value={stats.syncsHoy} icon={<RefreshCw size={20} />} />
            <StatsCard
              title="Errores Hoy"
              value={stats.erroresHoy}
              icon={<AlertTriangle size={20} />}
              className={stats.erroresHoy > 0 ? 'border-red-200' : ''}
            />
            <StatsCard
              title="Sin Sync 24h"
              value={stats.sinSync24h}
              icon={<Clock size={20} />}
              subtitle="Excluyendo standalone"
              className={stats.sinSync24h > 0 ? 'border-amber-200' : ''}
            />
          </div>

          <DataTable
            columns={columns}
            data={data?.tenants || []}
            searchColumn="razonSocial"
            searchPlaceholder="Buscar empresa..."
          />
        </>
      )}
    </div>
  )
}
