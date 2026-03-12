import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import api from '../../api/client'

interface WhiteLabelConfig {
  appNombre: string
  colorPrimario: string
  colorSecundario: string
  logoUrl: string
}

export default function WhiteLabel() {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<WhiteLabelConfig>({
    appNombre: 'BizVentas',
    colorPrimario: '#2563eb',
    colorSecundario: '#1e293b',
    logoUrl: '',
  })

  useQuery({
    queryKey: ['config-whitelabel'],
    queryFn: async () => {
      try {
        const { data: res } = await api.get('/config/white-label')
        if (res.data) setForm((prev) => ({ ...prev, ...res.data }))
        return res.data
      } catch {
        return null
      }
    },
  })

  const saveMutation = useMutation({
    mutationFn: (data: WhiteLabelConfig) => api.put('/config/white-label', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config-whitelabel'] })
      toast.success('Configuración guardada')
    },
    onError: () => toast.error('Error al guardar'),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    saveMutation.mutate(form)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">White Label</h1>
        <p className="text-sm text-muted-foreground">Personalizar la apariencia de la app móvil</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 rounded-xl border border-border bg-card p-6">
        <div>
          <label className="mb-1.5 block text-sm font-medium">Nombre de la app</label>
          <input value={form.appNombre} onChange={(e) => setForm({ ...form, appNombre: e.target.value })} className="h-10 w-full rounded-lg border border-input px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Color primario</label>
            <div className="flex items-center gap-2">
              <input type="color" value={form.colorPrimario} onChange={(e) => setForm({ ...form, colorPrimario: e.target.value })} className="h-10 w-12 cursor-pointer rounded border border-input" />
              <input value={form.colorPrimario} onChange={(e) => setForm({ ...form, colorPrimario: e.target.value })} className="h-10 flex-1 rounded-lg border border-input px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Color secundario</label>
            <div className="flex items-center gap-2">
              <input type="color" value={form.colorSecundario} onChange={(e) => setForm({ ...form, colorSecundario: e.target.value })} className="h-10 w-12 cursor-pointer rounded border border-input" />
              <input value={form.colorSecundario} onChange={(e) => setForm({ ...form, colorSecundario: e.target.value })} className="h-10 flex-1 rounded-lg border border-input px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">URL del logo</label>
          <input value={form.logoUrl} onChange={(e) => setForm({ ...form, logoUrl: e.target.value })} placeholder="https://..." className="h-10 w-full rounded-lg border border-input px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
        </div>

        <div className="rounded-lg border border-border p-4">
          <p className="mb-2 text-sm font-medium">Vista previa</p>
          <div className="flex items-center gap-3 rounded-lg p-3" style={{ backgroundColor: form.colorPrimario }}>
            <div className="h-8 w-8 rounded-lg bg-white/20" />
            <span className="font-semibold text-white">{form.appNombre}</span>
          </div>
        </div>

        <button type="submit" disabled={saveMutation.isPending} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          {saveMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Guardar
        </button>
      </form>
    </div>
  )
}
