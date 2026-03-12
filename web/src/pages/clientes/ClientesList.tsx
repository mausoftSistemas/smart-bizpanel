import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createColumnHelper } from '@tanstack/react-table'
import { Plus, Pencil, Trash2, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import api from '../../api/client'
import DataTable from '../../components/DataTable'

interface Cliente {
  id: string
  codigoErp: string
  razonSocial: string
  cuit: string | null
  direccion: string | null
  localidad: string | null
  telefono: string | null
  email: string | null
  activo: boolean
}

const col = createColumnHelper<Cliente>()

const columns = [
  col.accessor('codigoErp', { header: 'Código' }),
  col.accessor('razonSocial', { header: 'Razón Social' }),
  col.accessor('cuit', { header: 'CUIT', cell: (info) => info.getValue() || '—' }),
  col.accessor('localidad', { header: 'Localidad', cell: (info) => info.getValue() || '—' }),
  col.accessor('telefono', { header: 'Teléfono', cell: (info) => info.getValue() || '—' }),
  col.accessor('activo', {
    header: 'Estado',
    cell: (info) => (
      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${info.getValue() ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
        {info.getValue() ? 'Activo' : 'Inactivo'}
      </span>
    ),
  }),
]

export default function ClientesList() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Cliente | null>(null)
  const [form, setForm] = useState({ codigoErp: '', razonSocial: '', cuit: '', direccion: '', localidad: '', provincia: '', telefono: '', email: '' })

  const { data, isLoading } = useQuery({
    queryKey: ['clientes'],
    queryFn: async () => {
      const { data: res } = await api.get('/clientes?limit=1000')
      return res.data as Cliente[]
    },
  })

  const saveMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      if (editing) return api.put(`/clientes/${editing.id}`, body)
      return api.post('/clientes', body)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] })
      toast.success(editing ? 'Cliente actualizado' : 'Cliente creado')
      closeForm()
    },
    onError: () => toast.error('Error al guardar'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/clientes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] })
      toast.success('Cliente eliminado')
    },
    onError: () => toast.error('Error al eliminar'),
  })

  const openEdit = (c: Cliente) => {
    setEditing(c)
    setForm({
      codigoErp: c.codigoErp,
      razonSocial: c.razonSocial,
      cuit: c.cuit || '',
      direccion: c.direccion || '',
      localidad: c.localidad || '',
      provincia: '',
      telefono: c.telefono || '',
      email: c.email || '',
    })
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditing(null)
    setForm({ codigoErp: '', razonSocial: '', cuit: '', direccion: '', localidad: '', provincia: '', telefono: '', email: '' })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    saveMutation.mutate({
      codigoErp: form.codigoErp,
      razonSocial: form.razonSocial,
      cuit: form.cuit || null,
      direccion: form.direccion || null,
      localidad: form.localidad || null,
      provincia: form.provincia || null,
      telefono: form.telefono || null,
      email: form.email || null,
    })
  }

  const actionColumns = [
    ...columns,
    col.display({
      id: 'actions',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <button onClick={() => openEdit(row.original)} className="rounded p-1 hover:bg-muted"><Pencil size={14} /></button>
          <button onClick={() => { if (confirm('Eliminar cliente?')) deleteMutation.mutate(row.original.id) }} className="rounded p-1 hover:bg-muted text-destructive"><Trash2 size={14} /></button>
        </div>
      ),
    }),
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Clientes</h1>
        <p className="text-sm text-muted-foreground">Gestión de la cartera de clientes</p>
      </div>

      {showForm && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">{editing ? 'Editar cliente' : 'Nuevo cliente'}</h2>
            <button onClick={closeForm} className="rounded p-1 hover:bg-muted"><X size={16} /></button>
          </div>
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-3">
            <input required placeholder="Código ERP" value={form.codigoErp} onChange={(e) => setForm({ ...form, codigoErp: e.target.value })} className="h-9 rounded-lg border border-input px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
            <input required placeholder="Razón Social" value={form.razonSocial} onChange={(e) => setForm({ ...form, razonSocial: e.target.value })} className="h-9 rounded-lg border border-input px-3 text-sm outline-none focus:ring-2 focus:ring-ring sm:col-span-2" />
            <input placeholder="CUIT" value={form.cuit} onChange={(e) => setForm({ ...form, cuit: e.target.value })} className="h-9 rounded-lg border border-input px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
            <input placeholder="Dirección" value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} className="h-9 rounded-lg border border-input px-3 text-sm outline-none focus:ring-2 focus:ring-ring sm:col-span-2" />
            <input placeholder="Localidad" value={form.localidad} onChange={(e) => setForm({ ...form, localidad: e.target.value })} className="h-9 rounded-lg border border-input px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
            <input placeholder="Provincia" value={form.provincia} onChange={(e) => setForm({ ...form, provincia: e.target.value })} className="h-9 rounded-lg border border-input px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
            <input placeholder="Teléfono" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} className="h-9 rounded-lg border border-input px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
            <input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-9 rounded-lg border border-input px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
            <div className="sm:col-span-3">
              <button type="submit" disabled={saveMutation.isPending} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                {saveMutation.isPending && <Loader2 size={14} className="animate-spin" />}
                {editing ? 'Guardar cambios' : 'Crear cliente'}
              </button>
            </div>
          </form>
        </div>
      )}

      <DataTable
        data={data || []}
        columns={actionColumns}
        searchPlaceholder="Buscar clientes..."
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
