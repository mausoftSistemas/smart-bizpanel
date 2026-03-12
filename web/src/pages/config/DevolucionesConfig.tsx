import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import api from '../../api/client'

interface DevolucionesConfigData {
  diasLimiteDevolucion: number
  devolucionRequiereFoto: boolean
  devolucionRequiereAprobacion: boolean
}

export default function DevolucionesConfig() {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<DevolucionesConfigData>({
    diasLimiteDevolucion: 30,
    devolucionRequiereFoto: true,
    devolucionRequiereAprobacion: true,
  })

  const { isLoading } = useQuery({
    queryKey: ['config-devoluciones'],
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
    mutationFn: (data: DevolucionesConfigData) => api.put('/admin/config', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config-devoluciones'] })
      toast.success('Configuracion de devoluciones guardada')
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
        <h1 className="text-2xl font-bold">Configuracion de Devoluciones</h1>
        <p className="text-sm text-muted-foreground">Parametros para el proceso de devoluciones</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 rounded-xl border border-border bg-card p-6">
        <div>
          <label className="mb-1.5 block text-sm font-medium">Dias limite para devolucion</label>
          <input type="number" min={0} value={form.diasLimiteDevolucion} onChange={(e) => setForm({ ...form, diasLimiteDevolucion: parseInt(e.target.value) || 0 })} className="h-10 w-full max-w-xs rounded-lg border border-input px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
          <p className="mt-1 text-xs text-muted-foreground">Cantidad de dias despues de la compra que se permite devolver. 0 = sin limite.</p>
        </div>

        <div className="space-y-3">
          <h3 className="font-medium">Requisitos</h3>
          <label className="flex items-center gap-3">
            <input type="checkbox" checked={form.devolucionRequiereFoto} onChange={(e) => setForm({ ...form, devolucionRequiereFoto: e.target.checked })} className="h-4 w-4 rounded border-input" />
            <div>
              <span className="text-sm">Requiere foto</span>
              <p className="text-xs text-muted-foreground">El vendedor debe adjuntar foto del producto devuelto</p>
            </div>
          </label>
          <label className="flex items-center gap-3">
            <input type="checkbox" checked={form.devolucionRequiereAprobacion} onChange={(e) => setForm({ ...form, devolucionRequiereAprobacion: e.target.checked })} className="h-4 w-4 rounded border-input" />
            <div>
              <span className="text-sm">Requiere aprobacion</span>
              <p className="text-xs text-muted-foreground">La devolucion queda pendiente hasta que un admin/supervisor la apruebe</p>
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
