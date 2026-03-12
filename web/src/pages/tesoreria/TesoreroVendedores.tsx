import { useQuery } from '@tanstack/react-query'
import { createColumnHelper } from '@tanstack/react-table'
import { useNavigate } from 'react-router-dom'
import api from '../../api/client'
import DataTable from '../../components/DataTable'
import { formatCurrency, cn } from '../../lib/utils'

interface VendedorRow {
  id: string
  nombre: string
  email: string
  jornadaActiva: boolean
  cobradoHoy: number
  rendicion: { id: string; estado: string } | null
}

const col = createColumnHelper<VendedorRow>()

const estadoRendicionColors: Record<string, string> = {
  pendiente: 'bg-amber-100 text-amber-700',
  entregado: 'bg-blue-100 text-blue-700',
  aprobado: 'bg-green-100 text-green-700',
  rechazado: 'bg-red-100 text-red-700',
  con_diferencia: 'bg-orange-100 text-orange-700',
}

export default function TesoreroVendedores() {
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['tesoreria-vendedores'],
    queryFn: async () => {
      const { data: res } = await api.get('/tesoreria/vendedores')
      return res.data as VendedorRow[]
    },
    refetchInterval: 30000,
  })

  const columns = [
    col.accessor('nombre', { header: 'Nombre' }),
    col.accessor('email', { header: 'Email' }),
    col.accessor('jornadaActiva', {
      header: 'Jornada',
      cell: (info) => (
        <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
          info.getValue() ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500')}>
          {info.getValue() ? 'Activa' : 'Sin jornada'}
        </span>
      ),
    }),
    col.accessor('cobradoHoy', {
      header: 'Cobrado Hoy',
      cell: (info) => <span className="font-medium">{formatCurrency(Number(info.getValue()))}</span>,
    }),
    col.accessor('rendicion', {
      header: 'Rendicion',
      cell: (info) => {
        const r = info.getValue()
        if (!r) return <span className="text-xs text-muted-foreground">Sin rendicion</span>
        return (
          <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize', estadoRendicionColors[r.estado] || 'bg-muted')}>
            {r.estado.replace('_', ' ')}
          </span>
        )
      },
    }),
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Vendedores</h1>
        <p className="text-sm text-muted-foreground">Estado de vendedores del dia</p>
      </div>

      <DataTable
        data={data || []}
        columns={columns}
        searchPlaceholder="Buscar vendedores..."
        loading={isLoading}
        onRowClick={(row) => navigate(`/tesoreria/vendedores/${row.id}`)}
      />
    </div>
  )
}
