import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, MapPin } from 'lucide-react'
import api from '../../api/client'
import { formatCurrency, formatDateTime, cn } from '../../lib/utils'

interface CobranzaMedio {
  id: number
  tipo: string
  monto: number
  moneda: string
  datos: Record<string, unknown>
  numeroReferencia: string | null
  fechaVencimiento: string | null
  plazaCheque: string | null
  fechaEmision: string | null
}

interface CobranzaImputacion {
  id: number
  tipoComprobante: string
  sucursal: string
  numeroComprobante: string
  importeCobrado: number
  letraComprobante: string | null
}

interface CobranzaDetalle {
  id: string
  fecha: string
  total: number
  estado: string
  erpSynced: boolean
  numeroRecibo: string | null
  latitud: number | null
  longitud: number | null
  cliente: { id: string; nombre: string; codigo: string; direccion: string | null; telefono: string | null }
  vendedor: { id: string; nombre: string; email: string }
  medios: CobranzaMedio[]
  imputaciones: CobranzaImputacion[]
}

const tipoMedioLabels: Record<string, string> = {
  efectivo: 'Efectivo',
  cheque: 'Cheque',
  transferencia: 'Transferencia',
  billetera: 'Billetera',
  tarjeta: 'Tarjeta',
  retencion: 'Retencion',
  mp: 'Mercado Pago',
}

export default function TesoreroCobranzaDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const { data: cobranza, isLoading } = useQuery({
    queryKey: ['tesoreria-cobranza-detail', id],
    queryFn: async () => {
      const { data: res } = await api.get(`/tesoreria/cobranzas/${id}`)
      return res.data as CobranzaDetalle
    },
    enabled: !!id,
  })

  if (isLoading) return <div className="flex items-center justify-center p-12 text-muted-foreground">Cargando...</div>
  if (!cobranza) return <div className="flex items-center justify-center p-12 text-muted-foreground">Cobranza no encontrada</div>

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="rounded-lg border border-border p-2 hover:bg-muted transition-colors">
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="text-2xl font-bold">Detalle de Cobranza</h1>
          <p className="text-sm text-muted-foreground font-mono">{cobranza.id.slice(0, 8)}...</p>
        </div>
      </div>

      {/* Info card */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <span className="text-xs text-muted-foreground">Cliente</span>
            <p className="font-medium">{cobranza.cliente.nombre}</p>
            <p className="text-xs text-muted-foreground">{cobranza.cliente.codigo}</p>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Vendedor</span>
            <p className="font-medium">{cobranza.vendedor.nombre}</p>
            <p className="text-xs text-muted-foreground">{cobranza.vendedor.email}</p>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Fecha</span>
            <p className="font-medium">{formatDateTime(cobranza.fecha)}</p>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Total</span>
            <p className="text-lg font-bold">{formatCurrency(Number(cobranza.total))}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize',
            cobranza.estado === 'confirmado' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning')}>
            {cobranza.estado}
          </span>
          {cobranza.numeroRecibo && (
            <span className="inline-flex rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">
              Recibo: {cobranza.numeroRecibo}
            </span>
          )}
        </div>

        {cobranza.cliente.direccion && <p className="mt-3 text-xs text-muted-foreground">Direccion: {cobranza.cliente.direccion}</p>}

        {cobranza.latitud && cobranza.longitud && (
          <a
            href={`https://www.google.com/maps?q=${cobranza.latitud},${cobranza.longitud}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <MapPin size={12} /> Ver ubicacion en Google Maps
          </a>
        )}
      </div>

      {/* Medios de pago */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-4 font-semibold">Medios de Pago ({cobranza.medios.length})</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="pb-2">Tipo</th>
                <th className="pb-2">Moneda</th>
                <th className="pb-2 text-right">Monto</th>
                <th className="pb-2">Referencia</th>
                <th className="pb-2">Info Adicional</th>
              </tr>
            </thead>
            <tbody>
              {cobranza.medios.map((medio) => (
                <tr key={medio.id} className="border-b border-border last:border-0">
                  <td className="py-2">
                    <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-medium capitalize">
                      {tipoMedioLabels[medio.tipo] || medio.tipo}
                    </span>
                  </td>
                  <td className="py-2 text-xs">{medio.moneda}</td>
                  <td className="py-2 text-right font-medium">{formatCurrency(Number(medio.monto))}</td>
                  <td className="py-2 text-xs text-muted-foreground">{medio.numeroReferencia || '--'}</td>
                  <td className="py-2 text-xs text-muted-foreground">
                    {medio.tipo === 'cheque' && (
                      <span>
                        {medio.plazaCheque && `Plaza: ${medio.plazaCheque}`}
                        {medio.fechaEmision && ` | Emision: ${formatDateTime(medio.fechaEmision)}`}
                        {medio.fechaVencimiento && ` | Vto: ${formatDateTime(medio.fechaVencimiento)}`}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border font-bold">
                <td colSpan={2} className="py-2 text-right">Total:</td>
                <td className="py-2 text-right">{formatCurrency(Number(cobranza.total))}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Imputaciones */}
      {cobranza.imputaciones.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-4 font-semibold">Comprobantes Imputados ({cobranza.imputaciones.length})</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="pb-2">Tipo</th>
                  <th className="pb-2">Letra</th>
                  <th className="pb-2">Sucursal</th>
                  <th className="pb-2">Numero</th>
                  <th className="pb-2 text-right">Importe</th>
                </tr>
              </thead>
              <tbody>
                {cobranza.imputaciones.map((imp) => (
                  <tr key={imp.id} className="border-b border-border last:border-0">
                    <td className="py-2 font-mono text-xs">{imp.tipoComprobante}</td>
                    <td className="py-2">{imp.letraComprobante || '--'}</td>
                    <td className="py-2 font-mono text-xs">{imp.sucursal}</td>
                    <td className="py-2 font-mono text-xs">{imp.numeroComprobante}</td>
                    <td className="py-2 text-right font-medium">{formatCurrency(Number(imp.importeCobrado))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
