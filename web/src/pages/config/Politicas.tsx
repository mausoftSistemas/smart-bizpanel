import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createColumnHelper } from '@tanstack/react-table'
import { Plus, Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useState } from 'react'
import api from '../../api/client'
import DataTable from '../../components/DataTable'

interface Politica {
  id: string
  nombre: string
  tipo: string
  valor: string
  activo: boolean
}

const col = createColumnHelper<Politica>()

export default function Politicas() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ nombre: '', tipo: 'descuento_maximo', valor: '' })

  const { data, isLoading } = useQuery({
    queryKey: ['politicas'],
    queryFn: async () => {
      try {
        const { data: res } = await api.get('/admin/politicas')
        return res.data as Politica[]
      } catch {
        return []
      }
    },
  })

  const saveMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post('/admin/politicas', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['politicas'] })
      toast.success('Política creada')
      setShowForm(false)
      setForm({ nombre: '', tipo: 'descuento_maximo', valor: '' })
    },
    onError: () => toast.error('Error al guardar'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/politicas/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['politicas'] })
      toast.success('Política eliminada')
    },
    onError: () => toast.error('Error al eliminar'),
  })

  const columns = [
    col.accessor('nombre', { header: 'Nombre' }),
    col.accessor('tipo', { header: 'Tipo' }),
    col.accessor('valor', { header: 'Valor' }),
    col.accessor('activo', {
      header: 'Estado',
      cell: (info) => (
        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${info.getValue() ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
          {info.getValue() ? 'Activo' : 'Inactivo'}
        </span>
      ),
    }),
    col.display({
      id: 'actions',
      cell: ({ row }) => (
        <button onClick={() => { if (confirm('Eliminar?')) deleteMutation.mutate(row.original.id) }} className="rounded p-1 hover:bg-muted text-destructive">
          <Trash2 size={14} />
        </button>
      ),
    }),
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Políticas Comerciales</h1>
        <p className="text-sm text-muted-foreground">Descuentos máximos, bonificaciones, restricciones</p>
      </div>

      {showForm && (
        <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(form) }} className="rounded-xl border border-border bg-card p-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <input required placeholder="Nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className="h-9 rounded-lg border border-input px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
            <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} className="h-9 rounded-lg border border-input px-3 text-sm outline-none focus:ring-2 focus:ring-ring">
              <option value="descuento_maximo">Descuento máximo</option>
              <option value="bonificacion">Bonificación</option>
              <option value="monto_minimo">Monto mínimo pedido</option>
              <option value="restriccion">Restricción</option>
            </select>
            <input required placeholder="Valor" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} className="h-9 rounded-lg border border-input px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <button type="submit" disabled={saveMutation.isPending} className="mt-4 flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {saveMutation.isPending && <Loader2 size={14} className="animate-spin" />}
            Crear
          </button>
        </form>
      )}

      <DataTable
        data={data || []}
        columns={columns}
        loading={isLoading}
        actions={
          <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <Plus size={16} /> Nueva
          </button>
        }
      />
    </div>
  )
}
