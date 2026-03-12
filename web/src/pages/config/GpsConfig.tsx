import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import api from '../../api/client'

interface GpsConfigData {
  trackingIntervaloSeg: number
  trackingActivo: boolean
}

export default function GpsConfig() {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<GpsConfigData>({
    trackingIntervaloSeg: 30,
    trackingActivo: true,
  })

  const { isLoading } = useQuery({
    queryKey: ['config-gps'],
    queryFn: async () => {
      try {
        const { data: res } = await api.get('/admin/config')
        if (res.data) setForm((prev) => ({ ...prev, ...res.data }))
        return res.data
      } catch {
        return null
      }
    },
  })

  const saveMutation = useMutation({
    mutationFn: (data: GpsConfigData) => api.put('/admin/config', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config-gps'] })
      toast.success('Configuracion GPS guardada')
    },
    onError: () => toast.error('Error al guardar'),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    saveMutation.mutate(form)
  }

  if (isLoading) return <div className="flex items-center justify-center p-12 text-muted-foreground">Cargando...</div>

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Configuracion GPS / Tracking</h1>
        <p className="text-sm text-muted-foreground">Parametros de seguimiento GPS de los vendedores</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 rounded-xl border border-border bg-card p-6">
        <div>
          <label className="mb-1.5 block text-sm font-medium">Intervalo de tracking (segundos)</label>
          <input type="number" min={5} max={300} value={form.trackingIntervaloSeg} onChange={(e) => setForm({ ...form, trackingIntervaloSeg: parseInt(e.target.value) || 30 })} className="h-10 w-full max-w-xs rounded-lg border border-input px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
          <p className="mt-1 text-xs text-muted-foreground">Cada cuantos segundos la app envia la posicion GPS (min. 5, max. 300)</p>
        </div>

        <div className="space-y-3">
          <label className="flex items-center gap-3">
            <input type="checkbox" checked={form.trackingActivo} onChange={(e) => setForm({ ...form, trackingActivo: e.target.checked })} className="h-4 w-4 rounded border-input" />
            <div>
              <span className="text-sm">Tracking activo</span>
              <p className="text-xs text-muted-foreground">Habilitar el rastreo GPS de los vendedores durante la jornada</p>
            </div>
          </label>
        </div>

        <button type="submit" disabled={saveMutation.isPending} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          {saveMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Guardar configuracion
        </button>
      </form>
    </div>
  )
}
