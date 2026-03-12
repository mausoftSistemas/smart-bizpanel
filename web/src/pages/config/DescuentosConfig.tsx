import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import api from '../../api/client'

interface DescuentosConfigData {
  maxDescuentoVendedor: number
  maxDescuentoSupervisor: number
}

export default function DescuentosConfig() {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<DescuentosConfigData>({
    maxDescuentoVendedor: 10,
    maxDescuentoSupervisor: 20,
  })

  const { isLoading } = useQuery({
    queryKey: ['config-descuentos'],
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
    mutationFn: (data: DescuentosConfigData) => api.put('/admin/config', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config-descuentos'] })
      toast.success('Configuracion de descuentos guardada')
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
        <h1 className="text-2xl font-bold">Configuracion de Descuentos</h1>
        <p className="text-sm text-muted-foreground">Limites de descuento por rol</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 rounded-xl border border-border bg-card p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Descuento max. vendedor (%)</label>
            <input type="number" step="0.1" min={0} max={100} value={form.maxDescuentoVendedor} onChange={(e) => setForm({ ...form, maxDescuentoVendedor: parseFloat(e.target.value) || 0 })} className="h-10 w-full rounded-lg border border-input px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
            <p className="mt-1 text-xs text-muted-foreground">Maximo % de descuento que puede aplicar un vendedor</p>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Descuento max. supervisor (%)</label>
            <input type="number" step="0.1" min={0} max={100} value={form.maxDescuentoSupervisor} onChange={(e) => setForm({ ...form, maxDescuentoSupervisor: parseFloat(e.target.value) || 0 })} className="h-10 w-full rounded-lg border border-input px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
            <p className="mt-1 text-xs text-muted-foreground">Maximo % de descuento que puede aplicar un supervisor</p>
          </div>
        </div>

        <button type="submit" disabled={saveMutation.isPending} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          {saveMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Guardar configuracion
        </button>
      </form>
    </div>
  )
}
