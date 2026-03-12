import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { MapPin, Clock, RefreshCw } from 'lucide-react'
import api from '../../api/client'
import { formatDateTime, cn } from '../../lib/utils'

interface VendedorGps {
  userId: string
  nombre: string
  lat: number
  lng: number
  timestamp: string
  jornadaActiva: boolean
}

export default function MapaVendedores() {
  const navigate = useNavigate()

  const { data: vendedores, isLoading, refetch } = useQuery({
    queryKey: ['vendedores-gps'],
    queryFn: async () => {
      try {
        const { data: res } = await api.get('/admin/vendedores/gps')
        return res.data as VendedorGps[]
      } catch {
        return []
      }
    },
    refetchInterval: 30000,
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mapa de Vendedores</h1>
          <p className="text-sm text-muted-foreground">Ubicación en tiempo real de los vendedores</p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
        >
          <RefreshCw size={14} /> Actualizar
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Panel de lista */}
        <div className="rounded-xl border border-border bg-card">
          <div className="border-b border-border px-5 py-3">
            <h2 className="font-semibold">Vendedores ({vendedores?.length || 0})</h2>
          </div>
          {isLoading ? (
            <div className="flex items-center justify-center p-12 text-muted-foreground">Cargando...</div>
          ) : !vendedores?.length ? (
            <div className="flex items-center justify-center p-12 text-muted-foreground">Sin datos de ubicación</div>
          ) : (
            <div className="divide-y divide-border max-h-[600px] overflow-y-auto">
              {vendedores.map((v) => (
                <button
                  key={v.userId}
                  onClick={() => navigate(`/vendedores/${v.userId}`)}
                  className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-muted/30 transition-colors"
                >
                  <div className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full',
                    v.jornadaActiva ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground',
                  )}>
                    <MapPin size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{v.nombre}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock size={12} />
                      <span>{formatDateTime(v.timestamp)}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">{v.lat.toFixed(4)}</p>
                    <p className="text-xs text-muted-foreground">{v.lng.toFixed(4)}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Placeholder del mapa */}
        <div className="flex items-center justify-center rounded-xl border border-border bg-muted/30 p-12">
          <div className="text-center">
            <MapPin size={48} className="mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm font-medium">Mapa interactivo</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Integrar con Google Maps, Mapbox o Leaflet.<br />
              Las coordenadas GPS se muestran en el panel izquierdo.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
