import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Download, Loader2 } from 'lucide-react'
import api from '../../api/client'
import { formatCurrency, cn } from '../../lib/utils'

interface VentaVendedor {
  vendedorNombre: string
  pedidos: number
  montoPedidos: number
  cobranzas: number
  montoCobranzas: number
  ticketPromedio: number
  clientesVisitados: number
  clientesTotal: number
  cobertura: number
}

function getDefaultDates() {
  const now = new Date()
  const desde = new Date(now.getFullYear(), now.getMonth(), 1)
  return {
    desde: desde.toISOString().split('T')[0],
    hasta: now.toISOString().split('T')[0],
  }
}

export default function VentasPorVendedor() {
  const defaults = getDefaultDates()
  const [desde, setDesde] = useState(defaults.desde)
  const [hasta, setHasta] = useState(defaults.hasta)

  const { data, isLoading } = useQuery({
    queryKey: ['reporte-ventas', desde, hasta],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (desde) params.set('desde', desde)
      if (hasta) params.set('hasta', hasta)
      const { data: res } = await api.get(`/admin/reportes/ventas-vendedor?${params}`)
      return res.data as VentaVendedor[]
    },
  })

  const totales = (data || []).reduce(
    (acc, v) => ({
      pedidos: acc.pedidos + v.pedidos,
      montoPedidos: acc.montoPedidos + v.montoPedidos,
      cobranzas: acc.cobranzas + v.cobranzas,
      montoCobranzas: acc.montoCobranzas + v.montoCobranzas,
    }),
    { pedidos: 0, montoPedidos: 0, cobranzas: 0, montoCobranzas: 0 },
  )

  const exportExcel = () => {
    if (!data?.length) return
    const headers = ['Vendedor', 'Pedidos', 'Monto Pedidos', 'Cobranzas', 'Monto Cobranzas', 'Ticket Promedio', 'Clientes Visitados', 'Clientes Total', 'Cobertura %']
    const rows = data.map(v => [
      v.vendedorNombre, v.pedidos, v.montoPedidos.toFixed(2), v.cobranzas,
      v.montoCobranzas.toFixed(2), v.ticketPromedio.toFixed(2),
      v.clientesVisitados, v.clientesTotal, v.cobertura.toFixed(1),
    ])
    const csv = [headers.join('\t'), ...rows.map(r => r.join('\t'))].join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/tab-separated-values;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ventas_vendedor_${desde}_${hasta}.xls`
    a.click()
    URL.revokeObjectURL(url)
  }

  const inputCls = 'h-9 rounded-lg border border-input px-3 text-sm outline-none focus:ring-2 focus:ring-ring'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Ventas por Vendedor</h1>
          <p className="text-sm text-muted-foreground">Resumen de ventas y cobranzas por vendedor</p>
        </div>
        <button
          onClick={exportExcel}
          disabled={!data?.length}
          className="flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
        >
          <Download size={14} /> Exportar Excel
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Desde</label>
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Hasta</label>
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className={inputCls} />
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground">Total pedidos</p>
          <p className="text-xl font-bold">{totales.pedidos}</p>
        </div>
        <div className="rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground">Monto pedidos</p>
          <p className="text-xl font-bold">{formatCurrency(totales.montoPedidos)}</p>
        </div>
        <div className="rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground">Total cobranzas</p>
          <p className="text-xl font-bold">{totales.cobranzas}</p>
        </div>
        <div className="rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground">Monto cobranzas</p>
          <p className="text-xl font-bold">{formatCurrency(totales.montoCobranzas)}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-12 text-muted-foreground">
          <Loader2 size={20} className="animate-spin mr-2" /> Cargando...
        </div>
      ) : (data || []).length > 0 ? (
        <>
          {/* Gráfico */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 font-semibold">Comparativo</h2>
            <ResponsiveContainer width="100%" height={Math.max(300, (data?.length || 0) * 50)}>
              <BarChart data={data} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <YAxis dataKey="vendedorNombre" type="category" width={130} tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    formatCurrency(value),
                    name === 'montoPedidos' ? 'Pedidos' : 'Cobranzas',
                  ]}
                  contentStyle={{ borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '13px' }}
                />
                <Legend />
                <Bar dataKey="montoPedidos" name="Pedidos" fill="var(--color-primary)" radius={[0, 4, 4, 0]} />
                <Bar dataKey="montoCobranzas" name="Cobranzas" fill="var(--color-success)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Tabla */}
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-xs">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Vendedor</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Pedidos</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">$ Pedidos</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Ticket Prom.</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Cobranzas</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">$ Cobranzas</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Cobertura</th>
                </tr>
              </thead>
              <tbody>
                {data!.map((v) => (
                  <tr key={v.vendedorNombre} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium">{v.vendedorNombre}</td>
                    <td className="px-4 py-3 text-right">{v.pedidos}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(v.montoPedidos)}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(v.ticketPromedio)}</td>
                    <td className="px-4 py-3 text-right">{v.cobranzas}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(v.montoCobranzas)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn('h-full rounded-full', v.cobertura >= 80 ? 'bg-success' : v.cobertura >= 50 ? 'bg-warning' : 'bg-destructive')}
                            style={{ width: `${Math.min(v.cobertura, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs">{v.cobertura.toFixed(0)}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border font-semibold bg-muted/30">
                  <td className="px-4 py-3">TOTAL</td>
                  <td className="px-4 py-3 text-right">{totales.pedidos}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(totales.montoPedidos)}</td>
                  <td className="px-4 py-3 text-right">{totales.pedidos > 0 ? formatCurrency(totales.montoPedidos / totales.pedidos) : '—'}</td>
                  <td className="px-4 py-3 text-right">{totales.cobranzas}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(totales.montoCobranzas)}</td>
                  <td className="px-4 py-3 text-right">—</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      ) : (
        <div className="flex items-center justify-center rounded-xl border border-border p-12 text-muted-foreground">
          Sin datos para el período seleccionado
        </div>
      )}
    </div>
  )
}
