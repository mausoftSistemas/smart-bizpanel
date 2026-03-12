import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import {
  ArrowLeft, ShoppingCart, Banknote, Clock, Users, MapPin,
  Target, Route, Loader2,
} from 'lucide-react'
import api from '../../api/client'
import { formatCurrency, formatDateTime, formatDate, cn } from '../../lib/utils'

interface Visita {
  id: string
  clienteId: string
  fechaHora: string
  tipo: string
  resultado: string | null
  monto: number
  latitud: number | null
  longitud: number | null
  cliente?: { nombre: string; codigo: string }
}

interface JornadaActual {
  id: string
  estado: string
  horaInicio: string
  horaCierre: string | null
  totalVendido: number
  totalCobrado: number
  kmRecorridos: number
  clientesVisitados: number
  visitas: Visita[]
}

interface PedidoHoy {
  id: string
  total: number
  estado: string
  cliente: { nombre: string }
}

interface CobranzaHoy {
  id: string
  total: number
  cliente: { nombre: string }
}

interface VendedorData {
  vendedor: { id: string; nombre: string; email: string; rol: string; lastLogin: string | null; activo: boolean }
  jornadaActual: JornadaActual | null
  pedidosHoy: PedidoHoy[]
  cobranzasHoy: CobranzaHoy[]
}

interface JornadaHistorial {
  id: string
  fecha: string
  estado: string
  horaInicio: string
  horaCierre: string | null
  totalVendido: number
  totalCobrado: number
  clientesVisitados: number
  kmRecorridos: number
}

interface Objetivo {
  id: string
  nombre: string
  tipo: string
  metrica: string
  valorObjetivo: number
  valorActual: number
  porcentaje: number
  periodoInicio: string
  periodoFin: string
  vendedorNombre: string
}

const tabs = [
  { key: 'hoy', label: 'Hoy', icon: Clock },
  { key: 'gps', label: 'GPS', icon: Route },
  { key: 'historial', label: 'Historial', icon: MapPin },
  { key: 'objetivos', label: 'Objetivos', icon: Target },
] as const

type TabKey = typeof tabs[number]['key']

