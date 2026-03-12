import { useQuery } from '@tanstack/react-query'
import { createColumnHelper } from '@tanstack/react-table'
import { Eye } from 'lucide-react'
import api from '../../api/client'
import DataTable from '../../components/DataTable'
import { formatCurrency, formatDateTime } from '../../lib/utils'
import { cn } from '../../lib/utils'
import { useState } from 'react'

interface Pedido {
  id: string
  numero: number
  fecha: string
  total: number
  estado: string
  syncStatus: string
  observaciones: string | null
  cliente: { razonSocial: string; codigoErp: string }
  vendedor: { nombre: string }
  items: { producto: { nombre: string }; cantidad: number; precioUnitario: number; subtotal: number }[]
}

const col = createColumnHelper<Pedido>()

const syncStatusColors: Record<string, string> = {
  pending: 'bg-warning/10 text-warning',
  synced: 'bg-success/10 text-success',
  error: 'bg-destructive/10 text-destructive',
}

export default function PedidosList() {
  const [selected, setSelected] = useState<Pedido | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['pedidos'],
    queryFn: async () => {
      const { data: res } = await api.get('/pedidos?limit=500')
      return res.data as Pedido[]
    },
  })

  const columns = [
    col.accessor('numero', { header: '#' }),
    col.accessor('fecha', { header: 'Fecha', cell: (info) => formatDateTime(info.getValue()) }),
    col.accessor('cliente.razonSocial', { header: 'Cliente' }),
    col.accessor('vendedor.nombre', { header: 'Vendedor' }),
    col.accessor('total', { header: 'Total', cell: (info) => formatCurrency(info.getValue()) }),
    col.accessor('estado', {
      header: 'Estado',
      cell: (info) => <span className="capitalize">{info.getValue()}</span>,
    }),
    col.accessor('syncStatus', {
      header: 'Sync',
      cell: (info) => (
        <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', syncStatusColors[info.getValue()] || 'bg-muted')}>
          {info.getValue()}
        </span>
      ),
    }),
    col.display({
      id: 'actions',
      cell: ({ row }) => (
        <button onClick={() => setSelected(row.original)} className="rounded p-1 hover:bg-muted">
          <Eye size={14} />
        </button>
      ),
    }),
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Pedidos</h1>
        <p className="text-sm text-muted-foreground">Pedidos registrados por los vendedores</p>
      </div>

      {selected && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Pedido #{selected.numero}</h2>
            <button onClick={() => setSelected(null)} className="text-sm text-muted-foreground hover:text-foreground">Cerrar</button>
          </div>
          <div className="mb-4 grid gap-3 text-sm sm:grid-cols-4">
            <div><span className="text-muted-foreground">Cliente:</span> {selected.cliente.razonSocial}</div>
            <div><span className="text-muted-foreground">Vendedor:</span> {selected.vendedor.nombre}</div>
            <div><span className="text-muted-foreground">Fecha:</span> {formatDateTime(selected.fecha)}</div>
            <div><span className="text-muted-foreground">Total:</span> {formatCurrency(selected.total)}</div>
          </div>
          {selected.observaciones && <p className="mb-4 text-sm text-muted-foreground">Obs: {selected.observaciones}</p>}
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="pb-2">Producto</th>
                <th className="pb-2">Cant</th>
                <th className="pb-2">Precio</th>
                <th className="pb-2">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {selected.items.map((item, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="py-2">{item.producto.nombre}</td>
                  <td className="py-2">{item.cantidad}</td>
                  <td className="py-2">{formatCurrency(item.precioUnitario)}</td>
                  <td className="py-2">{formatCurrency(item.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <DataTable data={data || []} columns={columns} searchPlaceholder="Buscar pedidos..." loading={isLoading} />
    </div>
  )
}
