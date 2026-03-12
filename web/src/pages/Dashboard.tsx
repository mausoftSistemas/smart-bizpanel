import { useQuery } from '@tanstack/react-query'
import { ShoppingCart, Banknote, Users, TrendingUp, Package, AlertCircle } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import api from '../api/client'
import StatsCard from '../components/StatsCard'
import { formatCurrency } from '../lib/utils'

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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatsCard
              title="Pedidos hoy"
              value={stats.pedidosHoy}
              subtitle={formatCurrency(stats.montoPedidosHoy)}
              icon={<ShoppingCart size={20} />}
            />
            <StatsCard
              title="Cobranzas hoy"
              value={stats.cobranzasHoy}
              subtitle={formatCurrency(stats.montoCobranzasHoy)}
              icon={<Banknote size={20} />}
            />
            <StatsCard
              title="Vendedores activos"
              value={stats.vendedoresActivos}
              icon={<Users size={20} />}
            />
            <StatsCard
              title="Sync pendientes"
              value={stats.syncPendientes}
              icon={<AlertCircle size={20} />}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <StatsCard title="Productos" value={stats.productosActivos} icon={<Package size={20} />} />
            <StatsCard title="Clientes" value={stats.clientesActivos} icon={<Users size={20} />} />
            <StatsCard
              title="Monto total hoy"
              value={formatCurrency(stats.montoPedidosHoy + stats.montoCobranzasHoy)}
              icon={<TrendingUp size={20} />}
            />
          </div>

          {stats.ventasSemana.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="mb-4 text-lg font-semibold">Ventas de la semana</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats.ventasSemana}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="dia" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value: number) => [formatCurrency(value), 'Monto']}
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid var(--color-border)',
                      fontSize: '13px',
                    }}
                  />
                  <Bar dataKey="monto" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  )
}
