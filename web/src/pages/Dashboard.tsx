import { useQuery } from '@tanstack/react-query'
import { ShoppingCart, Banknote, Users, TrendingUp, Package, AlertCircle } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import api from '../api/client'
import StatsCard from '../components/StatsCard'
import { formatCurrency, formatDateTime } from '../lib/utils'
import { cn } from '../lib/utils'

interface DashboardData {
  pedidosHoy: number
  montoPedidosHoy: number
  cobranzasHoy: number
  montoCobranzasHoy: number
  vendedoresActivos: number
  productosActivos: number
  clientesActivos: number
  syncPendientes: number
  ventasSemana: { dia: string; monto: number }[]
  ultimosPedidos: {
    id: string
    fecha: string
    total: number
    estado: string
    createdAt: string
    cliente: { nombre: string; codigo: string }
    vendedor: { nombre: string }
  }[]
}

const estadoColors: Record<string, string> = {
  pendiente: 'bg-warning/10 text-warning',
  confirmado: 'bg-success/10 text-success',
  entregado: 'bg-primary/10 text-primary',
  cancelado: 'bg-destructive/10 text-destructive',
}

export default function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      try {
        const { data: res } = await api.get('/admin/dashboard')
        return res.data as DashboardData
      } catch {
        return null
      }
    },
    refetchInterval: 60000,
  })

  const stats: DashboardData = data || {
    pedidosHoy: 0,
    montoPedidosHoy: 0,
    cobranzasHoy: 0,
    montoCobranzasHoy: 0,
    vendedoresActivos: 0,
    productosActivos: 0,
    clientesActivos: 0,
    syncPendientes: 0,
    ventasSemana: [],
    ultimosPedidos: [],
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Resumen del día</p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl border border-border bg-muted/30" />
          ))}
        </div>
      ) : (
        <>
          {/* Stats principales */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatsCard
              title="Vendedores Activos"
              value={stats.vendedoresActivos}
              subtitle="Jornadas activas hoy"
              icon={<Users size={20} />}
            />
            <StatsCard
              title="Pedidos Hoy"
              value={stats.pedidosHoy}
              subtitle={`${formatCurrency(stats.montoPedidosHoy)} total`}
              icon={<ShoppingCart size={20} />}
            />
            <StatsCard
              title="Monto Vendido Hoy"
              value={formatCurrency(stats.montoPedidosHoy)}
              icon={<TrendingUp size={20} />}
            />
            <StatsCard
              title="Cobranzas Hoy"
              value={stats.cobranzasHoy}
              subtitle={formatCurrency(stats.montoCobranzasHoy)}
              icon={<Banknote size={20} />}
            />
          </div>

          {/* Stats secundarios */}
          <div className="grid gap-4 sm:grid-cols-3">
            <StatsCard title="Productos" value={stats.productosActivos} icon={<Package size={20} />} />
            <StatsCard title="Clientes" value={stats.clientesActivos} icon={<Users size={20} />} />
            <StatsCard
              title="Sync Pendientes"
              value={stats.syncPendientes}
              icon={<AlertCircle size={20} />}
              className={stats.syncPendientes > 0 ? 'border-warning/30' : ''}
            />
          </div>

          {/* Gráfico + Tabla */}
          <div className="grid gap-6 lg:grid-cols-5">
            {/* Gráfico de barras */}
            <div className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
              <h2 className="mb-4 text-sm font-semibold">Ventas últimos 7 días</h2>
              {stats.ventasSemana.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={stats.ventasSemana}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      formatter={(value: number) => [formatCurrency(value), 'Monto']}
                      contentStyle={{
                        borderRadius: '8px',
                        border: '1px solid var(--color-border)',
                        fontSize: '12px',
                      }}
                    />
                    <Bar dataKey="monto" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-60 items-center justify-center text-sm text-muted-foreground">
                  Sin datos de ventas
                </div>
              )}
            </div>

            {/* Últimos 10 pedidos */}
            <div className="rounded-xl border border-border bg-card lg:col-span-3">
              <div className="border-b border-border px-5 py-3">
                <h2 className="text-sm font-semibold">Últimos 10 pedidos</h2>
              </div>
              {stats.ultimosPedidos.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30 text-xs text-muted-foreground">
                        <th className="px-4 py-2 text-left font-medium">Vendedor</th>
                        <th className="px-4 py-2 text-left font-medium">Cliente</th>
                        <th className="px-4 py-2 text-right font-medium">Monto</th>
                        <th className="px-4 py-2 text-left font-medium">Estado</th>
                        <th className="px-4 py-2 text-left font-medium">Hora</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.ultimosPedidos.map((p) => (
                        <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                          <td className="px-4 py-2.5 text-xs">{p.vendedor?.nombre || '—'}</td>
                          <td className="px-4 py-2.5 text-xs truncate max-w-32">{p.cliente?.nombre || '—'}</td>
                          <td className="px-4 py-2.5 text-xs text-right font-medium">{formatCurrency(Number(p.total))}</td>
                          <td className="px-4 py-2.5">
                            <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium', estadoColors[p.estado] || 'bg-muted')}>
                              {p.estado}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground">{formatDateTime(p.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                  Sin pedidos recientes
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
