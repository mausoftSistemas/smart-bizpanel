import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { MoreVertical, Pencil, Ban, CheckCircle, PlusCircle, X } from 'lucide-react'
import { toast } from 'sonner'
import api from '../../api/client'
import DataTable from '../../components/DataTable'

interface Denominacion {
  id: string
  tipo: string
  valor: number
  moneda: string
  activo: boolean
}

export default function DenominacionesList() {
  const queryClient = useQueryClient()
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [editItem, setEditItem] = useState<Denominacion | null>(null)

  const { data = [], isLoading } = useQuery({
    queryKey: ['denominaciones'],
    queryFn: async () => {
      const { data: res } = await api.get('/admin/denominaciones')
      return res.data as Denominacion[]
    },
  })

  const createMutation = useMutation({
    mutationFn: (body: { tipo: string; valor: number; moneda: string }) => api.post('/admin/denominaciones', body),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['denominaciones'] }); toast.success('Denominacion creada'); setShowCreate(false) },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Error al crear'),
  })

  const editMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: string; tipo?: string; valor?: number; moneda?: string }) => api.put(`/admin/denominaciones/${id}`, body),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['denominaciones'] }); toast.success('Denominacion actualizada'); setEditItem(null) },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Error al editar'),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, activo }: { id: string; activo: boolean }) =>
      activo ? api.put(`/admin/denominaciones/${id}`, { activo: true }) : api.delete(`/admin/denominaciones/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['denominaciones'] }); toast.success('Estado actualizado') },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Error'),
  })

  const columns: ColumnDef<Denominacion, unknown>[] = [
    {
      accessorKey: 'tipo', header: 'Tipo',
      cell: ({ row }) => (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${row.original.tipo === 'billete' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>
          {row.original.tipo}
        </span>
      ),
    },
    { accessorKey: 'valor', header: 'Valor', cell: ({ row }) => <span className="font-medium">${row.original.valor}</span> },
    { accessorKey: 'moneda', header: 'Moneda' },
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
          <h1 className="text-2xl font-bold">Denominaciones</h1>
          <p className="text-sm text-muted-foreground">{data.length} denominaciones (para arqueo de caja)</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
          <PlusCircle size={16} /> Nueva Denominacion
        </button>
      </div>

      <DataTable data={data} columns={columns} searchPlaceholder="Buscar denominacion..." loading={isLoading} pageSize={20} />

      {showCreate && (
        <CreateModal onClose={() => setShowCreate(false)} onSubmit={(v) => createMutation.mutate(v)} loading={createMutation.isPending} />
      )}
      {editItem && (
        <EditModal item={editItem} onClose={() => setEditItem(null)}
          onSubmit={(v) => editMutation.mutate({ id: editItem.id, ...v })} loading={editMutation.isPending}
        />
      )}
    </div>
  )
}

function CreateModal({ onClose, onSubmit, loading }: { onClose: () => void; onSubmit: (v: { tipo: string; valor: number; moneda: string }) => void; loading: boolean }) {
  const [tipo, setTipo] = useState('billete')
  const [valor, setValor] = useState('')
  const [moneda, setMoneda] = useState('ARS')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form onSubmit={(e) => { e.preventDefault(); onSubmit({ tipo, valor: Number(valor), moneda }) }} className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Crear Denominacion</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium">Tipo</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring">
              <option value="billete">Billete</option>
              <option value="moneda">Moneda</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Valor</label>
            <input type="number" step="0.01" required value={valor} onChange={(e) => setValor(e.target.value)} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Moneda</label>
            <select value={moneda} onChange={(e) => setMoneda(e.target.value)} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring">
              <option value="ARS">ARS</option>
              <option value="USD">USD</option>
            </select>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted transition-colors">Cancelar</button>
          <button type="submit" disabled={loading} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">{loading ? 'Guardando...' : 'Guardar'}</button>
        </div>
      </form>
    </div>
  )
}

function EditModal({ item, onClose, onSubmit, loading }: { item: Denominacion; onClose: () => void; onSubmit: (v: { tipo: string; valor: number; moneda: string }) => void; loading: boolean }) {
  const [tipo, setTipo] = useState(item.tipo)
  const [valor, setValor] = useState(String(item.valor))
  const [moneda, setMoneda] = useState(item.moneda)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form onSubmit={(e) => { e.preventDefault(); onSubmit({ tipo, valor: Number(valor), moneda }) }} className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Editar Denominacion</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium">Tipo</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring">
              <option value="billete">Billete</option>
              <option value="moneda">Moneda</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Valor</label>
            <input type="number" step="0.01" required value={valor} onChange={(e) => setValor(e.target.value)} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Moneda</label>
            <select value={moneda} onChange={(e) => setMoneda(e.target.value)} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring">
              <option value="ARS">ARS</option>
              <option value="USD">USD</option>
            </select>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted transition-colors">Cancelar</button>
          <button type="submit" disabled={loading} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">{loading ? 'Guardando...' : 'Guardar'}</button>
        </div>
      </form>
    </div>
  )
}

function RowActions({ item, openMenu, setOpenMenu, onEdit, onToggle }: {
  item: Denominacion; openMenu: string | null; setOpenMenu: (id: string | null) => void
  onEdit: (i: Denominacion) => void; onToggle: (i: Denominacion) => void
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
