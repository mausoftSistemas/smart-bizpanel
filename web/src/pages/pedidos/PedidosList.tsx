import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createColumnHelper } from '@tanstack/react-table'
import { Eye, X } from 'lucide-react'
import api from '../../api/client'
import DataTable from '../../components/DataTable'
import { formatCurrency, formatDateTime, formatDate, cn } from '../../lib/utils'

interface PedidoItem {
  productoCodigo: string
  productoNombre: string
  cantidad: number
  unidadTipo: string | null
  precioUnitario: number
  descuentoPorcentaje: number
  subtotal: number
}

interface Pedido {
  id: string
  fecha: string
  total: number
  subtotal: number
  descuentoGlobal: number
  estado: string
  erpSynced: boolean
  erpError: string | null
  observaciones: string | null
  createdAt: string
  cliente: { nombre: string; codigo: string }
  vendedor: { nombre: string }
  items: PedidoItem[]
}

const col = createColumnHelper<Pedido>()

const estadoColors: Record<string, string> = {
  pendiente: 'bg-warning/10 text-warning',
  confirmado: 'bg-success/10 text-success',
  entregado: 'bg-primary/10 text-primary',
  cancelado: 'bg-destructive/10 text-destructive',
}

const syncColors: Record<string, string> = {
  true: 'bg-success/10 text-success',
  false: 'bg-warning/10 text-warning',
}

