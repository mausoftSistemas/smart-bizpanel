import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { MoreVertical, Pencil, Ban, CheckCircle, PlusCircle, X } from 'lucide-react'
import { toast } from 'sonner'
import api from '../../api/client'
import DataTable from '../../components/DataTable'

interface Billetera {
  id: string
  nombre: string
  alias: string | null
  cbu: string | null
  activo: boolean
}

export default function BilleterasList() {
  const queryClient = useQueryClient()
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [editItem, setEditItem] = useState<Billetera | null>(null)

  const { data = [], isLoading } = useQuery({
    queryKey: ['billeteras'],
    queryFn: async () => {
      const { data: res } = await api.get('/admin/billeteras')
      return res.data as Billetera[]
    },
  })

  const createMutation = useMutation({
    mutationFn: (body: Partial<Billetera>) => api.post('/admin/billeteras', body),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['billeteras'] }); toast.success('Billetera creada'); setShowCreate(false) },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Error al crear'),
  })

  const editMutation = useMutation({
    mutationFn: ({ id, ...body }: Partial<Billetera> & { id: string }) => api.put(`/admin/billeteras/${id}`, body),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['billeteras'] }); toast.success('Billetera actualizada'); setEditItem(null) },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Error al editar'),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, activo }: { id: string; activo: boolean }) =>
      activo ? api.put(`/admin/billeteras/${id}`, { activo: true }) : api.delete(`/admin/billeteras/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['billeteras'] }); toast.success('Estado actualizado') },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Error'),
  })

  const columns: ColumnDef<Billetera, unknown>[] = [
    { accessorKey: 'nombre', header: 'Nombre', cell: ({ row }) => <span className="font-medium">{row.original.nombre}</span> },
    { accessorKey: 'alias', header: 'Alias', cell: ({ row }) => row.original.alias || '—' },
    { accessorKey: 'cbu', header: 'CBU/CVU', cell: ({ row }) => row.original.cbu ? <span className="font-mono text-xs">{row.original.cbu}</span> : '—' },
    {
      accessorKey: 'activo', header: 'Estado',
      cell: ({ row }) => (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${row.original.activo ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
          {row.original.activo ? 'Activo' : 'Inactivo'}
        </span>
      ),
    },
    {
      id: 'actions', header: '',
      cell: ({ row }) => (
        <RowActions item={row.original} openMenu={openMenu} setOpenMenu={setOpenMenu}
          onEdit={(i) => { setEditItem(i); setOpenMenu(null) }}
          onToggle={(i) => { toggleMutation.mutate({ id: i.id, activo: !i.activo }); setOpenMenu(null) }}
        />
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Billeteras Virtuales</h1>
          <p className="text-sm text-muted-foreground">{data.length} billeteras</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
          <PlusCircle size={16} /> Nueva Billetera
        </button>
      </div>

      <DataTable data={data} columns={columns} searchPlaceholder="Buscar billetera..." loading={isLoading} pageSize={20} />

      {showCreate && (
        <FormModal title="Crear Billetera" onClose={() => setShowCreate(false)}
          onSubmit={(v) => createMutation.mutate(v as any)} loading={createMutation.isPending}
          fields={[
            { name: 'nombre', label: 'Nombre', required: true },
            { name: 'alias', label: 'Alias' },
            { name: 'cbu', label: 'CBU/CVU' },
          ]}
        />
      )}
      {editItem && (
        <FormModal title={`Editar: ${editItem.nombre}`} onClose={() => setEditItem(null)}
          onSubmit={(v) => editMutation.mutate({ id: editItem.id, ...v } as any)} loading={editMutation.isPending}
          fields={[
            { name: 'nombre', label: 'Nombre', required: true, defaultValue: editItem.nombre },
            { name: 'alias', label: 'Alias', defaultValue: editItem.alias || '' },
            { name: 'cbu', label: 'CBU/CVU', defaultValue: editItem.cbu || '' },
          ]}
        />
      )}
    </div>
  )
}

function RowActions({ item, openMenu, setOpenMenu, onEdit, onToggle }: {
  item: Billetera; openMenu: string | null; setOpenMenu: (id: string | null) => void
  onEdit: (i: Billetera) => void; onToggle: (i: Billetera) => void
}) {
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const isOpen = openMenu === item.id
  useEffect(() => {
    if (!isOpen || !btnRef.current || !menuRef.current) return
    const r = btnRef.current.getBoundingClientRect()
    const m = menuRef.current
    let top = r.bottom + 4; let left = r.right - m.offsetWidth
    if (top + m.offsetHeight > window.innerHeight) top = r.top - m.offsetHeight - 4
    if (left < 8) left = 8
    m.style.top = `${top}px`; m.style.left = `${left}px`
  }, [isOpen])
  return (
    <>
      <button ref={btnRef} onClick={() => setOpenMenu(isOpen ? null : item.id)} className="rounded p-1 hover:bg-muted transition-colors"><MoreVertical size={16} /></button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpenMenu(null)} />
          <div ref={menuRef} className="fixed z-50 w-44 rounded-lg border border-border bg-card py-1 shadow-lg">
            <button onClick={() => onEdit(item)} className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors"><Pencil size={14} /> Editar</button>
            <div className="my-1 border-t border-border" />
            {item.activo ? (
              <button onClick={() => onToggle(item)} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-muted transition-colors"><Ban size={14} /> Desactivar</button>
            ) : (
              <button onClick={() => onToggle(item)} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-green-600 hover:bg-muted transition-colors"><CheckCircle size={14} /> Activar</button>
            )}
          </div>
        </>
      )}
    </>
  )
}

function FormModal({ title, fields, loading, onClose, onSubmit }: {
  title: string; fields: { name: string; label: string; type?: string; required?: boolean; defaultValue?: string }[]
  loading: boolean; onClose: () => void; onSubmit: (values: Record<string, string>) => void
}) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}; for (const f of fields) init[f.name] = f.defaultValue || ''; return init
  })
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(values) }} className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          {fields.map((f) => (
            <div key={f.name}>
              <label className="mb-1 block text-sm font-medium">{f.label}</label>
              <input type={f.type || 'text'} required={f.required} value={values[f.name] || ''} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
            </div>
          ))}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted transition-colors">Cancelar</button>
          <button type="submit" disabled={loading} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">{loading ? 'Guardando...' : 'Guardar'}</button>
        </div>
      </form>
    </div>
  )
}
