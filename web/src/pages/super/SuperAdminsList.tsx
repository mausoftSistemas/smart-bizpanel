import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { MoreVertical, Pencil, KeyRound, Ban, CheckCircle, PlusCircle, X } from 'lucide-react'
import { toast } from 'sonner'
import api from '../../api/client'
import DataTable from '../../components/DataTable'
import { useAuth } from '../../hooks/useAuth'
import { formatDate } from '../../lib/utils'

interface SuperAdmin {
  id: string
  email: string
  nombre: string
  activo: boolean
  createdAt: string
  lastLogin: string | null
}

export default function SuperAdminsList() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [editAdmin, setEditAdmin] = useState<SuperAdmin | null>(null)
  const [passwordAdmin, setPasswordAdmin] = useState<SuperAdmin | null>(null)

  const { data: admins = [], isLoading } = useQuery({
    queryKey: ['super-admins'],
    queryFn: async () => {
      const { data: res } = await api.get('/super/admins')
      return res.data as SuperAdmin[]
    },
  })

  const createMutation = useMutation({
    mutationFn: (body: { email: string; password: string; nombre: string }) =>
      api.post('/super/admins', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admins'] })
      toast.success('Super Admin creado')
      setShowCreate(false)
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Error al crear'),
  })

  const editMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: string; nombre?: string; email?: string }) =>
      api.put(`/super/admins/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admins'] })
      toast.success('Super Admin actualizado')
      setEditAdmin(null)
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Error al editar'),
  })

  const passwordMutation = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      api.put(`/super/admins/${id}/password`, { password }),
    onSuccess: () => {
      toast.success('Contraseña actualizada')
      setPasswordAdmin(null)
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Error'),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, activo }: { id: string; activo: boolean }) =>
      activo ? api.put(`/super/admins/${id}`, { activo: true }) : api.delete(`/super/admins/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admins'] })
      toast.success('Estado actualizado')
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Error'),
  })

  const columns: ColumnDef<SuperAdmin, unknown>[] = [
    {
      accessorKey: 'nombre',
      header: 'Nombre',
      cell: ({ row }) => <span className="font-medium">{row.original.nombre}</span>,
    },
    {
      accessorKey: 'email',
      header: 'Email',
    },
    {
      accessorKey: 'lastLogin',
      header: 'Último Login',
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {row.original.lastLogin ? formatDate(row.original.lastLogin) : '—'}
        </span>
      ),
    },
    {
      accessorKey: 'activo',
      header: 'Estado',
      cell: ({ row }) => (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
          row.original.activo
            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
        }`}>
          {row.original.activo ? 'Activo' : 'Inactivo'}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <RowActions
          admin={row.original}
          currentUserId={user?.id || ''}
          openMenu={openMenu}
          setOpenMenu={setOpenMenu}
          onEdit={(a) => { setEditAdmin(a); setOpenMenu(null) }}
          onPassword={(a) => { setPasswordAdmin(a); setOpenMenu(null) }}
          onToggle={(a) => { toggleMutation.mutate({ id: a.id, activo: !a.activo }); setOpenMenu(null) }}
        />
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Super Admins</h1>
          <p className="text-sm text-muted-foreground">{admins.length} administradores</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-black/90 transition-colors"
        >
          <PlusCircle size={16} />
          Crear Super Admin
        </button>
      </div>

      <DataTable
        data={admins}
        columns={columns}
        searchPlaceholder="Buscar admin..."
        loading={isLoading}
        pageSize={20}
      />

      {/* Modal Crear */}
      {showCreate && (
        <FormModal
          title="Crear Super Admin"
          onClose={() => setShowCreate(false)}
          onSubmit={(vals) => createMutation.mutate(vals as { email: string; password: string; nombre: string })}
          loading={createMutation.isPending}
          fields={[
            { name: 'nombre', label: 'Nombre', required: true },
            { name: 'email', label: 'Email', type: 'email', required: true },
            { name: 'password', label: 'Contraseña', type: 'password', required: true },
          ]}
        />
      )}

      {/* Modal Editar */}
      {editAdmin && (
        <FormModal
          title={`Editar: ${editAdmin.nombre}`}
          onClose={() => setEditAdmin(null)}
          onSubmit={(vals) => editMutation.mutate({ id: editAdmin.id, ...vals })}
          loading={editMutation.isPending}
          fields={[
            { name: 'nombre', label: 'Nombre', required: true, defaultValue: editAdmin.nombre },
            { name: 'email', label: 'Email', type: 'email', required: true, defaultValue: editAdmin.email },
          ]}
        />
      )}

      {/* Modal Cambiar Contraseña */}
      {passwordAdmin && (
        <FormModal
          title={`Cambiar contraseña: ${passwordAdmin.nombre}`}
          onClose={() => setPasswordAdmin(null)}
          onSubmit={(vals) => passwordMutation.mutate({ id: passwordAdmin.id, password: vals.password })}
          loading={passwordMutation.isPending}
          fields={[
            { name: 'password', label: 'Nueva contraseña', type: 'password', required: true },
          ]}
        />
      )}
    </div>
  )
}

// ─── Menú de acciones por fila ──────────────────────────────

interface RowActionsProps {
  admin: SuperAdmin
  currentUserId: string
  openMenu: string | null
  setOpenMenu: (id: string | null) => void
  onEdit: (a: SuperAdmin) => void
  onPassword: (a: SuperAdmin) => void
  onToggle: (a: SuperAdmin) => void
}

function RowActions({ admin, currentUserId, openMenu, setOpenMenu, onEdit, onPassword, onToggle }: RowActionsProps) {
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const isOpen = openMenu === admin.id
  const isSelf = admin.id === currentUserId

  useEffect(() => {
    if (!isOpen || !btnRef.current || !menuRef.current) return
    const r = btnRef.current.getBoundingClientRect()
    const m = menuRef.current
    let top = r.bottom + 4
    let left = r.right - m.offsetWidth
    if (top + m.offsetHeight > window.innerHeight) top = r.top - m.offsetHeight - 4
    if (left < 8) left = 8
    m.style.top = `${top}px`
    m.style.left = `${left}px`
  }, [isOpen])

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpenMenu(isOpen ? null : admin.id)}
        className="rounded p-1 hover:bg-muted transition-colors"
      >
        <MoreVertical size={16} />
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpenMenu(null)} />
          <div ref={menuRef} className="fixed z-50 w-48 rounded-lg border border-border bg-card py-1 shadow-lg">
            <button
              onClick={() => onEdit(admin)}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors"
            >
              <Pencil size={14} /> Editar
            </button>
            <button
              onClick={() => onPassword(admin)}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors"
            >
              <KeyRound size={14} /> Cambiar contraseña
            </button>
            {!isSelf && (
              <>
                <div className="my-1 border-t border-border" />
                {admin.activo ? (
                  <button
                    onClick={() => onToggle(admin)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-muted transition-colors"
                  >
                    <Ban size={14} /> Desactivar
                  </button>
                ) : (
                  <button
                    onClick={() => onToggle(admin)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-green-600 hover:bg-muted transition-colors"
                  >
                    <CheckCircle size={14} /> Activar
                  </button>
                )}
              </>
            )}
          </div>
        </>
      )}
    </>
  )
}

// ─── Modal genérico de formulario ───────────────────────────

interface Field {
  name: string
  label: string
  type?: string
  required?: boolean
  defaultValue?: string
}

interface FormModalProps {
  title: string
  fields: Field[]
  loading: boolean
  onClose: () => void
  onSubmit: (values: Record<string, string>) => void
}

function FormModal({ title, fields, loading, onClose, onSubmit }: FormModalProps) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const f of fields) init[f.name] = f.defaultValue || ''
    return init
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(values)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-3">
          {fields.map((f) => (
            <div key={f.name}>
              <label className="mb-1 block text-sm font-medium">{f.label}</label>
              <input
                type={f.type || 'text'}
                required={f.required}
                value={values[f.name] || ''}
                onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          ))}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-black/90 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </form>
    </div>
  )
}
