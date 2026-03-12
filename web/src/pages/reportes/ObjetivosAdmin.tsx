import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { MoreVertical, Pencil, Trash2, PlusCircle, X } from 'lucide-react'
import { toast } from 'sonner'
import api from '../../api/client'
import DataTable from '../../components/DataTable'
import { formatDate } from '../../lib/utils'

interface Objetivo {
  id: string
  vendedorId: string | null
  vendedorNombre: string
  tipo: string
  nombre: string
  metrica: string
  valorObjetivo: number
  valorActual: number
  porcentaje: number
  periodoInicio: string
  periodoFin: string
  activo: boolean
}

interface User {
  id: string
  nombre: string
  rol: string
}

const metricaLabels: Record<string, string> = {
  monto_venta: 'Monto venta',
  cantidad_pedidos: 'Cant. pedidos',
  clientes_visitados: 'Clientes visitados',
  cobranza: 'Cobranza',
  mix_productos: 'Mix productos',
}

export default function ObjetivosAdmin() {
  const queryClient = useQueryClient()
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [editItem, setEditItem] = useState<Objetivo | null>(null)

  const { data: objetivos = [], isLoading } = useQuery({
    queryKey: ['objetivos-admin'],
    queryFn: async () => {
      const { data: res } = await api.get('/admin/reportes/objetivos')
      return res.data as Objetivo[]
    },
  })

  const { data: vendedores = [] } = useQuery({
    queryKey: ['vendedores-list'],
    queryFn: async () => {
      const { data: res } = await api.get('/admin/users?limit=200')
      const users = (res.data || []) as User[]
      return users.filter((u) => ['vendedor', 'supervisor'].includes(u.rol))
    },
  })

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post('/admin/objetivos', body),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['objetivos-admin'] }); toast.success('Objetivo creado'); setShowCreate(false) },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Error al crear'),
  })

  const editMutation = useMutation({
    mutationFn: ({ id, ...body }: Record<string, unknown> & { id: string }) => api.put(`/admin/objetivos/${id}`, body),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['objetivos-admin'] }); toast.success('Objetivo actualizado'); setEditItem(null) },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Error al editar'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/objetivos/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['objetivos-admin'] }); toast.success('Objetivo eliminado') },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Error'),
  })

  const columns: ColumnDef<Objetivo, unknown>[] = [
    { accessorKey: 'nombre', header: 'Nombre', cell: ({ row }) => <span className="font-medium">{row.original.nombre}</span> },
    {
      accessorKey: 'tipo', header: 'Tipo',
      cell: ({ row }) => (
        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${row.original.tipo === 'general' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'}`}>
          {row.original.tipo}
        </span>
      ),
    },
    { accessorKey: 'metrica', header: 'Metrica', cell: ({ row }) => metricaLabels[row.original.metrica] || row.original.metrica },
    { accessorKey: 'vendedorNombre', header: 'Vendedor' },
    { accessorKey: 'valorObjetivo', header: 'Objetivo', cell: ({ row }) => row.original.valorObjetivo.toLocaleString() },
    { accessorKey: 'valorActual', header: 'Actual', cell: ({ row }) => row.original.valorActual.toLocaleString() },
    {
      accessorKey: 'porcentaje', header: '%',
      cell: ({ row }) => {
        const p = row.original.porcentaje
        const color = p >= 100 ? 'text-success' : p >= 50 ? 'text-warning' : 'text-destructive'
        return <span className={`font-medium ${color}`}>{p}%</span>
      },
    },
    { accessorKey: 'periodoFin', header: 'Periodo', cell: ({ row }) => `${formatDate(row.original.periodoInicio)} - ${formatDate(row.original.periodoFin)}` },
    {
      id: 'actions', header: '',
      cell: ({ row }) => (
        <RowActions item={row.original} openMenu={openMenu} setOpenMenu={setOpenMenu}
          onEdit={(i) => { setEditItem(i); setOpenMenu(null) }}
          onDelete={(i) => { deleteMutation.mutate(i.id); setOpenMenu(null) }}
        />
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Administrar Objetivos</h1>
          <p className="text-sm text-muted-foreground">{objetivos.length} objetivos</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
          <PlusCircle size={16} /> Crear Objetivo
        </button>
      </div>

      <DataTable data={objetivos} columns={columns} searchPlaceholder="Buscar objetivo..." loading={isLoading} pageSize={20} />

      {showCreate && (
        <ObjetivoModal title="Crear Objetivo" vendedores={vendedores} onClose={() => setShowCreate(false)}
          onSubmit={(v) => createMutation.mutate(v)} loading={createMutation.isPending}
        />
      )}
      {editItem && (
        <ObjetivoModal title={`Editar: ${editItem.nombre}`} vendedores={vendedores} initial={editItem}
          onClose={() => setEditItem(null)} onSubmit={(v) => editMutation.mutate({ id: editItem.id, ...v })}
          loading={editMutation.isPending}
        />
      )}
    </div>
  )
}

function RowActions({ item, openMenu, setOpenMenu, onEdit, onDelete }: {
  item: Objetivo; openMenu: string | null; setOpenMenu: (id: string | null) => void
  onEdit: (i: Objetivo) => void; onDelete: (i: Objetivo) => void
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
            <button onClick={() => onDelete(item)} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-muted transition-colors"><Trash2 size={14} /> Eliminar</button>
          </div>
        </>
      )}
    </>
  )
}