export default function VendedorDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [tab, setTab] = useState<TabKey>('hoy')

  const { data, isLoading } = useQuery({
    queryKey: ['vendedor-detail', id],
    queryFn: async () => {
      const { data: res } = await api.get(`/admin/vendedores/${id}`)
      return res.data as VendedorData
    },
    enabled: !!id,
    refetchInterval: 30000,
  })

  const { data: jornadas } = useQuery({
    queryKey: ['vendedor-jornadas', id],
    queryFn: async () => {
      const { data: res } = await api.get(`/admin/vendedores/${id}/jornadas`)
      return res.data as JornadaHistorial[]
    },
    enabled: !!id && tab === 'historial',
  })

  const { data: objetivos } = useQuery({
    queryKey: ['vendedor-objetivos', id],
    queryFn: async () => {
      const { data: res } = await api.get('/admin/reportes/objetivos')
      const all = res.data as Objetivo[]
      return all.filter(o => o.vendedorNombre !== 'Todos' || !id)
    },
    enabled: !!id && tab === 'objetivos',
  })

  if (isLoading) return <div className="flex items-center justify-center p-12 text-muted-foreground"><Loader2 size={20} className="animate-spin mr-2" /> Cargando...</div>
  if (!data) return <div className="flex items-center justify-center p-12 text-muted-foreground">Vendedor no encontrado</div>

  const { vendedor, jornadaActual, pedidosHoy, cobranzasHoy } = data
  const montoPedidos = pedidosHoy.reduce((s, p) => s + Number(p.total), 0)
  const montoCobranzas = cobranzasHoy.reduce((s, c) => s + Number(c.total), 0)

  // GPS points from visitas
  const gpsPoints = (jornadaActual?.visitas || [])
    .filter(v => v.latitud && v.longitud)
    .map(v => ({ lat: v.latitud!, lng: v.longitud!, label: v.cliente?.nombre || v.tipo, time: v.fechaHora }))

  const polyline: [number, number][] = gpsPoints.map(p => [p.lat, p.lng])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="rounded-lg p-2 hover:bg-muted">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{vendedor.nombre}</h1>
          <p className="text-sm text-muted-foreground">{vendedor.email} &middot; {vendedor.rol}</p>
        </div>
        <span className={cn(
          'rounded-full px-3 py-1 text-xs font-medium',
          vendedor.activo ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive',
        )}>
          {vendedor.activo ? 'Activo' : 'Inactivo'}
        </span>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><ShoppingCart size={20} /></div>
            <div>
              <p className="text-xs text-muted-foreground">Pedidos hoy</p>
              <p className="text-lg font-bold">{pedidosHoy.length}</p>
              <p className="text-xs text-muted-foreground">{formatCurrency(montoPedidos)}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10 text-success"><Banknote size={20} /></div>
            <div>
              <p className="text-xs text-muted-foreground">Cobranzas hoy</p>
              <p className="text-lg font-bold">{cobranzasHoy.length}</p>
              <p className="text-xs text-muted-foreground">{formatCurrency(montoCobranzas)}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10 text-warning"><Users size={20} /></div>
            <div>
              <p className="text-xs text-muted-foreground">Clientes visitados</p>
              <p className="text-lg font-bold">{jornadaActual?.clientesVisitados ?? 0}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground"><Clock size={20} /></div>
            <div>
              <p className="text-xs text-muted-foreground">Jornada</p>
              <p className="text-lg font-bold">{jornadaActual?.estado || 'Sin iniciar'}</p>
              {jornadaActual?.horaInicio && <p className="text-xs text-muted-foreground">Desde {formatDateTime(jornadaActual.horaInicio)}</p>}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-border bg-muted/30 p-1">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition-colors',
              tab === t.key ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Hoy */}
      {tab === 'hoy' && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Visitas */}
          <div className="rounded-xl border border-border bg-card">
            <div className="border-b border-border px-5 py-3">
              <h2 className="font-semibold">Visitas del día ({jornadaActual?.visitas?.length || 0})</h2>
            </div>
            {!jornadaActual?.visitas?.length ? (
              <div className="flex items-center justify-center p-12 text-sm text-muted-foreground">Sin visitas hoy</div>
            ) : (
              <div className="divide-y divide-border max-h-96 overflow-y-auto">
                {jornadaActual.visitas.map((v) => (
                  <div key={v.id} className="flex items-center gap-3 px-5 py-3">
                    <MapPin size={16} className="text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{v.cliente?.nombre || v.clienteId}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(v.fechaHora)} &middot; {v.tipo}
                        {v.resultado && ` &middot; ${v.resultado}`}
                      </p>
                    </div>
                    {v.monto > 0 && <span className="text-sm font-medium">{formatCurrency(v.monto)}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pedidos y Cobranzas */}
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card">
              <div className="border-b border-border px-5 py-3">
                <h2 className="font-semibold">Pedidos hoy ({pedidosHoy.length})</h2>
              </div>
              {!pedidosHoy.length ? (
                <div className="flex items-center justify-center p-8 text-sm text-muted-foreground">Sin pedidos</div>
              ) : (
                <div className="divide-y divide-border max-h-48 overflow-y-auto">
                  {pedidosHoy.map(p => (
                    <div key={p.id} className="flex items-center justify-between px-5 py-2.5">
                      <div>
                        <p className="text-sm">{p.cliente?.nombre || '—'}</p>
                        <span className={cn('text-xs rounded-full px-1.5 py-0.5 font-medium capitalize',
                          p.estado === 'confirmado' ? 'bg-success/10 text-success' : p.estado === 'cancelado' ? 'bg-destructive/10 text-destructive' : 'bg-warning/10 text-warning'
                        )}>{p.estado}</span>
                      </div>
                      <span className="text-sm font-medium">{formatCurrency(Number(p.total))}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-border bg-card">
              <div className="border-b border-border px-5 py-3">
                <h2 className="font-semibold">Cobranzas hoy ({cobranzasHoy.length})</h2>
              </div>
              {!cobranzasHoy.length ? (
                <div className="flex items-center justify-center p-8 text-sm text-muted-foreground">Sin cobranzas</div>
              ) : (
                <div className="divide-y divide-border max-h-48 overflow-y-auto">
                  {cobranzasHoy.map(c => (
                    <div key={c.id} className="flex items-center justify-between px-5 py-2.5">
                      <p className="text-sm">{c.cliente?.nombre || '—'}</p>
                      <span className="text-sm font-medium text-success">{formatCurrency(Number(c.total))}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab: GPS */}
      {tab === 'gps' && (
        <div className="rounded-xl border border-border overflow-hidden" style={{ height: 500 }}>
          {gpsPoints.length === 0 ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MapPin size={40} className="mx-auto mb-2 text-muted-foreground/50" />
                <p>Sin datos GPS para hoy</p>
              </div>
            </div>
          ) : (
            <MapContainer
              center={[gpsPoints[0].lat, gpsPoints[0].lng]}
              zoom={14}
              className="h-full w-full"
            >
              <TileLayer
                attribution='&copy; OpenStreetMap'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {polyline.length > 1 && (
                <Polyline positions={polyline} color="var(--color-primary)" weight={3} opacity={0.7} />
              )}
              {gpsPoints.map((p, i) => (
                <CircleMarker
                  key={i}
                  center={[p.lat, p.lng]}
                  radius={6}
                  fillColor={i === 0 ? '#22c55e' : i === gpsPoints.length - 1 ? '#ef4444' : '#3b82f6'}
                  fillOpacity={0.9}
                  color="white"
                  weight={2}
                >
                  <Popup>
                    <div className="text-xs">
                      <p className="font-semibold">{p.label}</p>
                      <p>{formatDateTime(p.time)}</p>
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          )}
        </div>
      )}

      {/* Tab: Historial */}
      {tab === 'historial' && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-xs text-muted-foreground">
                  <th className="px-4 py-3 text-left font-medium">Fecha</th>
                  <th className="px-4 py-3 text-left font-medium">Estado</th>
                  <th className="px-4 py-3 text-left font-medium">Horario</th>
                  <th className="px-4 py-3 text-right font-medium">Vendido</th>
                  <th className="px-4 py-3 text-right font-medium">Cobrado</th>
                  <th className="px-4 py-3 text-right font-medium">Clientes</th>
                  <th className="px-4 py-3 text-right font-medium">Km</th>
                </tr>
              </thead>
              <tbody>
                {!jornadas?.length ? (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">Sin jornadas registradas</td></tr>
                ) : jornadas.map(j => (
                  <tr key={j.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">{formatDate(j.fecha)}</td>
                    <td className="px-4 py-3">
                      <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                        j.estado === 'cerrada' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'
                      )}>{j.estado}</span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {formatDateTime(j.horaInicio)}
                      {j.horaCierre && ` → ${formatDateTime(j.horaCierre)}`}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">{formatCurrency(j.totalVendido)}</td>
                    <td className="px-4 py-3 text-right font-medium">{formatCurrency(j.totalCobrado)}</td>
                    <td className="px-4 py-3 text-right">{j.clientesVisitados}</td>
                    <td className="px-4 py-3 text-right">{j.kmRecorridos.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Objetivos */}
      {tab === 'objetivos' && (
        <div className="space-y-4">
          {!objetivos?.length ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-border p-12 text-muted-foreground">
              <Target size={40} className="mb-2 opacity-50" />
              <p>Sin objetivos asignados</p>
            </div>
          ) : objetivos.map(obj => (
            <div key={obj.id} className="rounded-xl border border-border bg-card p-5">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{obj.nombre}</h3>
                  <p className="text-xs text-muted-foreground">
                    {obj.tipo} &middot; {obj.metrica} &middot; {formatDate(obj.periodoInicio)} — {formatDate(obj.periodoFin)}
                  </p>
                </div>
                <span className={cn(
                  'text-lg font-bold',
                  obj.porcentaje >= 100 ? 'text-success' : obj.porcentaje >= 70 ? 'text-warning' : 'text-destructive',
                )}>
                  {obj.porcentaje}%
                </span>
              </div>
              <div className="mb-2 h-3 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    obj.porcentaje >= 100 ? 'bg-success' : obj.porcentaje >= 70 ? 'bg-warning' : 'bg-destructive',
                  )}
                  style={{ width: `${Math.min(obj.porcentaje, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Actual: {formatCurrency(obj.valorActual)}</span>
                <span>Meta: {formatCurrency(obj.valorObjetivo)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
