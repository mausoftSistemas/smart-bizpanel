import { useQuery } from '@tanstack/react-query'
import { createColumnHelper } from '@tanstack/react-table'
import api from '../../api/client'
import DataTable from '../../components/DataTable'
import { formatCurrency, formatDateTime, cn } from '../../lib/utils'

interface Cobranza {
  id: string
  numero: number
  fecha: string
  monto: number
  syncStatus: string
  cliente: { razonSocial: string }
  vendedor: { nombre: string }
  medios: { tipo: string; monto: number; referencia: string | null }[]
}

const col = createColumnHelper<Cobranza>()

const syncColors: Record<string, string> = {
  pending: 'bg-warning/10 text-warning',
  synced: 'bg-success/10 text-success',
  error: 'bg-destructive/10 text-destructive',
}

const columns = [
  col.accessor('numero', { header: '#' }),
  col.accessor('fecha', { header: 'Fecha', cell: (info) => formatDateTime(info.getValue()) }),
  col.accessor('cliente.razonSocial', { header: 'Cliente' }),
  col.accessor('vendedor.nombre', { header: 'Vendedor' }),
  col.accessor('monto', { header: 'Monto', cell: (info) => formatCurrency(info.getValue()) }),
  col.accessor('medios', {
    header: 'Medios',
    cell: (info) => info.getValue().map((m) => m.tipo).join(', '),
  }),
  col.accessor('syncStatus', {
    header: 'Sync',
    cell: (info) => (
      <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', syncColors[info.getValue()] || 'bg-muted')}>
        {info.getValue()}
      </span>
    ),
  }),
]

export default function CobranzasList() {
  const { data, isLoading } = useQuery({
    queryKey: ['cobranzas'],
    queryFn: async () => {
      const { data: res } = await api.get('/cobranzas?limit=500')
      return res.data as Cobranza[]
    },
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Cobranzas</h1>
        <p className="text-sm text-muted-foreground">Cobranzas registradas por los vendedores</p>
      </div>
      <DataTable data={data || []} columns={columns} searchPlaceholder="Buscar cobranzas..." loading={isLoading} />
    </div>
  )
}
