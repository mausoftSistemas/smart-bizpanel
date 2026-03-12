import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { Trash2, PlusCircle, X } from 'lucide-react'
import { toast } from 'sonner'
import api from '../../api/client'
import DataTable from '../../components/DataTable'
import { formatDateTime } from '../../lib/utils'

interface Mensaje {
  id: string
  titulo: string
  cuerpo: string
  tipo: string
  vendedorId: string | null
  vendedorNombre: string
  leido: boolean
  createdAt: string
}

interface User {
  id: string
  nombre: string
  rol: string
}

const tipoBadge: Record<string, string> = {
  info: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  alerta: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  urgente: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

export default function MensajesList() {
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)

  const { data: mensajes = [], isLoading } = useQuery({
    queryKey: ['mensajes-admin'],
    queryFn: async () => {
      const { data: res } = await api.get('/admin/mensajes')
      return res.data as Mensaje[]
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
    mutationFn: (body: Record<string, unknown>) => api.post('/admin/mensajes', body),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['mensajes-admin'] }); toast.success('Mensaje enviado'); setShowCreate(false) },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Error al enviar'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/mensajes/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['mensajes-admin'] }); toast.success('Mensaje eliminado') },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Error'),
  })

  const columns: ColumnDef<Mensaje, unknown>[] = [
    { accessorKey: 'titulo', header: 'Titulo', cell: ({ row }) => <span className="font-medium">{row.original.titulo}</span> },
    {
      accessorKey: 'tipo', header: 'Tipo',
      cell: ({ row }) => (
        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${tipoBadge[row.original.tipo] || 'bg-muted'}`}>
          {row.original.tipo}
        </span>
      ),
    },
    { accessorKey: 'vendedorNombre', header: 'Destinatario' },
    {
      accessorKey: 'cuerpo', header: 'Mensaje',
      cell: ({ row }) => <span className="text-sm text-muted-foreground line-clamp-1">{row.original.cuerpo}</span>,
    },
    { accessorKey: 'createdAt', header: 'Fecha', cell: ({ row }) => <span className="text-xs">{formatDateTime(row.original.createdAt)}</span> },
    {
      id: 'actions', header: '',
      cell: ({ row }) => (
        <button onClick={() => deleteMutation.mutate(row.original.id)} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive transition-colors" title="Eliminar">
          <Trash2 size={14} />
        </button>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mensajes</h1>
          <p className="text-sm text-muted-foreground">{mensajes.length} mensajes enviados</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
          <PlusCircle size={16} /> Nuevo Mensaje
        </button>
      </div>

      <DataTable data={mensajes} columns={columns} searchPlaceholder="Buscar mensaje..." loading={isLoading} pageSize={20} />

      {showCreate && (
        <MensajeModal vendedores={vendedores} onClose={() => setShowCreate(false)}
          onSubmit={(v) => createMutation.mutate(v)} loading={createMutation.isPending}
        />
      )}
    </div>
  )
}

function MensajeModal({ vendedores, loading, onClose, onSubmit }: {
  vendedores: User[]; loading: boolean; onClose: () => void; onSubmit: (v: Record<string, unknown>) => void
}) {
  const [vendedorId, setVendedorId] = useState('')
  const [titulo, setTitulo] = useState('')
  const [cuerpo, setCuerpo] = useState('')
  const [tipo, setTipo] = useState('info')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form onSubmit={(e) => { e.preventDefault(); onSubmit({ vendedorId: vendedorId || null, titulo, cuerpo, tipo }) }}
        className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Nuevo Mensaje</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium">Titulo</label>
            <input required value={titulo} onChange={(e) => setTitulo(e.target.value)} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Mensaje</label>
            <textarea required rows={3} value={cuerpo} onChange={(e) => setCuerpo(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring resize-none" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Tipo</label>
              <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring">
                <option value="info">Info</option>
                <option value="alerta">Alerta</option>
                <option value="urgente">Urgente</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Destinatario</label>
              <select value={vendedorId} onChange={(e) => setVendedorId(e.target.value)} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring">
                <option value="">Todos los vendedores</option>
                {vendedores.map((v) => <option key={v.id} value={v.id}>{v.nombre}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted transition-colors">Cancelar</button>
          <button type="submit" disabled={loading} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">{loading ? 'Enviando...' : 'Enviar'}</button>
        </div>
      </form>
    </div>
  )
}
