import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { MoreVertical, Pencil, Ban, CheckCircle, PlusCircle, X } from 'lucide-react'
import { toast } from 'sonner'
import api from '../../api/client'
import DataTable from '../../components/DataTable'

interface CondicionVenta {
  id: string
  codigo: string
  nombre: string
  diasPlazo: number
  recargo: number
  bonificacion: number
  contado: number
  activo: boolean
}

export default function CondicionesVentaList() {
  const queryClient = useQueryClient()
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [editItem, setEditItem] = useState<CondicionVenta | null>(null)

  const { data = [], isLoading } = useQuery({
    queryKey: ['condiciones-venta'],
    queryFn: async () => {
      const { data: res } = await api.get('/admin/condiciones-venta')
      return res.data as CondicionVenta[]
    },
  })

  const createMutation = useMutation({
    mutationFn: (body: Partial<CondicionVenta>) => api.post('/admin/condiciones-venta', body),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['condiciones-venta'] }); toast.success('Condicion creada'); setShowCreate(false) },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Error al crear'),
  })

  const editMutation = useMutation({
    mutationFn: ({ id, ...body }: Partial<CondicionVenta> & { id: string }) => api.put(`/admin/condiciones-venta/${id}`, body),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['condiciones-venta'] }); toast.success('Condicion actualizada'); setEditItem(null) },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Error al editar'),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, activo }: { id: string; activo: boolean }) =>
      activo ? api.put(`/admin/condiciones-venta/${id}`, { activo: true }) : api.delete(`/admin/condiciones-venta/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['condiciones-venta'] }); toast.success('Estado actualizado') },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Error'),
  })

  const columns: ColumnDef<CondicionVenta, unknown>[] = [
    { accessorKey: 'codigo', header: 'Codigo', cell: ({ row }) => <span className="font-mono text-xs">{row.original.codigo}</span> },
    { accessorKey: 'nombre', header: 'Nombre', cell: ({ row }) => <span className="font-medium">{row.original.nombre}</span> },
    { accessorKey: 'diasPlazo', header: 'Dias plazo' },
    { accessorKey: 'recargo', header: 'Recargo %', cell: ({ row }) => `${row.original.recargo}%` },
    { accessorKey: 'bonificacion', header: 'Bonif. %', cell: ({ row }) => `${row.original.bonificacion}%` },
    { accessorKey: 'contado', header: 'Contado %', cell: ({ row }) => `${row.original.contado}%` },
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
          <h1 className="text-2xl font-bold">Condiciones de Venta</h1>
          <p className="text-sm text-muted-foreground">{data.length} condiciones</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
          <PlusCircle size={16} /> Nueva Condicion
        </button>
      </div>

      <DataTable data={data} columns={columns} searchPlaceholder="Buscar condicion..." loading={isLoading} pageSize={20} />

      {showCreate && (
        <CrudModal title="Crear Condicion de Venta" onClose={() => setShowCreate(false)}
          onSubmit={(v) => createMutation.mutate({ codigo: v.codigo, nombre: v.nombre, diasPlazo: Number(v.diasPlazo) || 0, recargo: Number(v.recargo) || 0, bonificacion: Number(v.bonificacion) || 0, contado: Number(v.contado) || 0 })}
          loading={createMutation.isPending}
          fields={[
            { name: 'codigo', label: 'Codigo', required: true },
            { name: 'nombre', label: 'Nombre', required: true },
            { name: 'diasPlazo', label: 'Dias plazo', type: 'number' },
            { name: 'recargo', label: 'Recargo %', type: 'number' },
            { name: 'bonificacion', label: 'Bonificacion %', type: 'number' },
            { name: 'contado', label: 'Contado %', type: 'number' },
          ]}
        />
      )}
      {editItem && (
        <CrudModal title={`Editar: ${editItem.nombre}`} onClose={() => setEditItem(null)}
          onSubmit={(v) => editMutation.mutate({ id: editItem.id, codigo: v.codigo, nombre: v.nombre, diasPlazo: Number(v.diasPlazo) || 0, recargo: Number(v.recargo) || 0, bonificacion: Number(v.bonificacion) || 0, contado: Number(v.contado) || 0 })}
          loading={editMutation.isPending}
          fields={[
            { name: 'codigo', label: 'Codigo', required: true, defaultValue: editItem.codigo },
            { name: 'nombre', label: 'Nombre', required: true, defaultValue: editItem.nombre },
            { name: 'diasPlazo', label: 'Dias plazo', type: 'number', defaultValue: String(editItem.diasPlazo) },
            { name: 'recargo', label: 'Recargo %', type: 'number', defaultValue: String(editItem.recargo) },
            { name: 'bonificacion', label: 'Bonificacion %', type: 'number', defaultValue: String(editItem.bonificacion) },
            { name: 'contado', label: 'Contado %', type: 'number', defaultValue: String(editItem.contado) },
          ]}
        />
      )}
    </div>
  )
}

// ─── Row Actions ───
function RowActions({ item, openMenu, setOpenMenu, onEdit, onToggle }: {
  item: CondicionVenta; openMenu: string | null; setOpenMenu: (id: string | null) => void
  onEdit: (i: CondicionVenta) => void; onToggle: (i: CondicionVenta) => void
}) {
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const isOpen = openMenu === item.id

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
      <button ref={btnRef} onClick={() => setOpenMenu(isOpen ? null : item.id)} className="rounded p-1 hover:bg-muted transition-colors">
        <MoreVertical size={16} />
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpenMenu(null)} />
          <div ref={menuRef} className="fixed z-50 w-44 rounded-lg border border-border bg-card py-1 shadow-lg">
            <button onClick={() => onEdit(item)} className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors">
              <Pencil size={14} /> Editar
            </button>
            <div className="my-1 border-t border-border" />
            {item.activo ? (
              <button onClick={() => onToggle(item)} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-muted transition-colors">
                <Ban size={14} /> Desactivar
              </button>
            ) : (
              <button onClick={() => onToggle(item)} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-green-600 hover:bg-muted transition-colors">
                <CheckCircle size={14} /> Activar
              </button>
            )}
          </div>
        </>
      )}
    </>
  )
}

// ─── Modal CRUD ───
function CrudModal({ title, fields, loading, onClose, onSubmit }: {
  title: string
  fields: { name: string; label: string; type?: string; required?: boolean; defaultValue?: string }[]
  loading: boolean; onClose: () => void; onSubmit: (values: Record<string, string>) => void
}) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const f of fields) init[f.name] = f.defaultValue || ''
    return init
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
          <button type="submit" disabled={loading} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
            {loading ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </form>
    </div>
  )
}
