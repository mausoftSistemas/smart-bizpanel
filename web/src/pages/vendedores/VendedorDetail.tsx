import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { MapPin, ShoppingCart, Banknote, Clock, Navigation } from 'lucide-react'
import api from '../../api/client'
import StatsCard from '../../components/StatsCard'
import { formatCurrency, formatDateTime } from '../../lib/utils'

interface VendedorData {
  user: { id: string; nombre: string; email: string; rol: string }
  jornada: { estado: string; horaInicio: string | null; horaCierre: string | null } | null
  pedidosHoy: { total: number; monto: number }
  cobranzasHoy: { total: number; monto: number }
  ultimoGps: { lat: number; lng: number; timestamp: string } | null
  visitasHoy: { clienteNombre: string; hora: string; tipo: string }[]
}

export default function VendedorDetail() {
  const { id } = useParams()

  const { data, isLoading } = useQuery({
    queryKey: ['vendedor', id],
    queryFn: async () => {
      try {
        const { data: res } = await api.get(`/admin/vendedores/${id}`)
        return res.data as VendedorData
      } catch {
        return null
      }
    },
    enabled: !!id,
  })

  if (isLoading) return <div className="flex items-center justify-center p-12 text-muted-foreground">Cargando...</div>
  if (!data) return <div className="flex items-center justify-center p-12 text-muted-foreground">Vendedor no encontrado</div>

  const { user, jornada, pedidosHoy, cobranzasHoy, ultimoGps, visitasHoy } = data

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{user.nombre}</h1>
        <p className="text-sm text-muted-foreground">{user.email} &middot; {user.rol}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Pedidos hoy"
          value={pedidosHoy.total}
          subtitle={formatCurrency(pedidosHoy.monto)}
          icon={<ShoppingCart size={20} />}
        />
        <StatsCard
          title="Cobranzas hoy"
          value={cobranzasHoy.total}
          subtitle={formatCurrency(cobranzasHoy.monto)}
          icon={<Banknote size={20} />}
        />
        <StatsCard
          title="Jornada"
          value={jornada?.estado || 'Sin iniciar'}
          subtitle={jornada?.horaInicio ? `Inicio: ${jornada.horaInicio}` : undefined}
          icon={<Clock size={20} />}
        />
        <StatsCard
          title="Última ubicación"
          value={ultimoGps ? `${ultimoGps.lat.toFixed(4)}, ${ultimoGps.lng.toFixed(4)}` : 'Sin datos'}
          subtitle={ultimoGps ? formatDateTime(ultimoGps.timestamp) : undefined}
          icon={<Navigation size={20} />}
        />
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="border-b border-border px-5 py-3">
          <h2 className="font-semibold">Visitas del día</h2>
        </div>
        {visitasHoy.length === 0 ? (
          <div className="flex items-center justify-center p-12 text-muted-foreground">Sin visitas hoy</div>
        ) : (
          <div className="divide-y divide-border">
            {visitasHoy.map((v, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3">
                <MapPin size={16} className="text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{v.clienteNombre}</p>
                  <p className="text-xs text-muted-foreground">{v.hora} &middot; {v.tipo}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