function ObjetivoModal({ title, vendedores, initial, loading, onClose, onSubmit }: {
  title: string; vendedores: User[]; initial?: Objetivo; loading: boolean
  onClose: () => void; onSubmit: (values: Record<string, unknown>) => void
}) {
  const [vendedorId, setVendedorId] = useState(initial?.vendedorId || '')
  const [tipo, setTipo] = useState(initial?.tipo || 'general')
  const [nombre, setNombre] = useState(initial?.nombre || '')
  const [metrica, setMetrica] = useState(initial?.metrica || 'monto_venta')
  const [valorObjetivo, setValorObjetivo] = useState(initial ? String(initial.valorObjetivo) : '')
  const [periodoInicio, setPeriodoInicio] = useState(initial ? initial.periodoInicio.slice(0, 10) : '')
  const [periodoFin, setPeriodoFin] = useState(initial ? initial.periodoFin.slice(0, 10) : '')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form onSubmit={(e) => { e.preventDefault(); onSubmit({ vendedorId: vendedorId || null, tipo, nombre, metrica, valorObjetivo, periodoInicio, periodoFin }) }}
        className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium">Nombre</label>
            <input required value={nombre} onChange={(e) => setNombre(e.target.value)} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Tipo</label>
              <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring">
                <option value="general">General</option>
                <option value="focal">Focal</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Metrica</label>
              <select value={metrica} onChange={(e) => setMetrica(e.target.value)} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring">
                <option value="monto_venta">Monto venta</option>
                <option value="cantidad_pedidos">Cant. pedidos</option>
                <option value="clientes_visitados">Clientes visitados</option>
                <option value="cobranza">Cobranza</option>
                <option value="mix_productos">Mix productos</option>
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Vendedor (vacio = todos)</label>
            <select value={vendedorId} onChange={(e) => setVendedorId(e.target.value)} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring">
              <option value="">Todos los vendedores</option>
              {vendedores.map((v) => <option key={v.id} value={v.id}>{v.nombre} ({v.rol})</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Valor objetivo</label>
            <input type="number" step="0.01" required value={valorObjetivo} onChange={(e) => setValorObjetivo(e.target.value)} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Periodo inicio</label>
              <input type="date" required value={periodoInicio} onChange={(e) => setPeriodoInicio(e.target.value)} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Periodo fin</label>
              <input type="date" required value={periodoFin} onChange={(e) => setPeriodoFin(e.target.value)} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
            </div>
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
