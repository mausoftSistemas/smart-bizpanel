import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapPin, Clock, RefreshCw, ChevronRight, ChevronLeft, Loader2 } from 'lucide-react'
import api from '../../api/client'
import { formatDateTime, cn } from '../../lib/utils'

interface VendedorActivo {
  vendedorId: string
  vendedorNombre: string
  jornadaId: string
  horaInicio: string
  clientesVisitados: number
  lastGps: {
    latitud: number
    longitud: number
    timestamp: string
  } | null
}

function activityColor(timestamp: string | null | undefined): 'green' | 'orange' | 'gray' {
  if (!timestamp) return 'gray'
  const diff = (Date.now() - new Date(timestamp).getTime()) / 60000
  if (diff < 15) return 'green'
  if (diff < 60) return 'orange'
  return 'gray'
}

const colorHex = { green: '#22c55e', orange: '#f59e0b', gray: '#94a3b8' }

function createIcon(color: 'green' | 'orange' | 'gray') {
  const hex = colorHex[color]
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 28 40">
    <path d="M14 0C6.27 0 0 6.27 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.27 21.73 0 14 0z" fill="${hex}"/>
    <circle cx="14" cy="14" r="6" fill="white"/>
  </svg>`
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [28, 40],
    iconAnchor: [14, 40],
    popupAnchor: [0, -40],
  })
}

function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap()
  useMemo(() => {
    if (positions.length > 0) {
      const bounds = L.latLngBounds(positions.map(([lat, lng]) => [lat, lng]))
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 })
    }
  }, [positions, map])
  return null
}

export default function MapaVendedores() {
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const { data: vendedores, isLoading, refetch } = useQuery({
    queryKey: ['vendedores-activos'],
    queryFn: async () => {
      const { data: res } = await api.get('/admin/vendedores/activos')
      return res.data as VendedorActivo[]
    },
    refetchInterval: 30000,
  })

  const conGps = (vendedores || []).filter(v => v.lastGps)
  const positions: [number, number][] = conGps.map(v => [v.lastGps!.latitud, v.lastGps!.longitud])

  // Default center: Buenos Aires
  const defaultCenter: [number, number] = positions.length > 0
    ? [positions.reduce((s, p) => s + p[0], 0) / positions.length, positions.reduce((s, p) => s + p[1], 0) / positions.length]
    : [-34.6037, -58.3816]

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden rounded-xl border border-border">
      {/* Mapa */}
      <div className="relative flex-1">
        <MapContainer
          center={defaultCenter}
          zoom={12}
          className="h-full w-full"
          zoomControl={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {positions.length > 0 && <FitBounds positions={positions} />}
          {conGps.map((v) => {
            const color = activityColor(v.lastGps?.timestamp)
            return (
              <Marker
                key={v.vendedorId}
                position={[v.lastGps!.latitud, v.lastGps!.longitud]}
                icon={createIcon(color)}
              >
                <Popup>
                  <div className="text-sm">
                    <p className="font-semibold">{v.vendedorNombre}</p>
                    <p className="text-xs text-gray-500">{v.clientesVisitados} clientes visitados</p>
                    <p className="text-xs text-gray-500">{formatDateTime(v.lastGps!.timestamp)}</p>
                    <button
                      onClick={() => navigate(`/vendedores/${v.vendedorId}`)}
                      className="mt-1 text-xs text-blue-600 hover:underline"
                    >
                      Ver detalle
                    </button>
                  </div>
                </Popup>
              </Marker>
            )
          })}
        </MapContainer>

        {/* Botones sobre el mapa */}
        <div className="absolute left-3 top-3 z-[1000] flex gap-2">
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-medium shadow-md hover:bg-gray-50"
          >
            <RefreshCw size={14} /> Actualizar
          </button>
        </div>

        {/* Leyenda */}
        <div className="absolute bottom-4 left-3 z-[1000] flex gap-3 rounded-lg bg-white/90 px-3 py-2 text-xs shadow-md backdrop-blur-sm">
          <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-green-500" /> &lt;15 min</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-orange-400" /> 15-60 min</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-gray-400" /> &gt;1 hora</span>
        </div>

        {/* Toggle sidebar */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute right-0 top-1/2 z-[1000] -translate-y-1/2 rounded-l-lg bg-white p-1.5 shadow-md hover:bg-gray-50"
        >
          {sidebarOpen ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Sidebar */}
      {sidebarOpen && (
        <div className="w-80 flex-shrink-0 overflow-hidden border-l border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <h2 className="font-semibold">Vendedores activos</h2>
            <p className="text-xs text-muted-foreground">{vendedores?.length || 0} en jornada</p>
          </div>
          {isLoading ? (
            <div className="flex items-center justify-center p-12 text-muted-foreground">
              <Loader2 size={20} className="animate-spin mr-2" /> Cargando...
            </div>
          ) : !vendedores?.length ? (
            <div className="flex items-center justify-center p-12 text-sm text-muted-foreground">
              Ningún vendedor con jornada activa
            </div>
          ) : (
            <div className="divide-y divide-border overflow-y-auto" style={{ maxHeight: 'calc(100vh - 10rem)' }}>
              {vendedores.map((v) => {
                const color = activityColor(v.lastGps?.timestamp)
                return (
                  <button
                    key={v.vendedorId}
                    onClick={() => navigate(`/vendedores/${v.vendedorId}`)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30"
                  >
                    <div className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-full',
                      color === 'green' ? 'bg-success/10 text-success' : color === 'orange' ? 'bg-warning/10 text-warning' : 'bg-muted text-muted-foreground',
                    )}>
                      <MapPin size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{v.vendedorNombre}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock size={10} />
                        {v.lastGps ? formatDateTime(v.lastGps.timestamp) : 'Sin GPS'}
                      </div>
                      <p className="text-xs text-muted-foreground">{v.clientesVisitados} visitas</p>
                    </div>
                    <ChevronRight size={14} className="text-muted-foreground" />
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
