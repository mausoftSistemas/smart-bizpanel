import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Check, X, AlertTriangle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import api from '../../api/client'
import { formatCurrency, formatDateTime, cn } from '../../lib/utils'

interface RendicionDetalle {
  id: string
  fecha: string
  vendedorId: string
  totalEfectivo: number
  totalCheques: number
  cantidadCheques: number
  totalTransferencias: number
  totalBilleteras: number
  totalRetenciones: number
  totalTarjetas: number
  totalMercadoPago: number
  totalEsperado: number
  totalRecaudado: number
  diferencia: number
  estado: string
  observaciones: string | null
  motivoRechazo: string | null
  aprobadoPor: string | null
  fechaAprobacion: string | null
  detalleBilletes: Record<string, number>
  vendedor: { id: string; nombre: string; email: string }
  aprobadorInfo: { id: string; nombre: string } | null
  cheques: {
    id: number
    banco: string
    numero: string
    monto: number
    fechaCobro: string | null
    plaza: string | null
    cuitLibrador: string | null
    entregado: boolean
    recibidoPor: string | null
    fechaRecepcion: string | null
    observacion: string | null
  }[]
  cobranzasDia: {
    id: string
    fecha: string
    total: number
    cliente: { nombre: string; codigo: string }
    medios: { tipo: string; monto: number }[]
  }[]
}

const estadoColors: Record<string, string> = {
  pendiente: 'bg-amber-100 text-amber-700',
  entregado: 'bg-blue-100 text-blue-700',
  aprobado: 'bg-green-100 text-green-700',
  rechazado: 'bg-red-100 text-red-700',
  con_diferencia: 'bg-orange-100 text-orange-700',
}

