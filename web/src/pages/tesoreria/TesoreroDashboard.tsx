import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Banknote, CreditCard, ArrowRightLeft, ClipboardCheck, Users } from 'lucide-react'
import api from '../../api/client'
import { formatCurrency, formatDateTime, cn } from '../../lib/utils'

interface DashboardData {
  totalCobradoHoy: number
  totalEfectivo: number
  totalCheques: number
  cantidadCheques: number
  totalTransferencias: number
  totalOtros: number
  rendicionesPendientes: number
  vendedoresActivos: number
  cobranzasHoy: {
    id: string
    fecha: string
    total: number
    estado: string
    cliente: { id: string; nombre: string; codigo: string }
    vendedor: { id: string; nombre: string }
    medios: { tipo: string; monto: number }[]
  }[]
}

const tipoMedioBadge: Record<string, string> = {
  efectivo: 'bg-green-100 text-green-700',
  cheque: 'bg-blue-100 text-blue-700',
  transferencia: 'bg-purple-100 text-purple-700',
  billetera: 'bg-orange-100 text-orange-700',
  tarjeta: 'bg-pink-100 text-pink-700',
  retencion: 'bg-gray-100 text-gray-700',
  mp: 'bg-sky-100 text-sky-700',
}

export default function TesoreroDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['tesoreria-dashboard'],
    queryFn: async () => {
      const { data: res } = await api.get('/tesoreria/dashboard')
      return res.data as DashboardData
    },
    refetchInterval: 30000,
  })

  if (isLoading) return <div className="flex items-center justify-center p-12 text-muted-foreground">Cargando...</div>
  if (!data) return null

  const stats = [
    { label: 'Total Cobrado Hoy', value: formatCurrency(data.totalCobradoHoy), icon: <Banknote size={20} />, color: 'text-green-600 bg-green-50' },
    { label: 'Efectivo', value: formatCurrency(data.totalEfectivo), icon: <Banknote size={20} />, color: 'text-emerald-600 bg-emerald-50' },
    { label: 'Cheques', value: `${formatCurrency(data.totalCheques)} (${data.cantidadCheques})`, icon: <CreditCard size={20} />, color: 'text-blue-600 bg-blue-50' },
    { label: 'Transferencias', value: formatCurrency(data.totalTransferencias), icon: <ArrowRightLeft size={20} />, color: 'text-purple-600 bg-purple-50' },
    { label: 'Rendiciones Pendientes', value: String(data.rendicionesPendientes), icon: <ClipboardCheck size={20} />, color: data.rendicionesPendientes > 0 ? 'text-amber-600 bg-amber-50' : 'text-gray-600 bg-gray-50' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard de Caja</h1>
        <p className="text-sm text-muted-foreground">Resumen del dia - {new Date().toLocaleDateString('es-AR')}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', s.color)}>
                {s.icon}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-lg font-bold">{s.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg text-teal-600 bg-teal-50')}>
          <Users size={16} />
        </div>
        <span className="text-sm text-muted-foreground">Vendedores activos hoy: <strong>{data.vendedoresActivos}</strong></span>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-4 font-semibold">Cobranzas del Dia ({data.cobranzasHoy.length})</h2>
        {data.cobranzasHoy.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay cobranzas registradas hoy</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="pb-2">Hora</th>
                  <th className="pb-2">Vendedor</th>
                  <th className="pb-2">Cliente</th>
                  <th className="pb-2 text-right">Total</th>
                  <th className="pb-2">Medios</th>
                  <th className="pb-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {data.cobranzasHoy.map((c) => (
                  <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                    <td className="py-2 text-xs">{formatDateTime(c.fecha).split(', ')[1] || formatDateTime(c.fecha)}</td>
                    <td className="py-2">{c.vendedor.nombre}</td>
                    <td className="py-2">
                      <Link to={`/tesoreria/cobranzas/${c.id}`} className="text-primary hover:underline">
                        {c.cliente.nombre}
                      </Link>
                    </td>
                    <td className="py-2 text-right font-medium">{formatCurrency(Number(c.total))}</td>
                    <td className="py-2">
                      <div className="flex flex-wrap gap-1">
                        {c.medios.map((m, i) => (
                          <span key={i} className={cn('inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium capitalize', tipoMedioBadge[m.tipo] || 'bg-muted')}>
                            {m.tipo}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-2">
                      <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                        c.estado === 'confirmado' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning')}>
                        {c.estado}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
