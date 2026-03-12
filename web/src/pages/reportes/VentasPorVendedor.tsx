import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import api from '../../api/client'
import { formatCurrency } from '../../lib/utils'

interface VentaVendedor {
  nombre: string
  pedidos: number
  montoPedidos: number
  cobranzas: number
  montoCobranzas: number
}

export default function VentasPorVendedor() {
  const [periodo, setPeriodo] = useState('hoy')

  const { data, isLoading } = useQuery({
    queryKey: ['reporte-ventas', periodo],
    queryFn: async () => {
      try {
        const { data: res } = await api.get(`/admin/reportes/ventas-vendedor?periodo=${periodo}`)
        return res.data as VentaVendedor[]
      } catch {
        return []
      }
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Ventas por Vendedor</h1>
          <p className="text-sm text-muted-foreground">Resumen de pedidos y cobranzas por vendedor</p>
        </div>
        <select
          value={periodo}
          onChange={(e) => setPeriodo(e.target.value)}
          className="h-9 rounded-lg border border-input px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="hoy">Hoy</option>
          <option value="semana">Esta semana</option>
          <option value="mes">Este mes</option>
          <option value="anio">Este año</option>
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-border p-4">
          <p className="text-sm text-muted-foreground">Total pedidos</p>
          <p className="text-xl font-bold">{totales.pedidos}</p>
        </div>
        <div className="rounded-lg border border-border p-4">
          <p className="text-sm text-muted-foreground">Monto pedidos</p>
          <p className="text-xl font-bold">{formatCurrency(totales.montoPedidos)}</p>
        </div>
        <div className="rounded-lg border border-border p-4">
          <p className="text-sm text-muted-foreground">Total cobranzas</p>
          <p className="text-xl font-bold">{totales.cobranzas}</p>
        </div>
        <div className="rounded-lg border border-border p-4">
          <p className="text-sm text-muted-foreground">Monto cobranzas</p>
          <p className="text-xl font-bold">{formatCurrency(totales.montoCobranzas)}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-12 text-muted-foreground">Cargando...</div>
      ) : (data || []).length > 0 ? (
        <div className="rounded-xl border border-border bg-card p-5">
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={data} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis dataKey="nombre" type="category" width={120} tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value: number, name: string) => [formatCurrency(value), name === 'montoPedidos' ? 'Pedidos' : 'Cobranzas']}
                contentStyle={{ borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '13px' }}
              />
              <Legend />
              <Bar dataKey="montoPedidos" name="Pedidos" fill="var(--color-primary)" radius={[0, 4, 4, 0]} />
              <Bar dataKey="montoCobranzas" name="Cobranzas" fill="var(--color-success)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="flex items-center justify-center rounded-xl border border-border p-12 text-muted-foreground">
          Sin datos para el período seleccionado
        </div>
      )}

      {(data || []).length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Vendedor</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Pedidos</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">$ Pedidos</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Cobranzas</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">$ Cobranzas</th>
              </tr>
            </thead>
            <tbody>
              {(data || []).map((v) => (
                <tr key={v.nombre} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium">{v.nombre}</td>
                  <td className="px-4 py-3 text-right">{v.pedidos}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(v.montoPedidos)}</td>
                  <td className="px-4 py-3 text-right">{v.cobranzas}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(v.montoCobranzas)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
