import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import api from '../../api/client'

const MEDIOS_DISPONIBLES = [
  { key: 'efectivo', label: 'Efectivo' },
  { key: 'cheque', label: 'Cheque' },
  { key: 'transferencia', label: 'Transferencia bancaria' },
  { key: 'tarjeta_credito', label: 'Tarjeta de crédito' },
  { key: 'tarjeta_debito', label: 'Tarjeta de débito' },
  { key: 'mercadopago', label: 'MercadoPago' },
  { key: 'retencion', label: 'Retención' },
  { key: 'otro', label: 'Otro' },
]

export default function MediosPago() {
  const queryClient = useQueryClient()
  const [habilitados, setHabilitados] = useState<string[]>(['efectivo', 'cheque', 'transferencia'])

  useQuery({
    queryKey: ['config-medios-pago'],
    queryFn: async () => {
      try {
        const { data: res } = await api.get('/config/medios-pago')
        if (res.data?.habilitados) setHabilitados(res.data.habilitados)
        return res.data
      } catch {
        return null
      }
    },
  })

  const saveMutation = useMutation({
    mutationFn: () => api.put('/config/medios-pago', { habilitados }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config-medios-pago'] })
      toast.success('Medios de pago guardados')
    },
    onError: () => toast.error('Error al guardar'),
  })

  const toggle = (key: string) => {
    setHabilitados((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key])
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Medios de Pago</h1>
        <p className="text-sm text-muted-foreground">Configurar los medios de pago disponibles para cobranzas</p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <div className="space-y-3">
          {MEDIOS_DISPONIBLES.map((medio) => (
            <label key={medio.key} className="flex items-center gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-muted/30 transition-colors">
              <input
                type="checkbox"
                checked={habilitados.includes(medio.key)}
                onChange={() => toggle(medio.key)}
                className="h-4 w-4 rounded border-input"
              />
              <span className="text-sm font-medium">{medio.label}</span>
            </label>
          ))}
        </div>

        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="mt-6 flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {saveMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Guardar
        </button>
      </div>
    </div>
  )
}
