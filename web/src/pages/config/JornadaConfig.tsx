import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import api from '../../api/client'

interface JornadaSettings {
  horaInicio: string
  horaFin: string
  diasLaborables: string[]
  requiereApertura: boolean
  requiereCierre: boolean
  toleranciaMinutos: number
}

const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']

export default function JornadaConfig() {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<JornadaSettings>({
    horaInicio: '08:00',
    horaFin: '18:00',
    diasLaborables: ['lunes', 'martes', 'miércoles', 'jueves', 'viernes'],
    requiereApertura: true,
    requiereCierre: true,
    toleranciaMinutos: 15,
  })

  useQuery({
    queryKey: ['config-jornada'],
    queryFn: async () => {
      try {
        const { data: res } = await api.get('/config/jornada')
        if (res.data) setForm((prev) => ({ ...prev, ...res.data }))
        return res.data
      } catch {
        return null
      }
    },
  })

  const saveMutation = useMutation({
    mutationFn: (data: JornadaSettings) => api.put('/config/jornada', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config-jornada'] })
      toast.success('Configuración guardada')
    },
    onError: () => toast.error('Error al guardar'),
  })

  const toggleDia = (dia: string) => {
    setForm((prev) => ({
      ...prev,
      diasLaborables: prev.diasLaborables.includes(dia)
        ? prev.diasLaborables.filter((d) => d !== dia)
        : [...prev.diasLaborables, dia],
    }))
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Configuración de Jornada</h1>
        <p className="text-sm text-muted-foreground">Horarios y días laborables para los vendedores</p>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(form) }} className="space-y-6 rounded-xl border border-border bg-card p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Hora inicio</label>
            <input type="time" value={form.horaInicio} onChange={(e) => setForm({ ...form, horaInicio: e.target.value })} className="h-10 w-full rounded-lg border border-input px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Hora fin</label>
            <input type="time" value={form.horaFin} onChange={(e) => setForm({ ...form, horaFin: e.target.value })} className="h-10 w-full rounded-lg border border-input px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">Días laborables</label>
          <div className="flex flex-wrap gap-2">
            {DIAS.map((dia) => (
              <button
                key={dia}
                type="button"
                onClick={() => toggleDia(dia)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                  form.diasLaborables.includes(dia)
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {dia}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium">Tolerancia (minutos)</label>
          <input type="number" min={0} max={60} value={form.toleranciaMinutos} onChange={(e) => setForm({ ...form, toleranciaMinutos: parseInt(e.target.value) })} className="h-10 w-32 rounded-lg border border-input px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
        </div>

        <div className="space-y-3">
          <label className="flex items-center gap-3">
            <input type="checkbox" checked={form.requiereApertura} onChange={(e) => setForm({ ...form, requiereApertura: e.target.checked })} className="h-4 w-4 rounded border-input" />
            <span className="text-sm">Requiere apertura de jornada</span>
          </label>
          <label className="flex items-center gap-3">
            <input type="checkbox" checked={form.requiereCierre} onChange={(e) => setForm({ ...form, requiereCierre: e.target.checked })} className="h-4 w-4 rounded border-input" />
            <span className="text-sm">Requiere cierre de jornada</span>
          </label>
        </div>

        <button type="submit" disabled={saveMutation.isPending} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          {saveMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Guardar
        </button>
      </form>
    </div>
  )
}
