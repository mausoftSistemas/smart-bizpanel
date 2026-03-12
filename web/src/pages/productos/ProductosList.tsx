import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createColumnHelper } from '@tanstack/react-table'
import { Plus, Pencil, Power, X, Loader2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import api from '../../api/client'
import DataTable from '../../components/DataTable'
import { formatCurrency, cn } from '../../lib/utils'

interface Producto {
  id: string
  codigo: string
  nombre: string
  precioLista: number
  categoria: string | null
  marca: string | null
  unidadMedida: string | null
  stockUnidad: number | null
  stockBulto: number | null
  activo: boolean
}

const col = createColumnHelper<Producto>()

export default function ProductosList() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Producto | null>(null)
  const [form, setForm] = useState({
    codigo: '', nombre: '', precioLista: '', categoria: '', marca: '',
    unidadMedida: '', stockUnidad: '', stockBulto: '',
  })

  const { data, isLoading } = useQuery({
    queryKey: ['productos'],
    queryFn: async () => {
      const { data: res } = await api.get('/productos?limit=1000')
      return res.data as Producto[]
    },
  })

  const saveMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      if (editing) return api.put(`/productos/${editing.id}`, body)
      return api.post('/productos', body)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productos'] })
      toast.success(editing ? 'Producto actualizado' : 'Producto creado')
      closeForm()
    },
    onError: () => toast.error('Error al guardar'),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, activo }: { id: string; activo: boolean }) =>
      api.put(`/productos/${id}`, { activo }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productos'] })
      toast.success('Estado actualizado')
    },
    onError: () => toast.error('Error al actualizar'),
  })

  const openEdit = (p: Producto) => {
    setEditing(p)
    setForm({
      codigo: p.codigo,
      nombre: p.nombre,
      precioLista: String(p.precioLista),
      categoria: p.categoria || '',
      marca: p.marca || '',
      unidadMedida: p.unidadMedida || '',
      stockUnidad: p.stockUnidad != null ? String(p.stockUnidad) : '',
      stockBulto: p.stockBulto != null ? String(p.stockBulto) : '',
    })
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditing(null)
    setForm({ codigo: '', nombre: '', precioLista: '', categoria: '', marca: '', unidadMedida: '', stockUnidad: '', stockBulto: '' })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    saveMutation.mutate({
      codigo: form.codigo,
      nombre: form.nombre,
      precioLista: parseFloat(form.precioLista),
      categoria: form.categoria || null,
      marca: form.marca || null,
      unidadMedida: form.unidadMedida || null,
      stockUnidad: form.stockUnidad ? parseInt(form.stockUnidad) : null,
      stockBulto: form.stockBulto ? parseInt(form.stockBulto) : null,
    })
  }

  const columns = [
    col.accessor('codigo', { header: 'Código', cell: (info) => <span className="font-mono text-xs">{info.getValue()}</span> }),
    col.accessor('nombre', { header: 'Nombre' }),
    col.accessor('categoria', { header: 'Categoría', cell: (info) => info.getValue() || '—' }),
    col.accessor('precioLista', {
      header: 'Precio',
      cell: (info) => <span className="font-medium">{formatCurrency(Number(info.getValue()))}</span>,
    }),
    col.accessor('stockUnidad', {
      header: 'Stock',
      cell: (info) => {
        const v = info.getValue()
        if (v == null) return '—'
        return <span className={cn(v <= 0 ? 'text-destructive font-medium' : '')}>{v}</span>
      },
    }),
    col.accessor('activo', {
      header: 'Estado',
      cell: (info) => (
        <span className={cn(
          'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
          info.getValue() ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground',
        )}>
          {info.getValue() ? 'Activo' : 'Inactivo'}
        </span>
      ),
    }),
    col.display({
      id: 'actions',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <button onClick={() => openEdit(row.original)} className="rounded p-1 hover:bg-muted" title="Editar">
            <Pencil size={14} />
          </button>
          <button
            onClick={() => toggleMutation.mutate({ id: row.original.id, activo: !row.original.activo })}
            className={cn('rounded p-1 hover:bg-muted', row.original.activo ? 'text-muted-foreground' : 'text-success')}
            title={row.original.activo ? 'Desactivar' : 'Activar'}
          >
            <Power size={14} />
          </button>
        </div>
      ),
    }),
  ]

  const inputCls = 'h-9 rounded-lg border border-input px-3 text-sm outline-none focus:ring-2 focus:ring-ring'

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
            <input required placeholder="Código *" value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} className={inputCls} />
            <input required placeholder="Nombre *" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className={cn(inputCls, 'sm:col-span-2')} />
            <input required type="number" step="0.01" placeholder="Precio lista *" value={form.precioLista} onChange={(e) => setForm({ ...form, precioLista: e.target.value })} className={inputCls} />
            <input placeholder="Categoría" value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} className={inputCls} />
            <input placeholder="Marca" value={form.marca} onChange={(e) => setForm({ ...form, marca: e.target.value })} className={inputCls} />
            <input placeholder="Unidad de medida" value={form.unidadMedida} onChange={(e) => setForm({ ...form, unidadMedida: e.target.value })} className={inputCls} />
            <input type="number" placeholder="Stock unidades" value={form.stockUnidad} onChange={(e) => setForm({ ...form, stockUnidad: e.target.value })} className={inputCls} />
            <input type="number" placeholder="Stock bultos" value={form.stockBulto} onChange={(e) => setForm({ ...form, stockBulto: e.target.value })} className={inputCls} />
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
        columns={columns}
        searchPlaceholder="Buscar productos..."
        loading={isLoading}
        actions={
          <div className="flex gap-2">
            <button onClick={() => navigate('/importar')} className="flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted">
              <Upload size={16} /> Importar
            </button>
            <button onClick={() => { closeForm(); setShowForm(true) }} className="flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              <Plus size={16} /> Nuevo
            </button>
          </div>
        }
      />
    </div>
  )
}
