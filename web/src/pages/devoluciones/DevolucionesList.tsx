import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createColumnHelper } from '@tanstack/react-table'
import { CheckCircle, XCircle, MessageSquare, X } from 'lucide-react'
import { toast } from 'sonner'
import api from '../../api/client'
import DataTable from '../../components/DataTable'
import { formatCurrency, formatDateTime, cn } from '../../lib/utils'

interface DevolucionItem {
  productoCodigo: string
  productoNombre: string
  cantidadDevuelta: number
  precioUnitario: number
  motivo: string | null
  lote: string | null
  subtotal: number
}

interface Devolucion {
  id: string
  tipo: string
  estado: string
  total: number
  motivoGeneral: string | null
  ncNumero: string | null
  facturaNumero: string | null
  erpSynced: boolean
  createdAt: string
  cliente: { nombre: string; codigo: string }
  vendedor: { nombre: string }
  items: DevolucionItem[]
}

const col = createColumnHelper<Devolucion>()

const estadoConfig: Record<string, { label: string; color: string }> = {
  pendiente: { label: 'Pendiente', color: 'bg-warning/10 text-warning' },
  aprobada: { label: 'Aprobada', color: 'bg-success/10 text-success' },
  rechazada: { label: 'Rechazada', color: 'bg-destructive/10 text-destructive' },
  nc_generada: { label: 'NC Generada', color: 'bg-primary/10 text-primary' },
  info_solicitada: { label: 'Info Solicitada', color: 'bg-muted text-muted-foreground' },
}

const tipoLabels: Record<string, string> = {
  devolucion_total: 'Total',
  devolucion_parcial: 'Parcial',
  cambio: 'Cambio',
  reclamo: 'Reclamo',
}

