import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import api from '../../api/client'

interface GeneralConfig {
  nombreEmpresa: string
  moneda: string
  zonaHoraria: string
  iva: number
  decimales: number
  requiereGps: boolean
  requiereFoto: boolean
  permitePedidoSinStock: boolean
}

export default function General() {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<GeneralConfig>({
    nombreEmpresa: '',
    moneda: 'ARS',
    zonaHoraria: 'America/Buenos_Aires',
    iva: 21,
    decimales: 2,
    requiereGps: true,
    requiereFoto: false,
    permitePedidoSinStock: false,
  })

  const { isLoading } = useQuery({
    queryKey: ['config-general'],
    queryFn: async () => {
      try {
        const { data: res } = await api.get('/config')
        if (res.data) setForm((prev) => ({ ...prev, ...res.data }))
        return res.data
      } catch {
        return null
      }
    },
  })

  const saveMutation = useMutation({
    mutationFn: (data: GeneralConfig) => api.put('/config', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config-general'] })
      toast.success('Configuración guardada')
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
        <h1 className="text-2xl font-bold">Configuración General</h1>
        <p className="text-sm text-muted-foreground">Parámetros generales del sistema</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 rounded-xl border border-border bg-card p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm font-medium">Nombre de empresa</label>
            <input value={form.nombreEmpresa} onChange={(e) => setForm({ ...form, nombreEmpresa: e.target.value })} className="h-10 w-full rounded-lg border border-input px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Moneda</label>
            <select value={form.moneda} onChange={(e) => setForm({ ...form, moneda: e.target.value })} className="h-10 w-full rounded-lg border border-input px-3 text-sm outline-none focus:ring-2 focus:ring-ring">
              <option value="ARS">ARS - Peso argentino</option>
              <option value="USD">USD - Dólar</option>
              <option value="UYU">UYU - Peso uruguayo</option>
              <option value="CLP">CLP - Peso chileno</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">IVA (%)</label>
            <input type="number" step="0.1" value={form.iva} onChange={(e) => setForm({ ...form, iva: parseFloat(e.target.value) })} className="h-10 w-full rounded-lg border border-input px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Decimales</label>
            <input type="number" min={0} max={4} value={form.decimales} onChange={(e) => setForm({ ...form, decimales: parseInt(e.target.value) })} className="h-10 w-full rounded-lg border border-input px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Zona horaria</label>
            <input value={form.zonaHoraria} onChange={(e) => setForm({ ...form, zonaHoraria: e.target.value })} className="h-10 w-full rounded-lg border border-input px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="font-medium">Opciones de la app móvil</h3>
          <label className="flex items-center gap-3">
            <input type="checkbox" checked={form.requiereGps} onChange={(e) => setForm({ ...form, requiereGps: e.target.checked })} className="h-4 w-4 rounded border-input" />
            <span className="text-sm">Requiere GPS activado para operar</span>
          </label>
          <label className="flex items-center gap-3">
            <input type="checkbox" checked={form.requiereFoto} onChange={(e) => setForm({ ...form, requiereFoto: e.target.checked })} className="h-4 w-4 rounded border-input" />
            <span className="text-sm">Requiere foto en cada visita</span>
          </label>
          <label className="flex items-center gap-3">
            <input type="checkbox" checked={form.permitePedidoSinStock} onChange={(e) => setForm({ ...form, permitePedidoSinStock: e.target.checked })} className="h-4 w-4 rounded border-input" />
            <span className="text-sm">Permitir pedido sin stock</span>
          </label>
        </div>

        <button type="submit" disabled={saveMutation.isPending} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          {saveMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Guardar configuración
        </button>
      </form>
    </div>
  )
}
