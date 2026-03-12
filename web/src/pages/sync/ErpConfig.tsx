import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, Loader2, TestTube } from 'lucide-react'
import { toast } from 'sonner'
import api from '../../api/client'

interface ErpSettings {
  erpType: string
  erpUrl: string
  erpUser: string
  erpPassword: string
  erpDb: string
  syncInterval: number
}

export default function ErpConfig() {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<ErpSettings>({
    erpType: 'standalone',
    erpUrl: '',
    erpUser: '',
    erpPassword: '',
    erpDb: '',
    syncInterval: 30,
  })

  const { isLoading } = useQuery({
    queryKey: ['erp-config'],
    queryFn: async () => {
      try {
        const { data: res } = await api.get('/admin/erp-config')
        setForm(res.data)
        return res.data
      } catch {
        return null
      }
    },
  })

  const saveMutation = useMutation({
    mutationFn: (data: ErpSettings) => api.put('/admin/erp-config', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['erp-config'] })
      toast.success('Configuración guardada')
    },
    onError: () => toast.error('Error al guardar'),
  })

  const testMutation = useMutation({
    mutationFn: () => api.post('/admin/erp-config/test'),
    onSuccess: () => toast.success('Conexión exitosa'),
    onError: () => toast.error('Error de conexión al ERP'),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    saveMutation.mutate(form)
  }

  if (isLoading) return <div className="flex items-center justify-center p-12 text-muted-foreground">Cargando...</div>

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Configurar ERP</h1>
        <p className="text-sm text-muted-foreground">Configurar la conexión con el sistema ERP externo</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 rounded-xl border border-border bg-card p-6">
        <div>
          <label className="mb-1.5 block text-sm font-medium">Tipo de ERP</label>
          <select
            value={form.erpType}
            onChange={(e) => setForm({ ...form, erpType: e.target.value })}
            className="h-10 w-full rounded-lg border border-input px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="standalone">Standalone (sin ERP externo)</option>
            <option value="sap_b1">SAP Business One</option>
            <option value="tango">Tango Gestión</option>
            <option value="custom">Custom / API genérica</option>
          </select>
          <p className="mt-1 text-xs text-muted-foreground">
            En modo standalone, el sistema opera de forma independiente sin sincronizar con un ERP.
          </p>
        </div>

        {form.erpType !== 'standalone' && (
          <>
            <div>
              <label className="mb-1.5 block text-sm font-medium">URL del ERP</label>
              <input
                type="url"
                value={form.erpUrl}
                onChange={(e) => setForm({ ...form, erpUrl: e.target.value })}
                placeholder="https://erp.empresa.com:50000"
                className="h-10 w-full rounded-lg border border-input px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Usuario</label>
                <input
                  type="text"
                  value={form.erpUser}
                  onChange={(e) => setForm({ ...form, erpUser: e.target.value })}
                  className="h-10 w-full rounded-lg border border-input px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Contraseña</label>
                <input
                  type="password"
                  value={form.erpPassword}
                  onChange={(e) => setForm({ ...form, erpPassword: e.target.value })}
                  className="h-10 w-full rounded-lg border border-input px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Base de datos</label>
                <input
                  type="text"
                  value={form.erpDb}
                  onChange={(e) => setForm({ ...form, erpDb: e.target.value })}
                  placeholder="SBO_EMPRESA"
                  className="h-10 w-full rounded-lg border border-input px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Intervalo sync (min)</label>
                <input
                  type="number"
                  min={5}
                  max={1440}
                  value={form.syncInterval}
                  onChange={(e) => setForm({ ...form, syncInterval: parseInt(e.target.value) })}
                  className="h-10 w-full rounded-lg border border-input px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
          </>
        )}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saveMutation.isPending}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {saveMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Guardar
          </button>
          {form.erpType !== 'standalone' && (
            <button
              type="button"
              onClick={() => testMutation.mutate()}
              disabled={testMutation.isPending}
              className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
            >
              {testMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <TestTube size={14} />}
              Probar conexión
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
