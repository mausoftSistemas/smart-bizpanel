import { useQuery } from '@tanstack/react-query'
import { Building2, Users, ShoppingCart, TrendingUp, AlertTriangle, HardDrive } from 'lucide-react'
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import api from '../../api/client'
import StatsCard from '../../components/StatsCard'
import { formatCurrency, formatDateTime } from '../../lib/utils'

interface DashboardData {
  totalEmpresas: number
  empresasActivas: number
  totalVendedoresActivos: number
  pedidosHoy: number
  montoVendidoHoy: number
  empresasPorPlan: Record<string, number>
  empresasConPlanVencido: number
  topEmpresasPorActividad: {
    id: string
    codigo: string
    razonSocial: string
    plan: string
    cantidadPedidosMes: number
    ultimaActividad: string | null
  }[]
  almacenamientoTotalMb: number
}

const PIE_COLORS = ['#6b7280', '#2563eb', '#f59e0b', '#22c55e']

export default function SuperDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['super-dashboard'],
    queryFn: async () => {
      const { data: res } = await api.get('/super/dashboard')
      return res.data as DashboardData
    },
    refetchInterval: 30000,
  })

  const stats = data || {
    totalEmpresas: 0,
    empresasActivas: 0,
    totalVendedoresActivos: 0,
    pedidosHoy: 0,
    montoVendidoHoy: 0,
    empresasPorPlan: {},
    empresasConPlanVencido: 0,
    topEmpresasPorActividad: [],
    almacenamientoTotalMb: 0,
  }

  const pieData = Object.entries(stats.empresasPorPlan).map(([plan, count]) => ({
    name: plan.charAt(0).toUpperCase() + plan.slice(1),
    value: count,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard Global</h1>
        <p className="text-sm text-muted-foreground">Vista general de todas las empresas</p>
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
              title="Empresas Activas"
              value={stats.empresasActivas}
              subtitle={`${stats.totalEmpresas} total`}
              icon={<Building2 size={20} />}
            />
            <StatsCard
              title="Vendedores Activos"
              value={stats.totalVendedoresActivos}
              subtitle="En todos los tenants"
              icon={<Users size={20} />}
            />
            <StatsCard
              title="Pedidos Hoy"
              value={stats.pedidosHoy}
              subtitle="Todos los tenants"
              icon={<ShoppingCart size={20} />}
            />
            <StatsCard
              title="Monto Total Hoy"
              value={formatCurrency(stats.montoVendidoHoy)}
              icon={<TrendingUp size={20} />}
            />
          </div>

          {/* Stats secundarios */}
          <div className="grid gap-4 sm:grid-cols-3">
            <StatsCard
              title="Planes Vencidos"
              value={stats.empresasConPlanVencido}
              icon={<AlertTriangle size={20} />}
              className={stats.empresasConPlanVencido > 0 ? 'border-warning/30' : ''}
            />
            <StatsCard
              title="Almacenamiento Total"
              value={`${stats.almacenamientoTotalMb.toFixed(1)} MB`}
              icon={<HardDrive size={20} />}
            />
            <StatsCard
              title="Total Empresas"
              value={stats.totalEmpresas}
              subtitle={`${stats.empresasActivas} activas`}
              icon={<Building2 size={20} />}
            />
          </div>

          {/* Gráficos + Tabla */}
          <div className="grid gap-6 lg:grid-cols-5">
            {/* Pie chart: empresas por plan */}
            <div className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
              <h2 className="mb-4 text-sm font-semibold">Empresas por Plan</h2>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-60 items-center justify-center text-sm text-muted-foreground">
                  Sin datos
                </div>
              )}
            </div>

            {/* Top empresas */}
            <div className="rounded-xl border border-border bg-card lg:col-span-3">
              <div className="border-b border-border px-5 py-3">
                <h2 className="text-sm font-semibold">Top Empresas por Actividad</h2>
              </div>
              {stats.topEmpresasPorActividad.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30 text-xs text-muted-foreground">
                        <th className="px-4 py-2 text-left font-medium">Empresa</th>
                        <th className="px-4 py-2 text-left font-medium">Plan</th>
                        <th className="px-4 py-2 text-right font-medium">Pedidos/Mes</th>
                        <th className="px-4 py-2 text-left font-medium">Última Actividad</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.topEmpresasPorActividad.map((t) => (
                        <tr key={t.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                          <td className="px-4 py-2.5">
                            <div>
                              <p className="text-sm font-medium">{t.razonSocial}</p>
                              <p className="text-[11px] text-muted-foreground">{t.codigo}</p>
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            <PlanBadge plan={t.plan} />
                          </td>
                          <td className="px-4 py-2.5 text-right font-medium">{t.cantidadPedidosMes}</td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground">
                            {t.ultimaActividad ? formatDateTime(t.ultimaActividad) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                  Sin datos de actividad
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export function PlanBadge({ plan }: { plan: string }) {
  const styles: Record<string, string> = {
    basico: 'bg-gray-100 text-gray-700',
    starter: 'bg-gray-100 text-gray-700',
    profesional: 'bg-blue-100 text-blue-700',
    premium: 'bg-blue-100 text-blue-700',
    enterprise: 'bg-amber-100 text-amber-700',
  }
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${styles[plan] || 'bg-muted'}`}>
      {plan}
    </span>
  )
}

export function EstadoBadge({ estado }: { estado: string }) {
  const styles: Record<string, string> = {
    activo: 'bg-green-100 text-green-700',
    trial: 'bg-blue-100 text-blue-700',
    suspendido: 'bg-red-100 text-red-700',
    cancelado: 'bg-gray-100 text-gray-500',
  }
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${styles[estado] || 'bg-muted'}`}>
      {estado}
    </span>
  )
}
