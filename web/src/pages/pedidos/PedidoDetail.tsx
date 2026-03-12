import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import api from '../../api/client'
import { formatCurrency, formatDateTime, cn } from '../../lib/utils'

interface PedidoItem {
  productoCodigo: string
  productoNombre: string
  cantidad: number
  unidadTipo: string
  precioUnitario: number
  descuentoPorcentaje: number
  subtotal: number
}

interface PedidoDetalle {
  id: string
  fecha: string
  estado: string
  subtotal: number
  descuentoGlobal: number
  total: number
  observaciones: string | null
  erpSynced: boolean
  erpError: string | null
  condicionVtaCodigo: string | null
  createdAt: string
  cliente: { id: string; nombre: string; codigo: string; direccion: string | null; telefono: string | null }
  vendedor: { id: string; nombre: string; email: string }
  items: PedidoItem[]
}

const estadoColors: Record<string, string> = {
  pendiente: 'bg-warning/10 text-warning',
  confirmado: 'bg-success/10 text-success',
  entregado: 'bg-primary/10 text-primary',
  cancelado: 'bg-destructive/10 text-destructive',
}

export default function PedidoDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const { data: pedido, isLoading } = useQuery({
    queryKey: ['pedido-detail', id],
    queryFn: async () => {
      const { data: res } = await api.get(`/admin/pedidos/${id}`)
      return res.data as PedidoDetalle
    },
    enabled: !!id,
  })

  if (isLoading) return <div className="flex items-center justify-center p-12 text-muted-foreground">Cargando...</div>
  if (!pedido) return <div className="flex items-center justify-center p-12 text-muted-foreground">Pedido no encontrado</div>

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="rounded-lg border border-border p-2 hover:bg-muted transition-colors">
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="text-2xl font-bold">Detalle del Pedido</h1>
          <p className="text-sm text-muted-foreground font-mono">{pedido.id.slice(0, 8)}...</p>
        </div>
      </div>

      {/* Info card */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <span className="text-xs text-muted-foreground">Cliente</span>
            <p className="font-medium">{pedido.cliente.nombre}</p>
            <p className="text-xs text-muted-foreground">{pedido.cliente.codigo}</p>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Vendedor</span>
            <p className="font-medium">{pedido.vendedor.nombre}</p>
            <p className="text-xs text-muted-foreground">{pedido.vendedor.email}</p>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Fecha</span>
            <p className="font-medium">{formatDateTime(pedido.fecha)}</p>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Total</span>
            <p className="text-lg font-bold">{formatCurrency(Number(pedido.total))}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize', estadoColors[pedido.estado] || 'bg-muted')}>
            {pedido.estado}
          </span>
          <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', pedido.erpSynced ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning')}>
            {pedido.erpSynced ? 'Sincronizado' : 'Pendiente ERP'}
          </span>
          {pedido.condicionVtaCodigo && (
            <span className="inline-flex rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">
              Cond. Venta: {pedido.condicionVtaCodigo}
            </span>
          )}
        </div>

        {pedido.erpError && <p className="mt-3 text-xs text-destructive">Error ERP: {pedido.erpError}</p>}
        {pedido.observaciones && <p className="mt-3 text-sm text-muted-foreground">Obs: {pedido.observaciones}</p>}
        {pedido.cliente.direccion && <p className="mt-2 text-xs text-muted-foreground">Direccion: {pedido.cliente.direccion}</p>}
      </div>

      {/* Items table */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-4 font-semibold">Items del pedido ({pedido.items.length})</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="pb-2">Codigo</th>
                <th className="pb-2">Producto</th>
                <th className="pb-2 text-right">Cant</th>
                <th className="pb-2 text-right">Precio</th>
                <th className="pb-2 text-right">Dto%</th>
                <th className="pb-2 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {pedido.items.map((item, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="py-2 font-mono text-xs">{item.productoCodigo}</td>
                  <td className="py-2">{item.productoNombre}</td>
                  <td className="py-2 text-right">{item.cantidad}{item.unidadTipo && item.unidadTipo !== 'unidad' ? ` ${item.unidadTipo}` : ''}</td>
                  <td className="py-2 text-right">{formatCurrency(Number(item.precioUnitario))}</td>
                  <td className="py-2 text-right">{item.descuentoPorcentaje > 0 ? `${item.descuentoPorcentaje}%` : '—'}</td>
                  <td className="py-2 text-right font-medium">{formatCurrency(Number(item.subtotal))}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              {pedido.descuentoGlobal > 0 && (
                <tr className="border-t border-border text-sm">
                  <td colSpan={5} className="py-2 text-right text-muted-foreground">Subtotal:</td>
                  <td className="py-2 text-right">{formatCurrency(Number(pedido.subtotal))}</td>
                </tr>
              )}
              {pedido.descuentoGlobal > 0 && (
                <tr className="text-sm">
                  <td colSpan={5} className="py-1 text-right text-muted-foreground">Descuento:</td>
                  <td className="py-1 text-right text-destructive">-{formatCurrency(Number(pedido.descuentoGlobal))}</td>
                </tr>
              )}
              <tr className="border-t-2 border-border font-bold">
                <td colSpan={5} className="py-2 text-right">Total:</td>
                <td className="py-2 text-right">{formatCurrency(Number(pedido.total))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}