export default function DevolucionesList() {
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState<Devolucion | null>(null)
  const [filtroEstado, setFiltroEstado] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['devoluciones'],
    queryFn: async () => {
      const { data: res } = await api.get('/devoluciones?limit=500')
      return res.data as Devolucion[]
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, estado }: { id: string; estado: string }) =>
      api.patch(`/devoluciones/${id}`, { estado }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devoluciones'] })
      toast.success('Devolución actualizada')
      setSelected(null)
    },
    onError: () => toast.error('Error al actualizar'),
  })

  const filtered = (data || []).filter((d) => {
    if (filtroEstado && d.estado !== filtroEstado) return false
    return true
  })

  const columns = [
    col.accessor('createdAt', { header: 'Fecha', cell: (info) => formatDateTime(info.getValue()) }),
    col.accessor('tipo', {
      header: 'Tipo',
      cell: (info) => <span className="text-xs font-medium">{tipoLabels[info.getValue()] || info.getValue()}</span>,
    }),
    col.accessor('cliente', {
      header: 'Cliente',
      cell: (info) => info.getValue()?.nombre || '—',
    }),
    col.accessor('vendedor', {
      header: 'Vendedor',
      cell: (info) => info.getValue()?.nombre || '—',
    }),
    col.accessor('total', {
      header: 'Total',
      cell: (info) => formatCurrency(Number(info.getValue())),
    }),
    col.accessor('estado', {
      header: 'Estado',
      cell: (info) => {
        const cfg = estadoConfig[info.getValue()] || { label: info.getValue(), color: 'bg-muted' }
        return (
          <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', cfg.color)}>
            {cfg.label}
          </span>
        )
      },
    }),
    col.accessor('ncNumero', {
      header: 'NC',
      cell: (info) => info.getValue() || '—',
    }),
    col.display({
      id: 'actions',
      cell: ({ row }) => {
        const d = row.original
        return (
          <div className="flex items-center gap-1">
            <button onClick={() => setSelected(d)} className="rounded p-1 hover:bg-muted text-primary" title="Ver detalle">
              <MessageSquare size={14} />
            </button>
            {d.estado === 'pendiente' && (
              <>
                <button
                  onClick={() => updateMutation.mutate({ id: d.id, estado: 'aprobada' })}
                  className="rounded p-1 text-success hover:bg-success/10"
                  title="Aprobar"
                >
                  <CheckCircle size={16} />
                </button>
                <button
                  onClick={() => updateMutation.mutate({ id: d.id, estado: 'rechazada' })}
                  className="rounded p-1 text-destructive hover:bg-destructive/10"
                  title="Rechazar"
                >
                  <XCircle size={16} />
                </button>
              </>
            )}
          </div>
        )
      },
    }),
  ]

  const inputCls = 'h-9 rounded-lg border border-input px-3 text-sm outline-none focus:ring-2 focus:ring-ring'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Devoluciones</h1>
        <p className="text-sm text-muted-foreground">Aprobar, rechazar o pedir más información sobre devoluciones</p>
      </div>

      {/* Filtro por estado */}
      <div className="flex gap-3 items-end">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Estado</label>
          <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} className={cn(inputCls, 'w-44')}>
            <option value="">Todos</option>
            {Object.entries(estadoConfig).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>
        {filtroEstado && (
          <button onClick={() => setFiltroEstado('')} className="flex h-9 items-center gap-1 rounded-lg border border-border px-3 text-xs hover:bg-muted">
            <X size={12} /> Limpiar
          </button>
        )}
      </div>

      {/* Detalle */}
      {selected && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Detalle de devolución</h2>
            <button onClick={() => setSelected(null)} className="text-sm text-muted-foreground hover:text-foreground">Cerrar</button>
          </div>

          <div className="mb-4 grid gap-3 text-sm sm:grid-cols-3">
            <div><span className="text-muted-foreground">Cliente:</span> {selected.cliente?.nombre}</div>
            <div><span className="text-muted-foreground">Vendedor:</span> {selected.vendedor?.nombre}</div>
            <div><span className="text-muted-foreground">Fecha:</span> {formatDateTime(selected.createdAt)}</div>
            <div><span className="text-muted-foreground">Tipo:</span> {tipoLabels[selected.tipo] || selected.tipo}</div>
            <div><span className="text-muted-foreground">Total:</span> <span className="font-medium">{formatCurrency(Number(selected.total))}</span></div>
            <div>
              <span className="text-muted-foreground">Estado: </span>
              <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', estadoConfig[selected.estado]?.color || 'bg-muted')}>
                {estadoConfig[selected.estado]?.label || selected.estado}
              </span>
            </div>
          </div>

          {selected.motivoGeneral && (
            <div className="mb-4 rounded-lg bg-muted/30 p-3 text-sm">
              <span className="font-medium">Motivo:</span> {selected.motivoGeneral}
            </div>
          )}
          {selected.facturaNumero && (
            <p className="mb-4 text-sm"><span className="text-muted-foreground">Factura original:</span> {selected.facturaNumero}</p>
          )}
          {selected.ncNumero && (
            <p className="mb-4 text-sm"><span className="text-muted-foreground">Nota de crédito:</span> {selected.ncNumero}</p>
          )}

          {/* Items */}
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="pb-2">Código</th>
                <th className="pb-2">Producto</th>
                <th className="pb-2 text-right">Cant</th>
                <th className="pb-2 text-right">Precio</th>
                <th className="pb-2">Motivo</th>
                <th className="pb-2 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {selected.items?.map((item, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="py-2 font-mono text-xs">{item.productoCodigo}</td>
                  <td className="py-2">{item.productoNombre}</td>
                  <td className="py-2 text-right">{item.cantidadDevuelta}</td>
                  <td className="py-2 text-right">{formatCurrency(Number(item.precioUnitario))}</td>
                  <td className="py-2 text-xs text-muted-foreground">{item.motivo || '—'}</td>
                  <td className="py-2 text-right font-medium">{formatCurrency(Number(item.subtotal))}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Acciones */}
          {selected.estado === 'pendiente' && (
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => updateMutation.mutate({ id: selected.id, estado: 'aprobada' })}
                className="flex items-center gap-1.5 rounded-lg bg-success px-4 py-2 text-sm font-medium text-success-foreground hover:bg-success/90"
              >
                <CheckCircle size={14} /> Aprobar
              </button>
              <button
                onClick={() => updateMutation.mutate({ id: selected.id, estado: 'rechazada' })}
                className="flex items-center gap-1.5 rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
              >
                <XCircle size={14} /> Rechazar
              </button>
              <button
                onClick={() => updateMutation.mutate({ id: selected.id, estado: 'info_solicitada' })}
                className="flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                <MessageSquare size={14} /> Pedir más info
              </button>
            </div>
          )}
        </div>
      )}

      <DataTable data={filtered} columns={columns} searchPlaceholder="Buscar devoluciones..." loading={isLoading} />
    </div>
  )
}