export default function TesoreroRendicionDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [motivoRechazo, setMotivoRechazo] = useState('')
  const [motivoDiferencia, setMotivoDiferencia] = useState('')
  const [showRechazo, setShowRechazo] = useState(false)
  const [showDiferencia, setShowDiferencia] = useState(false)

  const { data: rendicion, isLoading } = useQuery({
    queryKey: ['tesoreria-rendicion-detail', id],
    queryFn: async () => {
      const { data: res } = await api.get(`/tesoreria/rendiciones/${id}`)
      return res.data as RendicionDetalle
    },
    enabled: !!id,
  })

  const aprobarMutation = useMutation({
    mutationFn: (body: { motivoDiferencia: string } | undefined) =>
      api.put(`/tesoreria/rendiciones/${id}/aprobar`, body || {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tesoreria-rendicion-detail', id] })
      toast.success('Rendicion aprobada')
      setShowDiferencia(false)
    },
    onError: () => toast.error('Error al aprobar'),
  })

  const rechazarMutation = useMutation({
    mutationFn: (body: { motivoRechazo: string }) =>
      api.put(`/tesoreria/rendiciones/${id}/rechazar`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tesoreria-rendicion-detail', id] })
      toast.success('Rendicion rechazada')
      setShowRechazo(false)
    },
    onError: () => toast.error('Error al rechazar'),
  })

  const marcarChequeMutation = useMutation({
    mutationFn: (chequeId: number) =>
      api.put(`/tesoreria/rendiciones/${id}/cheques/${chequeId}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tesoreria-rendicion-detail', id] })
      toast.success('Cheque marcado como recibido')
    },
    onError: () => toast.error('Error al marcar cheque'),
  })

  if (isLoading) return <div className="flex items-center justify-center p-12 text-muted-foreground">Cargando...</div>
  if (!rendicion) return <div className="flex items-center justify-center p-12 text-muted-foreground">Rendicion no encontrada</div>

  const isPendiente = ['pendiente', 'entregado'].includes(rendicion.estado)
  const tieneDiferencia = Number(rendicion.diferencia) !== 0

  // Parsear detalleBilletes
  const billetes = rendicion.detalleBilletes || {}
  const billetesEntries = Object.entries(billetes)
    .map(([denominacion, cantidad]) => ({
      denominacion: Number(denominacion),
      cantidad: Number(cantidad),
      subtotal: Number(denominacion) * Number(cantidad),
    }))
    .sort((a, b) => b.denominacion - a.denominacion)

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="rounded-lg border border-border p-2 hover:bg-muted transition-colors">
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Detalle de Rendicion</h1>
          <p className="text-sm text-muted-foreground">
            {rendicion.vendedor.nombre} - {formatDateTime(rendicion.fecha)}
          </p>
        </div>
        <span className={cn('inline-flex rounded-full px-3 py-1 text-xs font-medium capitalize', estadoColors[rendicion.estado] || 'bg-muted')}>
          {rendicion.estado.replace('_', ' ')}
        </span>
      </div>

      {/* Resumen */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-4 font-semibold">Resumen</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <span className="text-xs text-muted-foreground">Total Recaudado</span>
            <p className="text-xl font-bold">{formatCurrency(Number(rendicion.totalRecaudado))}</p>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Total Esperado</span>
            <p className="text-xl font-bold">{formatCurrency(Number(rendicion.totalEsperado))}</p>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Diferencia</span>
            <p className={cn('text-xl font-bold',
              Number(rendicion.diferencia) === 0 ? 'text-green-600' : Number(rendicion.diferencia) < 0 ? 'text-red-600' : 'text-orange-600')}>
              {formatCurrency(Number(rendicion.diferencia))}
            </p>
          </div>
        </div>

        {/* Desglose por tipo */}
        <div className="mt-4 grid gap-2 sm:grid-cols-4 text-sm">
          <div className="flex justify-between rounded-lg bg-muted/50 px-3 py-2">
            <span className="text-muted-foreground">Efectivo</span>
            <span className="font-medium">{formatCurrency(Number(rendicion.totalEfectivo))}</span>
          </div>
          <div className="flex justify-between rounded-lg bg-muted/50 px-3 py-2">
            <span className="text-muted-foreground">Cheques ({rendicion.cantidadCheques})</span>
            <span className="font-medium">{formatCurrency(Number(rendicion.totalCheques))}</span>
          </div>
          <div className="flex justify-between rounded-lg bg-muted/50 px-3 py-2">
            <span className="text-muted-foreground">Transferencias</span>
            <span className="font-medium">{formatCurrency(Number(rendicion.totalTransferencias))}</span>
          </div>
          <div className="flex justify-between rounded-lg bg-muted/50 px-3 py-2">
            <span className="text-muted-foreground">Otros</span>
            <span className="font-medium">{formatCurrency(Number(rendicion.totalBilleteras) + Number(rendicion.totalRetenciones) + Number(rendicion.totalTarjetas) + Number(rendicion.totalMercadoPago))}</span>
          </div>
        </div>

        {rendicion.observaciones && (
          <p className="mt-3 text-sm text-muted-foreground">Observaciones: {rendicion.observaciones}</p>
        )}
        {rendicion.motivoRechazo && (
          <p className="mt-2 text-sm text-red-600">Motivo rechazo: {rendicion.motivoRechazo}</p>
        )}
        {rendicion.aprobadorInfo && (
          <p className="mt-2 text-xs text-muted-foreground">
            Procesado por: {rendicion.aprobadorInfo.nombre} - {rendicion.fechaAprobacion ? formatDateTime(rendicion.fechaAprobacion) : ''}
          </p>
        )}
      </div>

      {/* Conteo Efectivo (detalleBilletes) */}
      {billetesEntries.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-4 font-semibold">Conteo Efectivo</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="pb-2">Denominacion</th>
                  <th className="pb-2 text-right">Cantidad</th>
                  <th className="pb-2 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {billetesEntries.map((b) => (
                  <tr key={b.denominacion} className="border-b border-border last:border-0">
                    <td className="py-2">{formatCurrency(b.denominacion)}</td>
                    <td className="py-2 text-right">{b.cantidad}</td>
                    <td className="py-2 text-right font-medium">{formatCurrency(b.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border font-bold">
                  <td colSpan={2} className="py-2 text-right">Total Efectivo:</td>
                  <td className="py-2 text-right">
                    {formatCurrency(billetesEntries.reduce((s, b) => s + b.subtotal, 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Cheques Entregados */}
      {rendicion.cheques.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-4 font-semibold">Cheques Entregados ({rendicion.cheques.length})</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="pb-2">Banco</th>
                  <th className="pb-2">Numero</th>
                  <th className="pb-2 text-right">Monto</th>
                  <th className="pb-2">Fecha Cobro</th>
                  <th className="pb-2 text-center">Recibido</th>
                </tr>
              </thead>
              <tbody>
                {rendicion.cheques.map((ch) => (
                  <tr key={ch.id} className="border-b border-border last:border-0">
                    <td className="py-2">{ch.banco}</td>
                    <td className="py-2 font-mono text-xs">{ch.numero}</td>
                    <td className="py-2 text-right font-medium">{formatCurrency(Number(ch.monto))}</td>
                    <td className="py-2 text-xs">{ch.fechaCobro ? formatDateTime(ch.fechaCobro).split(',')[0] : '--'}</td>
                    <td className="py-2 text-center">
                      {ch.entregado ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                          <Check size={12} /> Recibido
                        </span>
                      ) : (
                        <button
                          onClick={() => marcarChequeMutation.mutate(ch.id)}
                          disabled={marcarChequeMutation.isPending}
                          className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 hover:bg-blue-200 transition-colors"
                        >
                          Marcar recibido
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Cobranzas del dia */}
      {rendicion.cobranzasDia.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-4 font-semibold">Cobranzas del Dia ({rendicion.cobranzasDia.length})</h2>
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
                {rendicion.cobranzasDia.map((c) => (
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
            </table>
          </div>
        </div>
      )}

      {/* Acciones */}
      {isPendiente && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h2 className="font-semibold">Acciones</h2>

          {showRechazo && (
            <div className="space-y-2">
              <textarea
                placeholder="Motivo del rechazo (obligatorio)"
                value={motivoRechazo}
                onChange={(e) => setMotivoRechazo(e.target.value)}
                className="w-full rounded-lg border border-input px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                rows={3}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => rechazarMutation.mutate({ motivoRechazo })}
                  disabled={!motivoRechazo || rechazarMutation.isPending}
                  className="flex items-center gap-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {rechazarMutation.isPending && <Loader2 size={14} className="animate-spin" />}
                  Confirmar Rechazo
                </button>
                <button onClick={() => setShowRechazo(false)} className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted">
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {showDiferencia && (
            <div className="space-y-2">
              <textarea
                placeholder="Motivo de la diferencia (opcional)"
                value={motivoDiferencia}
                onChange={(e) => setMotivoDiferencia(e.target.value)}
                className="w-full rounded-lg border border-input px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                rows={3}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => aprobarMutation.mutate({ motivoDiferencia })}
                  disabled={aprobarMutation.isPending}
                  className="flex items-center gap-1 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50"
                >
                  {aprobarMutation.isPending && <Loader2 size={14} className="animate-spin" />}
                  Confirmar Aprobacion con Diferencia
                </button>
                <button onClick={() => setShowDiferencia(false)} className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted">
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {!showRechazo && !showDiferencia && (
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => {
                  if (tieneDiferencia) {
                    setShowDiferencia(true)
                  } else {
                    aprobarMutation.mutate(undefined)
                  }
                }}
                disabled={aprobarMutation.isPending}
                className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {aprobarMutation.isPending && <Loader2 size={14} className="animate-spin" />}
                <Check size={16} /> Aprobar
              </button>
              {tieneDiferencia && (
                <button
                  onClick={() => setShowDiferencia(true)}
                  className="flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700"
                >
                  <AlertTriangle size={16} /> Aprobar con Diferencia
                </button>
              )}
              <button
                onClick={() => setShowRechazo(true)}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                <X size={16} /> Rechazar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