export default function PedidosList() {
  const [selected, setSelected] = useState<Pedido | null>(null)
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroVendedor, setFiltroVendedor] = useState('')
  const [filtroDesde, setFiltroDesde] = useState('')
  const [filtroHasta, setFiltroHasta] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['pedidos'],
    queryFn: async () => {
      const { data: res } = await api.get('/pedidos?limit=500')
      return res.data as Pedido[]
    },
  })

  // Filtrado client-side
  const filtered = (data || []).filter((p) => {
    if (filtroEstado && p.estado !== filtroEstado) return false
    if (filtroVendedor && !p.vendedor?.nombre?.toLowerCase().includes(filtroVendedor.toLowerCase())) return false
    if (filtroDesde && new Date(p.fecha) < new Date(filtroDesde)) return false
    if (filtroHasta) {
      const hasta = new Date(filtroHasta)
      hasta.setDate(hasta.getDate() + 1)
      if (new Date(p.fecha) >= hasta) return false
    }
    return true
  })

  // Vendedores únicos para el filtro
  const vendedores = [...new Set((data || []).map((p) => p.vendedor?.nombre).filter(Boolean))]

  const columns = [
    col.accessor('fecha', { header: 'Fecha', cell: (info) => formatDate(info.getValue()) }),
    col.accessor('vendedor', {
      header: 'Vendedor',
      cell: (info) => info.getValue()?.nombre || '—',
    }),
    col.accessor('cliente', {
      header: 'Cliente',
      cell: (info) => {
        const c = info.getValue()
        return c ? <span title={c.codigo}>{c.nombre}</span> : '—'
      },
    }),
    col.accessor('total', {
      header: 'Total',
      cell: (info) => <span className="font-medium">{formatCurrency(Number(info.getValue()))}</span>,
    }),
    col.accessor('estado', {
      header: 'Estado',
      cell: (info) => (
        <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize', estadoColors[info.getValue()] || 'bg-muted')}>
          {info.getValue()}
        </span>
      ),
    }),
    col.accessor('erpSynced', {
      header: 'ERP',
      cell: (info) => (
        <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium', syncColors[String(info.getValue())])}>
          {info.getValue() ? 'Sync' : 'Pendiente'}
        </span>
      ),
    }),
    col.display({
      id: 'actions',
      cell: ({ row }) => (
        <button onClick={() => setSelected(row.original)} className="rounded p-1 hover:bg-muted" title="Ver detalle">
          <Eye size={14} />
        </button>
      ),
    }),
  ]

  const inputCls = 'h-9 rounded-lg border border-input px-3 text-sm outline-none focus:ring-2 focus:ring-ring'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Pedidos</h1>
        <p className="text-sm text-muted-foreground">Pedidos registrados por los vendedores (solo lectura)</p>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Estado</label>
          <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} className={cn(inputCls, 'w-36')}>
            <option value="">Todos</option>
            <option value="pendiente">Pendiente</option>
            <option value="confirmado">Confirmado</option>
            <option value="entregado">Entregado</option>
            <option value="cancelado">Cancelado</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Vendedor</label>
          <select value={filtroVendedor} onChange={(e) => setFiltroVendedor(e.target.value)} className={cn(inputCls, 'w-44')}>
            <option value="">Todos</option>
            {vendedores.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Desde</label>
          <input type="date" value={filtroDesde} onChange={(e) => setFiltroDesde(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Hasta</label>
          <input type="date" value={filtroHasta} onChange={(e) => setFiltroHasta(e.target.value)} className={inputCls} />
        </div>
        {(filtroEstado || filtroVendedor || filtroDesde || filtroHasta) && (
          <button
            onClick={() => { setFiltroEstado(''); setFiltroVendedor(''); setFiltroDesde(''); setFiltroHasta('') }}
            className="flex h-9 items-center gap-1 rounded-lg border border-border px-3 text-xs hover:bg-muted"
          >
            <X size={12} /> Limpiar
          </button>
        )}
      </div>

      {/* Detalle */}
      {selected && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Detalle del pedido</h2>
            <button onClick={() => setSelected(null)} className="text-sm text-muted-foreground hover:text-foreground">Cerrar</button>
          </div>
          <div className="mb-4 grid gap-3 text-sm sm:grid-cols-4">
            <div><span className="text-muted-foreground">Cliente:</span> {selected.cliente?.nombre}</div>
            <div><span className="text-muted-foreground">Vendedor:</span> {selected.vendedor?.nombre}</div>
            <div><span className="text-muted-foreground">Fecha:</span> {formatDateTime(selected.fecha)}</div>
            <div><span className="text-muted-foreground">Total:</span> <span className="font-medium">{formatCurrency(Number(selected.total))}</span></div>
          </div>
          <div className="mb-4 flex gap-2 text-xs">
            <span className={cn('rounded-full px-2 py-0.5 font-medium capitalize', estadoColors[selected.estado] || 'bg-muted')}>
              {selected.estado}
            </span>
            <span className={cn('rounded-full px-2 py-0.5 font-medium', selected.erpSynced ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning')}>
              {selected.erpSynced ? 'Sincronizado' : 'Pendiente ERP'}
            </span>
          </div>
          {selected.erpError && (
            <p className="mb-4 text-xs text-destructive">Error ERP: {selected.erpError}</p>
          )}
          {selected.observaciones && <p className="mb-4 text-sm text-muted-foreground">Obs: {selected.observaciones}</p>}
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="pb-2">Código</th>
                <th className="pb-2">Producto</th>
                <th className="pb-2 text-right">Cant</th>
                <th className="pb-2 text-right">Precio</th>
                <th className="pb-2 text-right">Dto%</th>
                <th className="pb-2 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {selected.items?.map((item, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="py-2 font-mono text-xs">{item.productoCodigo}</td>
                  <td className="py-2">{item.productoNombre}</td>
                  <td className="py-2 text-right">{item.cantidad}{item.unidadTipo ? ` ${item.unidadTipo}` : ''}</td>
                  <td className="py-2 text-right">{formatCurrency(Number(item.precioUnitario))}</td>
                  <td className="py-2 text-right">{item.descuentoPorcentaje > 0 ? `${item.descuentoPorcentaje}%` : '—'}</td>
                  <td className="py-2 text-right font-medium">{formatCurrency(Number(item.subtotal))}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border font-medium">
                <td colSpan={5} className="py-2 text-right">Total:</td>
                <td className="py-2 text-right">{formatCurrency(Number(selected.total))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <DataTable data={filtered} columns={columns} searchPlaceholder="Buscar pedidos..." loading={isLoading} />
    </div>
  )
}
