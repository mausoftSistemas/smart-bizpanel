import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createColumnHelper } from '@tanstack/react-table'
import { CheckCircle, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import api from '../../api/client'
import DataTable from '../../components/DataTable'
import { formatCurrency, formatDateTime, cn } from '../../lib/utils'

interface Devolucion {
  id: string
  numero: number
  fecha: string
  motivo: string
  estado: string
  total: number
  notaCreditoNumero: string | null
  cliente: { razonSocial: string }
  vendedor: { nombre: string }
  items: { producto: { nombre: string }; cantidad: number; precioUnitario: number }[]
}

const col = createColumnHelper<Devolucion>()

const estadoColors: Record<string, string> = {
  pendiente: 'bg-warning/10 text-warning',
  aprobada: 'bg-success/10 text-success',
  rechazada: 'bg-destructive/10 text-destructive',
}

export default function DevolucionesList() {
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['devoluciones'],
    queryFn: async () => {
      const { data: res } = await api.get('/devoluciones?limit=500')
      return res.data as Devolucion[]
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, estado }: { id: string; estado: string }) => api.patch(`/devoluciones/${id}`, { estado }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devoluciones'] })
      toast.success('Devolución actualizada')
    },
    onError: () => toast.error('Error al actualizar'),
  })

  const columns = [
    col.accessor('numero', { header: '#' }),
    col.accessor('fecha', { header: 'Fecha', cell: (info) => formatDateTime(info.getValue()) }),
    col.accessor('cliente.razonSocial', { header: 'Cliente' }),
    col.accessor('vendedor.nombre', { header: 'Vendedor' }),
    col.accessor('motivo', { header: 'Motivo' }),
    col.accessor('total', { header: 'Total', cell: (info) => formatCurrency(info.getValue()) }),
    col.accessor('estado', {
      header: 'Estado',
      cell: (info) => (
        <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', estadoColors[info.getValue()] || 'bg-muted')}>
          {info.getValue()}
        </span>
      ),
    }),
    col.accessor('notaCreditoNumero', {
      header: 'NC',
      cell: (info) => info.getValue() || '—',
    }),
    col.display({
      id: 'actions',
      cell: ({ row }) => {
        if (row.original.estado !== 'pendiente') return null
        return (
          <div className="flex items-center gap-1">
            <button
              onClick={() => updateMutation.mutate({ id: row.original.id, estado: 'aprobada' })}
              className="rounded p-1 text-success hover:bg-success/10"
              title="Aprobar"
            >
              <CheckCircle size={16} />
            </button>
            <button
              onClick={() => updateMutation.mutate({ id: row.original.id, estado: 'rechazada' })}
              className="rounded p-1 text-destructive hover:bg-destructive/10"
              title="Rechazar"
            >
              <XCircle size={16} />
            </button>
          </div>
        )
      },
    }),
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Devoluciones</h1>
        <p className="text-sm text-muted-foreground">Aprobar o rechazar devoluciones, generar notas de crédito</p>
      </div>
      <DataTable data={data || []} columns={columns} searchPlaceholder="Buscar devoluciones..." loading={isLoading} />
    </div>
  )
}
