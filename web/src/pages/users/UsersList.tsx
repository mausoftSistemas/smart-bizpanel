import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createColumnHelper } from '@tanstack/react-table'
import { Plus, Pencil, Trash2, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import api from '../../api/client'
import DataTable from '../../components/DataTable'

interface User {
  id: string
  email: string
  nombre: string
  rol: string
  activo: boolean
  createdAt: string
}

const col = createColumnHelper<User>()

const rolColors: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-700',
  supervisor: 'bg-blue-100 text-blue-700',
  vendedor: 'bg-green-100 text-green-700',
  deposito: 'bg-orange-100 text-orange-700',
  repartidor: 'bg-teal-100 text-teal-700',
  operador: 'bg-indigo-100 text-indigo-700',
  tesorero: 'bg-cyan-100 text-cyan-700',
}

export default function UsersList() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<User | null>(null)
  const [form, setForm] = useState({ email: '', nombre: '', password: '', rol: 'vendedor' })

  const { data, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data: res } = await api.get('/admin/users')
      return res.data as User[]
    },
  })

  const saveMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => {
      if (editing) return api.put(`/admin/users/${editing.id}`, body)
      return api.post('/auth/register', body)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success(editing ? 'Usuario actualizado' : 'Usuario creado')
      closeForm()
    },
    onError: () => toast.error('Error al guardar'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('Usuario eliminado')
    },
    onError: () => toast.error('Error al eliminar'),
  })

  const openEdit = (u: User) => {
    setEditing(u)
    setForm({ email: u.email, nombre: u.nombre, password: '', rol: u.rol })
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditing(null)
    setForm({ email: '', nombre: '', password: '', rol: 'vendedor' })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const body: Record<string, unknown> = {
      email: form.email,
      nombre: form.nombre,
      rol: form.rol,
    }
    if (form.password) body.password = form.password
    saveMutation.mutate(body)
  }

  const columns = [
    col.accessor('nombre', { header: 'Nombre' }),
    col.accessor('email', { header: 'Email' }),
    col.accessor('rol', {
      header: 'Rol',
      cell: (info) => (
        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${rolColors[info.getValue()] || 'bg-muted'}`}>
          {info.getValue()}
        </span>
      ),
    }),
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
        <div className="flex items-center gap-1">
          <button onClick={() => openEdit(row.original)} className="rounded p-1 hover:bg-muted"><Pencil size={14} /></button>
          <button onClick={() => { if (confirm('Eliminar usuario?')) deleteMutation.mutate(row.original.id) }} className="rounded p-1 hover:bg-muted text-destructive"><Trash2 size={14} /></button>
        </div>
      ),
    }),
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Usuarios</h1>
        <p className="text-sm text-muted-foreground">Administrar usuarios del sistema</p>
      </div>

      {showForm && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">{editing ? 'Editar usuario' : 'Nuevo usuario'}</h2>
            <button onClick={closeForm} className="rounded p-1 hover:bg-muted"><X size={16} /></button>
          </div>
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
            <input required placeholder="Nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className="h-9 rounded-lg border border-input px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
            <input required type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-9 rounded-lg border border-input px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
            <input type="password" placeholder={editing ? 'Nueva contraseña (dejar vacío para no cambiar)' : 'Contraseña'} required={!editing} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="h-9 rounded-lg border border-input px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
            <select value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value })} className="h-9 rounded-lg border border-input px-3 text-sm outline-none focus:ring-2 focus:ring-ring">
              <option value="admin">Admin</option>
              <option value="supervisor">Supervisor</option>
              <option value="vendedor">Vendedor</option>
              <option value="deposito">Deposito</option>
              <option value="repartidor">Repartidor</option>
              <option value="operador">Operador ERP</option>
              <option value="tesorero">Tesorero</option>
            </select>
            <div className="sm:col-span-2">
              <button type="submit" disabled={saveMutation.isPending} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                {saveMutation.isPending && <Loader2 size={14} className="animate-spin" />}
                {editing ? 'Guardar' : 'Crear usuario'}
              </button>
            </div>
          </form>
        </div>
      )}

      <DataTable
        data={data || []}
        columns={columns}
        searchPlaceholder="Buscar usuarios..."
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
