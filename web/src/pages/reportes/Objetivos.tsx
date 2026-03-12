import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Target, Loader2, X } from 'lucide-react'
import api from '../../api/client'
import { formatCurrency, formatDate, cn } from '../../lib/utils'

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
  vendedorId: string | null
  vendedorNombre: string
  activo: boolean
}

const metricaLabels: Record<string, string> = {
  monto_venta: 'Monto Venta',
  cantidad_pedidos: 'Cant. Pedidos',
  clientes_visitados: 'Clientes Visitados',
  cobranza: 'Cobranza',
  mix_productos: 'Mix Productos',
}

function estadoLabel(porcentaje: number): { text: string; color: string } {
  if (porcentaje >= 100) return { text: 'Cumplido', color: 'bg-success/10 text-success' }
  if (porcentaje >= 70) return { text: 'En camino', color: 'bg-warning/10 text-warning' }
  return { text: 'Atrasado', color: 'bg-destructive/10 text-destructive' }
}

function progressColor(porcentaje: number): string {
  if (porcentaje >= 100) return 'bg-success'
  if (porcentaje >= 70) return 'bg-warning'
  return 'bg-destructive'
}

function isMonetary(metrica: string) {
  return ['monto_venta', 'cobranza'].includes(metrica)
}

export default function Objetivos() {
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroPeriodo, setFiltroPeriodo] = useState<'vigentes' | 'todos'>('vigentes')

  const { data: objetivos, isLoading } = useQuery({
    queryKey: ['reportes-objetivos', filtroTipo],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filtroTipo) params.set('tipo', filtroTipo)
      const { data: res } = await api.get(`/admin/reportes/objetivos?${params}`)
      return res.data as Objetivo[]
    },
  })

  const now = new Date()
  const filtered = (objetivos || []).filter(o => {
    if (filtroPeriodo === 'vigentes') {
      return new Date(o.periodoFin) >= now && new Date(o.periodoInicio) <= now
    }
    return true
  })

  // Stats
  const total = filtered.length
  const cumplidos = filtered.filter(o => o.porcentaje >= 100).length
  const enCamino = filtered.filter(o => o.porcentaje >= 70 && o.porcentaje < 100).length
  const atrasados = filtered.filter(o => o.porcentaje < 70).length

  const inputCls = 'h-9 rounded-lg border border-input px-3 text-sm outline-none focus:ring-2 focus:ring-ring'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Objetivos</h1>
        <p className="text-sm text-muted-foreground">Seguimiento de objetivos comerciales por vendedor</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground">Total objetivos</p>
          <p className="text-xl font-bold">{total}</p>
        </div>
        <div className="rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground">Cumplidos</p>
          <p className="text-xl font-bold text-success">{cumplidos}</p>
        </div>
        <div className="rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground">En camino</p>
          <p className="text-xl font-bold text-warning">{enCamino}</p>
        </div>
        <div className="rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground">Atrasados</p>
          <p className="text-xl font-bold text-destructive">{atrasados}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Tipo</label>
          <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} className={cn(inputCls, 'w-40')}>
            <option value="">Todos</option>
            <option value="general">Generales</option>
            <option value="focal">Focales</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Período</label>
          <select value={filtroPeriodo} onChange={(e) => setFiltroPeriodo(e.target.value as 'vigentes' | 'todos')} className={cn(inputCls, 'w-40')}>
            <option value="vigentes">Vigentes</option>
            <option value="todos">Todos</option>
          </select>
        </div>
        {(filtroTipo || filtroPeriodo !== 'vigentes') && (
          <button
            onClick={() => { setFiltroTipo(''); setFiltroPeriodo('vigentes') }}
            className="flex h-9 items-center gap-1 rounded-lg border border-border px-3 text-xs hover:bg-muted"
          >
            <X size={12} /> Limpiar
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-12 text-muted-foreground">
          <Loader2 size={20} className="animate-spin mr-2" /> Cargando...
        </div>
      ) : !filtered.length ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border p-12">
          <Target size={48} className="mb-3 text-muted-foreground/50" />
          <p className="text-muted-foreground">No hay objetivos para los filtros seleccionados</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-xs">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Vendedor</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Objetivo</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Tipo</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Métrica</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Meta</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actual</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Progreso</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Estado</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Período</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(obj => {
                const est = estadoLabel(obj.porcentaje)
                return (
                  <tr key={obj.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium">{obj.vendedorNombre}</td>
                    <td className="px-4 py-3">{obj.nombre}</td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'inline-flex rounded px-1.5 py-0.5 text-[10px] font-bold uppercase',
                        obj.tipo === 'general' ? 'bg-primary/10 text-primary' : 'bg-purple-50 text-purple-600',
                      )}>
                        {obj.tipo}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">{metricaLabels[obj.metrica] || obj.metrica}</td>
                    <td className="px-4 py-3 text-right">
                      {isMonetary(obj.metrica) ? formatCurrency(obj.valorObjetivo) : obj.valorObjetivo}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {isMonetary(obj.metrica) ? formatCurrency(obj.valorActual) : obj.valorActual}
                    </td>
                    <td className="px-4 py-3 w-40">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn('h-full rounded-full transition-all', progressColor(obj.porcentaje))}
                            style={{ width: `${Math.min(obj.porcentaje, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium w-10 text-right">{obj.porcentaje}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', est.color)}>
                        {est.text}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(obj.periodoInicio)} — {formatDate(obj.periodoFin)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
