import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createColumnHelper } from '@tanstack/react-table'
import { Plus, Pencil, Power, X, Loader2, Upload, Eye } from 'lucide-react'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import api from '../../api/client'
import DataTable from '../../components/DataTable'
import { formatCurrency, cn } from '../../lib/utils'

interface Cliente {
  id: string
  codigo: string
  nombre: string
  cuit: string | null
  saldoCuenta: number
  limiteCredito: number | null
  ciudad: string | null
  provincia: string | null
  telefono: string | null
  email: string | null
  condicionIva: string | null
  condicionVenta: string | null
  direccion: string | null
  vendedorId: string | null
  segmento: string | null
  activo: boolean
  vendedor?: { nombre: string } | null
}

const col = createColumnHelper<Cliente>()

export default function ClientesList() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Cliente | null>(null)
  const [detail, setDetail] = useState<Cliente | null>(null)
  const [form, setForm] = useState({
    codigo: '', nombre: '', cuit: '', direccion: '', ciudad: '', provincia: '',
    telefono: '', email: '', condicionIva: '', condicionVenta: '', limiteCredito: '',
  })

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

  const toggleMutation = useMutation({
    mutationFn: ({ id, activo }: { id: string; activo: boolean }) =>
      api.put(`/clientes/${id}`, { activo }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] })
      toast.success('Estado actualizado')
    },
    onError: () => toast.error('Error al actualizar'),
  })

  const openEdit = (c: Cliente) => {
    setEditing(c)
    setForm({
      codigo: c.codigo,
      nombre: c.nombre,
      cuit: c.cuit || '',
      direccion: c.direccion || '',
      ciudad: c.ciudad || '',
      provincia: c.provincia || '',
      telefono: c.telefono || '',
      email: c.email || '',
      condicionIva: c.condicionIva || '',
      condicionVenta: c.condicionVenta || '',
      limiteCredito: c.limiteCredito != null ? String(c.limiteCredito) : '',
    })
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditing(null)
    setForm({ codigo: '', nombre: '', cuit: '', direccion: '', ciudad: '', provincia: '', telefono: '', email: '', condicionIva: '', condicionVenta: '', limiteCredito: '' })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    saveMutation.mutate({
      codigo: form.codigo,
      nombre: form.nombre,
      cuit: form.cuit || null,
      direccion: form.direccion || null,
      ciudad: form.ciudad || null,
      provincia: form.provincia || null,
      telefono: form.telefono || null,
      email: form.email || null,
      condicionIva: form.condicionIva || null,
      condicionVenta: form.condicionVenta || null,
      limiteCredito: form.limiteCredito ? parseFloat(form.limiteCredito) : null,
    })
  }

  const columns = [
    col.accessor('codigo', { header: 'Código', cell: (info) => <span className="font-mono text-xs">{info.getValue()}</span> }),
    col.accessor('nombre', { header: 'Nombre' }),
    col.accessor('cuit', { header: 'CUIT', cell: (info) => info.getValue() || '—' }),
    col.accessor('saldoCuenta', {
      header: 'Saldo',
      cell: (info) => {
        const saldo = Number(info.getValue()) || 0
        return (
          <span className={cn('font-medium', saldo > 0 ? 'text-destructive' : 'text-success')}>
            {formatCurrency(saldo)}
          </span>
        )
      },
    }),
    col.accessor('limiteCredito', {
      header: 'Límite',
      cell: (info) => info.getValue() != null ? formatCurrency(Number(info.getValue())) : '—',
    }),
    col.accessor('segmento', { header: 'Segmento', cell: (info) => info.getValue() || '—' }),
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
          <button onClick={() => setDetail(row.original)} className="rounded p-1 hover:bg-muted" title="Ver detalle">
            <Eye size={14} />
          </button>
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
          <h1 className="text-2xl font-bold">Clientes</h1>
          <p className="text-sm text-muted-foreground">Gestión de la cartera de clientes</p>
        </div>
      </div>

      {/* Detalle */}
      {detail && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">{detail.nombre} <span className="text-sm text-muted-foreground">({detail.codigo})</span></h2>
            <button onClick={() => setDetail(null)} className="text-sm text-muted-foreground hover:text-foreground">Cerrar</button>
          </div>
          <div className="grid gap-3 text-sm sm:grid-cols-3">
            <div><span className="text-muted-foreground">CUIT:</span> {detail.cuit || '—'}</div>
            <div><span className="text-muted-foreground">Teléfono:</span> {detail.telefono || '—'}</div>
            <div><span className="text-muted-foreground">Email:</span> {detail.email || '—'}</div>
            <div><span className="text-muted-foreground">Dirección:</span> {detail.direccion || '—'}</div>
            <div><span className="text-muted-foreground">Ciudad:</span> {detail.ciudad || '—'}</div>
            <div><span className="text-muted-foreground">Provincia:</span> {detail.provincia || '—'}</div>
            <div><span className="text-muted-foreground">Cond. IVA:</span> {detail.condicionIva || '—'}</div>
            <div><span className="text-muted-foreground">Cond. Venta:</span> {detail.condicionVenta || '—'}</div>
            <div><span className="text-muted-foreground">Segmento:</span> {detail.segmento || '—'}</div>
            <div>
              <span className="text-muted-foreground">Saldo: </span>
              <span className={cn('font-medium', Number(detail.saldoCuenta) > 0 ? 'text-destructive' : 'text-success')}>
                {formatCurrency(Number(detail.saldoCuenta))}
              </span>
            </div>
            <div><span className="text-muted-foreground">Límite:</span> {detail.limiteCredito != null ? formatCurrency(Number(detail.limiteCredito)) : '—'}</div>
          </div>
          <div className="mt-4">
            <button
              onClick={() => navigate(`/facturas?clienteId=${detail.id}`)}
              className="text-sm text-primary hover:underline"
            >
              Ver cuenta corriente
            </button>
          </div>
        </div>
      )}

      {/* Formulario */}
      {showForm && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">{editing ? 'Editar cliente' : 'Nuevo cliente'}</h2>
            <button onClick={closeForm} className="rounded p-1 hover:bg-muted"><X size={16} /></button>
          </div>
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-3">
            <input required placeholder="Código *" value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} className={inputCls} />
            <input required placeholder="Nombre / Razón Social *" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className={cn(inputCls, 'sm:col-span-2')} />
            <input placeholder="CUIT" value={form.cuit} onChange={(e) => setForm({ ...form, cuit: e.target.value })} className={inputCls} />
            <input placeholder="Dirección" value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} className={cn(inputCls, 'sm:col-span-2')} />
            <input placeholder="Ciudad" value={form.ciudad} onChange={(e) => setForm({ ...form, ciudad: e.target.value })} className={inputCls} />
            <input placeholder="Provincia" value={form.provincia} onChange={(e) => setForm({ ...form, provincia: e.target.value })} className={inputCls} />
            <input placeholder="Teléfono" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} className={inputCls} />
            <input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls} />
            <input placeholder="Condición IVA" value={form.condicionIva} onChange={(e) => setForm({ ...form, condicionIva: e.target.value })} className={inputCls} />
            <input placeholder="Condición de venta" value={form.condicionVenta} onChange={(e) => setForm({ ...form, condicionVenta: e.target.value })} className={inputCls} />
            <input type="number" step="0.01" placeholder="Límite de crédito" value={form.limiteCredito} onChange={(e) => setForm({ ...form, limiteCredito: e.target.value })} className={inputCls} />
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
        columns={columns}
        searchPlaceholder="Buscar clientes..."
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
