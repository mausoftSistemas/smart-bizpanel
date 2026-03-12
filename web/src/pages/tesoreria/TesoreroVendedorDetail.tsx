import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import api from '../../api/client'
import { formatCurrency, formatDateTime, cn } from '../../lib/utils'

interface VendedorData {
  vendedor: { id: string; nombre: string; email: string; activo: boolean; lastLogin: string | null }
  jornadaHoy: { id: string; estado: string; horaInicio: string; horaFin: string | null; totalCobrado: number } | null
  cobranzasHoy: {
    id: string
    fecha: string
    total: number
    cliente: { nombre: string; codigo: string }
    medios: { tipo: string; monto: number }[]
  }[]
  rendicionHoy: {
    id: string
    totalEsperado: number
    totalRecaudado: number
    diferencia: number
    estado: string
    totalEfectivo: number
    totalCheques: number
    totalTransferencias: number
    detalleBilletes: Record<string, number>
    cheques: { banco: string; numero: string; monto: number; entregado: boolean }[]
    aprobadoPor: string | null
  } | null
}

const estadoColors: Record<string, string> = {
  pendiente: 'bg-amber-100 text-amber-700',
  entregado: 'bg-blue-100 text-blue-700',
  aprobado: 'bg-green-100 text-green-700',
  rechazado: 'bg-red-100 text-red-700',
  con_diferencia: 'bg-orange-100 text-orange-700',
}

export default function TesoreroVendedorDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['tesoreria-vendedor-detail', id],
    queryFn: async () => {
      const { data: res } = await api.get(`/tesoreria/vendedores/${id}`)
      return res.data as VendedorData
    },
    enabled: !!id,
  })

  if (isLoading) return <div className="flex items-center justify-center p-12 text-muted-foreground">Cargando...</div>
  if (!data) return <div className="flex items-center justify-center p-12 text-muted-foreground">Vendedor no encontrado</div>

  const { vendedor, jornadaHoy, cobranzasHoy, rendicionHoy } = data
  const totalCobradoHoy = cobranzasHoy.reduce((s, c) => s + Number(c.total), 0)

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="rounded-lg border border-border p-2 hover:bg-muted transition-colors">
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="text-2xl font-bold">{vendedor.nombre}</h1>
          <p className="text-sm text-muted-foreground">{vendedor.email}</p>
        </div>
      </div>

      {/* Info vendedor + jornada */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <span className="text-xs text-muted-foreground">Estado</span>
            <p className={cn('text-sm font-medium', vendedor.activo ? 'text-green-600' : 'text-red-600')}>
              {vendedor.activo ? 'Activo' : 'Inactivo'}
            </p>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Jornada Hoy</span>
            {jornadaHoy ? (
              <div>
                <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                  jornadaHoy.estado === 'activa' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500')}>
                  {jornadaHoy.estado}
                </span>
                <p className="mt-1 text-xs text-muted-foreground">
                  Inicio: {formatDateTime(jornadaHoy.horaInicio)}
                  {jornadaHoy.horaFin && ` | Fin: ${formatDateTime(jornadaHoy.horaFin)}`}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Sin jornada</p>
            )}
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Cobrado Hoy</span>
            <p className="text-xl font-bold">{formatCurrency(totalCobradoHoy)}</p>
          </div>
        </div>
      </div>

      {/* Cobranzas del dia */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-4 font-semibold">Cobranzas del Dia ({cobranzasHoy.length})</h2>
        {cobranzasHoy.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay cobranzas registradas hoy</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="pb-2">Hora</th>
                  <th className="pb-2">Cliente</th>
                  <th className="pb-2 text-right">Total</th>
                  <th className="pb-2">Medios</th>
                </tr>
              </thead>
              <tbody>
                {cobranzasHoy.map((c) => (
                  <tr key={c.id} className="border-b border-border last:border-0">
                    <td className="py-2 text-xs">{formatDateTime(c.fecha).split(', ')[1] || formatDateTime(c.fecha)}</td>
                    <td className="py-2">{c.cliente.nombre}</td>
                    <td className="py-2 text-right font-medium">{formatCurrency(Number(c.total))}</td>
                    <td className="py-2">
                      <div className="flex flex-wrap gap-1">
                        {c.medios.map((m, i) => (
                          <span key={i} className="inline-flex rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium capitalize">
                            {m.tipo}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border font-bold">
                  <td colSpan={2} className="py-2 text-right">Total:</td>
                  <td className="py-2 text-right">{formatCurrency(totalCobradoHoy)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Rendicion del dia */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-4 font-semibold">Rendicion del Dia</h2>
        {rendicionHoy ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize', estadoColors[rendicionHoy.estado] || 'bg-muted')}>
                {rendicionHoy.estado.replace('_', ' ')}
              </span>
              {rendicionHoy.aprobadoPor && (
                <span className="text-xs text-muted-foreground">Procesado</span>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <span className="text-xs text-muted-foreground">Recaudado</span>
                <p className="font-bold">{formatCurrency(Number(rendicionHoy.totalRecaudado))}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Esperado</span>
                <p className="font-bold">{formatCurrency(Number(rendicionHoy.totalEsperado))}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Diferencia</span>
                <p className={cn('font-bold',
                  Number(rendicionHoy.diferencia) === 0 ? 'text-green-600' : Number(rendicionHoy.diferencia) < 0 ? 'text-red-600' : 'text-orange-600')}>
                  {formatCurrency(Number(rendicionHoy.diferencia))}
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate(`/tesoreria/rendiciones/${rendicionHoy.id}`)}
              className="text-sm text-primary hover:underline"
            >
              Ver detalle completo
            </button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No se ha realizado la rendicion del dia</p>
        )}
      </div>
    </div>
  )
}
