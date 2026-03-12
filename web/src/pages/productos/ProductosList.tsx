import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createColumnHelper } from '@tanstack/react-table'
import { Plus, Pencil, Trash2, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import api from '../../api/client'
import DataTable from '../../components/DataTable'
import { formatCurrency } from '../../lib/utils'

interface Producto {
  id: string
  codigoErp: string
  nombre: string
  precio: number
  categoria: string | null
  unidadMedida: string | null
  stock: number | null
  activo: boolean
}

const col = createColumnHelper<Producto>()

const columns = [
  col.accessor('codigoErp', { header: 'Código' }),
  col.accessor('nombre', { header: 'Nombre' }),
  col.accessor('precio', { header: 'Precio', cell: (info) => formatCurrency(info.getValue()) }),
  col.accessor('categoria', { header: 'Categoría', cell: (info) => info.getValue() || '—' }),
  col.accessor('stock', { header: 'Stock', cell: (info) => info.getValue() ?? '—' }),
  col.accessor('activo', {
    header: 'Estado',
    cell: (info) => (
      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${info.getValue() ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
        {info.getValue() ? 'Activo' : 'Inactivo'}
      </span>
    ),
  }),
]

export default function ProductosList() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Producto | null>(null)
  const [form, setForm] = useState({ codigoErp: '', nombre: '', precio: '', categoria: '', unidadMedida: '', stock: '' })

  const { data, isLoading } = useQuery({
    queryKey: ['productos'],
    queryFn: async () => {
      const { data: res } = await api.get('/productos?limit=1000')
      return res.data as Producto[]
    },
  })

  const saveMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      if (editing) {
        return api.put(`/productos/${editing.id}`, body)
      }
      return api.post('/productos', body)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productos'] })
      toast.success(editing ? 'Producto actualizado' : 'Producto creado')
      closeForm()
    },
    onError: () => toast.error('Error al guardar'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/productos/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productos'] })
      toast.success('Producto eliminado')
    },
    onError: () => toast.error('Error al eliminar'),
  })

  const openEdit = (p: Producto) => {
    setEditing(p)
    setForm({
      codigoErp: p.codigoErp,
      nombre: p.nombre,
      precio: String(p.precio),
      categoria: p.categoria || '',
      unidadMedida: p.unidadMedida || '',
      stock: p.stock != null ? String(p.stock) : '',
    })
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditing(null)
    setForm({ codigoErp: '', nombre: '', precio: '', categoria: '', unidadMedida: '', stock: '' })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    saveMutation.mutate({
      codigoErp: form.codigoErp,
      nombre: form.nombre,
      precio: parseFloat(form.precio),
      categoria: form.categoria || null,
      unidadMedida: form.unidadMedida || null,
      stock: form.stock ? parseInt(form.stock) : null,
    })
  }

  const actionColumns = [
    ...columns,
    col.display({
      id: 'actions',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <button onClick={() => openEdit(row.original)} className="rounded p-1 hover:bg-muted"><Pencil size={14} /></button>
          <button onClick={() => { if (confirm('Eliminar producto?')) deleteMutation.mutate(row.original.id) }} className="rounded p-1 hover:bg-muted text-destructive"><Trash2 size={14} /></button>
        </div>
      ),
    }),
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Productos</h1>
          <p className="text-sm text-muted-foreground">Gestión del catálogo de productos</p>
        </div>
      </div>

      {showForm && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">{editing ? 'Editar producto' : 'Nuevo producto'}</h2>
            <button onClick={closeForm} className="rounded p-1 hover:bg-muted"><X size={16} /></button>
          </div>
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-3">
            <input required placeholder="Código ERP" value={form.codigoErp} onChange={(e) => setForm({ ...form, codigoErp: e.target.value })} className="h-9 rounded-lg border border-input px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
            <input required placeholder="Nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className="h-9 rounded-lg border border-input px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
            <input required type="number" step="0.01" placeholder="Precio" value={form.precio} onChange={(e) => setForm({ ...form, precio: e.target.value })} className="h-9 rounded-lg border border-input px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
            <input placeholder="Categoría" value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} className="h-9 rounded-lg border border-input px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
            <input placeholder="Unidad de medida" value={form.unidadMedida} onChange={(e) => setForm({ ...form, unidadMedida: e.target.value })} className="h-9 rounded-lg border border-input px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
            <input type="number" placeholder="Stock" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} className="h-9 rounded-lg border border-input px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
            <div className="sm:col-span-3">
              <button type="submit" disabled={saveMutation.isPending} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                {saveMutation.isPending && <Loader2 size={14} className="animate-spin" />}
                {editing ? 'Guardar cambios' : 'Crear producto'}
              </button>
            </div>
          </form>
        </div>
      )}

      <DataTable
        data={data || []}
        columns={actionColumns}
        searchPlaceholder="Buscar productos..."
        loading={isLoading}
        actions={
          <button onClick={() => { closeForm(); setShowForm(true) }} className="flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <Plus size={16} /> Nuevo
          </button>
        }
      />
    </div>
  )
}
