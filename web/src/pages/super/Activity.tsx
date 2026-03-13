import { useQuery } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { ShoppingCart, Banknote, MapPin, LogIn } from 'lucide-react'
import api from '../../api/client'
import StatsCard from '../../components/StatsCard'
import DataTable from '../../components/DataTable'
import { formatDateTime } from '../../lib/utils'

interface ActivityStats {
  pedidosHoy: number
  cobranzasHoy: number
  jornadasActivas: number
  loginsHoy: number
}

interface Actividad {
  tipo: 'pedido' | 'cobranza' | 'jornada'
  tenantCodigo: string
  tenantNombre: string
  usuario: string
  detalle: string
  monto: number | null
  fecha: string
}

interface ActivityData {
  stats: ActivityStats
  actividades: Actividad[]
}

const tipoBadge: Record<string, string> = {
  pedido: 'bg-blue-100 text-blue-700',
  cobranza: 'bg-green-100 text-green-700',
  jornada: 'bg-amber-100 text-amber-700',
}

const columns: ColumnDef<Actividad>[] = [
  {
    accessorKey: 'tipo',
    header: 'Tipo',
    cell: ({ row }) => (
      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${tipoBadge[row.original.tipo] || 'bg-muted'}`}>
        {row.original.tipo}
      </span>
    ),
  },
  {
    accessorKey: 'tenantNombre',
    header: 'Empresa',
    cell: ({ row }) => (
      <div>
        <p className="text-sm font-medium">{row.original.tenantNombre}</p>
        <p className="text-[11px] text-muted-foreground">{row.original.tenantCodigo}</p>
      </div>
    ),
  },
  {
    accessorKey: 'usuario',
    header: 'Usuario',
  },
  {
    accessorKey: 'detalle',
    header: 'Detalle',
  },
  {
    accessorKey: 'fecha',
    header: 'Fecha',
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground">{formatDateTime(row.original.fecha)}</span>
    ),
  },
]

export default function Activity() {
  const { data, isLoading } = useQuery({
    queryKey: ['super-activity'],
    queryFn: async () => {
      const { data: res } = await api.get('/super/activity')
      return res.data as ActivityData
    },
    refetchInterval: 30000,
  })

  const stats = data?.stats || { pedidosHoy: 0, cobranzasHoy: 0, jornadasActivas: 0, loginsHoy: 0 }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Actividad Global</h1>
        <p className="text-sm text-muted-foreground">Actividad en tiempo real de todas las empresas</p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl border border-border bg-muted/30" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatsCard title="Pedidos Hoy" value={stats.pedidosHoy} icon={<ShoppingCart size={20} />} />
            <StatsCard title="Cobranzas Hoy" value={stats.cobranzasHoy} icon={<Banknote size={20} />} />
            <StatsCard title="Jornadas Activas" value={stats.jornadasActivas} icon={<MapPin size={20} />} />
            <StatsCard title="Logins Hoy" value={stats.loginsHoy} icon={<LogIn size={20} />} />
          </div>

          <DataTable
            columns={columns}
            data={data?.actividades || []}
            searchColumn="tenantNombre"
            searchPlaceholder="Buscar por empresa..."
          />
        </>
      )}
    </div>
  )
}
