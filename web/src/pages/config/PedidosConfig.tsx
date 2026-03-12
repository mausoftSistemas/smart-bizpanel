import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import api from '../../api/client'

interface PedidosConfigData {
  montoMinimoPedido: number
  montoMaximoPedido: number
  permitePedidoSinStock: boolean
  requiereFirma: boolean
}

export default function PedidosConfig() {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<PedidosConfigData>({
    montoMinimoPedido: 0,
    montoMaximoPedido: 0,
    permitePedidoSinStock: true,
    requiereFirma: false,
  })

  const { isLoading } = useQuery({
    queryKey: ['config-pedidos'],
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
    mutationFn: (data: PedidosConfigData) => api.put('/admin/config', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config-pedidos'] })
      toast.success('Configuracion de pedidos guardada')
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
        <h1 className="text-2xl font-bold">Configuracion de Pedidos</h1>
        <p className="text-sm text-muted-foreground">Parametros para la toma de pedidos en la app movil</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 rounded-xl border border-border bg-card p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Monto minimo de pedido</label>
            <input type="number" step="0.01" min={0} value={form.montoMinimoPedido} onChange={(e) => setForm({ ...form, montoMinimoPedido: parseFloat(e.target.value) || 0 })} className="h-10 w-full rounded-lg border border-input px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
            <p className="mt-1 text-xs text-muted-foreground">0 = sin minimo</p>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Monto maximo de pedido</label>
            <input type="number" step="0.01" min={0} value={form.montoMaximoPedido} onChange={(e) => setForm({ ...form, montoMaximoPedido: parseFloat(e.target.value) || 0 })} className="h-10 w-full rounded-lg border border-input px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
            <p className="mt-1 text-xs text-muted-foreground">0 = sin maximo</p>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="font-medium">Opciones</h3>
          <label className="flex items-center gap-3">
            <input type="checkbox" checked={form.permitePedidoSinStock} onChange={(e) => setForm({ ...form, permitePedidoSinStock: e.target.checked })} className="h-4 w-4 rounded border-input" />
            <div>
              <span className="text-sm">Permitir pedido sin stock</span>
              <p className="text-xs text-muted-foreground">El vendedor puede tomar pedidos de productos sin stock</p>
            </div>
          </label>
          <label className="flex items-center gap-3">
            <input type="checkbox" checked={form.requiereFirma} onChange={(e) => setForm({ ...form, requiereFirma: e.target.checked })} className="h-4 w-4 rounded border-input" />
            <div>
              <span className="text-sm">Requiere firma del cliente</span>
              <p className="text-xs text-muted-foreground">El pedido debe ser firmado por el cliente en la app</p>
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
