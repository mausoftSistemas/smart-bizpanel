import { useQuery } from '@tanstack/react-query'
import { Target } from 'lucide-react'
import api from '../../api/client'
import { formatCurrency, cn } from '../../lib/utils'

interface Objetivo {
  id: string
  nombre: string
  tipo: string
  meta: number
  actual: number
  porcentaje: number
  vendedor: { nombre: string }
}

export default function Objetivos() {
  const { data: objetivos, isLoading } = useQuery({
    queryKey: ['reportes-objetivos'],
    queryFn: async () => {
      try {
        const { data: res } = await api.get('/admin/reportes/objetivos')
        return res.data as Objetivo[]
      } catch {
        return []
      }
    },
  })

  if (isLoading) return <div className="flex items-center justify-center p-12 text-muted-foreground">Cargando...</div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Objetivos</h1>
        <p className="text-sm text-muted-foreground">Seguimiento de objetivos comerciales</p>
      </div>

      {!objetivos?.length ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border p-12">
          <Target size={48} className="mb-3 text-muted-foreground" />
          <p className="text-muted-foreground">No hay objetivos configurados</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {objetivos.map((obj) => (
            <div key={obj.id} className="rounded-xl border border-border bg-card p-5">
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{obj.nombre}</h3>
                  <p className="text-xs text-muted-foreground">{obj.vendedor.nombre} &middot; {obj.tipo}</p>
                </div>
                <span
                  className={cn(
                    'text-sm font-bold',
                    obj.porcentaje >= 100 ? 'text-success' : obj.porcentaje >= 70 ? 'text-warning' : 'text-destructive',
                  )}
                >
                  {obj.porcentaje.toFixed(0)}%
                </span>
              </div>

              <div className="mb-2 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    obj.porcentaje >= 100 ? 'bg-success' : obj.porcentaje >= 70 ? 'bg-warning' : 'bg-destructive',
                  )}
                  style={{ width: `${Math.min(obj.porcentaje, 100)}%` }}
                />
              </div>

              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Actual: {obj.tipo === 'monto' ? formatCurrency(obj.actual) : obj.actual}</span>
                <span>Meta: {obj.tipo === 'monto' ? formatCurrency(obj.meta) : obj.meta}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
