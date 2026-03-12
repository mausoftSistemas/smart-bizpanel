import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createColumnHelper } from '@tanstack/react-table'
import { Plus, Upload, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import api from '../../api/client'
import DataTable from '../../components/DataTable'
import { formatCurrency, formatDate } from '../../lib/utils'

interface Factura {
  id: string
  tipo: string
  numero: string
  fecha: string
  monto: number
  saldo: number
  vencimiento: string | null
  cliente: { razonSocial: string; codigoErp: string }
}

const col = createColumnHelper<Factura>()

const columns = [
  col.accessor('tipo', {
    header: 'Tipo',
    cell: (info) => (
      <span className="uppercase text-xs font-medium">{info.getValue()}</span>
    ),
  }),
  col.accessor('numero', { header: 'Número' }),
  col.accessor('fecha', { header: 'Fecha', cell: (info) => formatDate(info.getValue()) }),
  col.accessor('cliente.razonSocial', { header: 'Cliente' }),
  col.accessor('monto', { header: 'Monto', cell: (info) => formatCurrency(info.getValue()) }),
  col.accessor('saldo', { header: 'Saldo', cell: (info) => formatCurrency(info.getValue()) }),
  col.accessor('vencimiento', { header: 'Vencimiento', cell: (info) => info.getValue() ? formatDate(info.getValue()!) : '—' }),
]

export default function FacturasCrud() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ codigoCliente: '', tipo: 'factura', numero: '', fecha: '', monto: '', saldo: '', vencimiento: '' })

  const { data, isLoading } = useQuery({
    queryKey: ['facturas'],
    queryFn: async () => {
      try {
        const { data: res } = await api.get('/admin/cuenta-corriente?limit=500')
        return res.data as Factura[]
      } catch {
        return []
      }
    },
  })

  const saveMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post('/admin/cuenta-corriente', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facturas'] })
      toast.success('Comprobante creado')
      setShowForm(false)
      setForm({ codigoCliente: '', tipo: 'factura', numero: '', fecha: '', monto: '', saldo: '', vencimiento: '' })
    },
    onError: () => toast.error('Error al guardar'),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    saveMutation.mutate({
      codigoCliente: form.codigoCliente,
      tipo: form.tipo,
      numero: form.numero,
      fecha: form.fecha,
      monto: parseFloat(form.monto),
      saldo: form.saldo ? parseFloat(form.saldo) : parseFloat(form.monto),
      vencimiento: form.vencimiento || null,
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Facturas / Cuenta Corriente</h1>
          <p className="text-sm text-muted-foreground">Cargar comprobantes para la cuenta corriente de clientes</p>
        </div>
      </div>

      {showForm && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Nuevo comprobante</h2>
            <button onClick={() => setShowForm(false)} className="rounded p-1 hover:bg-muted"><X size={16} /></button>
          </div>
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-3">
            <input required placeholder="Código cliente" value={form.codigoCliente} onChange={(e) => setForm({ ...form, codigoCliente: e.target.value })} className="h-9 rounded-lg border border-input px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
            <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} className="h-9 rounded-lg border border-input px-3 text-sm outline-none focus:ring-2 focus:ring-ring">
              <option value="factura">Factura</option>
              <option value="nc">Nota de crédito</option>
              <option value="nd">Nota de débito</option>
              <option value="recibo">Recibo</option>
            </select>
            <input required placeholder="Número" value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} className="h-9 rounded-lg border border-input px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
            <input required type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} className="h-9 rounded-lg border border-input px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
            <input required type="number" step="0.01" placeholder="Monto" value={form.monto} onChange={(e) => setForm({ ...form, monto: e.target.value })} className="h-9 rounded-lg border border-input px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
            <input type="number" step="0.01" placeholder="Saldo (default=monto)" value={form.saldo} onChange={(e) => setForm({ ...form, saldo: e.target.value })} className="h-9 rounded-lg border border-input px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
            <input type="date" placeholder="Vencimiento" value={form.vencimiento} onChange={(e) => setForm({ ...form, vencimiento: e.target.value })} className="h-9 rounded-lg border border-input px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
            <div className="sm:col-span-3">
              <button type="submit" disabled={saveMutation.isPending} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                {saveMutation.isPending && <Loader2 size={14} className="animate-spin" />}
                Crear comprobante
              </button>
            </div>
          </form>
        </div>
      )}

      <DataTable
        data={data || []}
        columns={columns}
        searchPlaceholder="Buscar comprobantes..."
        loading={isLoading}
        actions={
          <div className="flex gap-2">
            <button onClick={() => navigate('/importar')} className="flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted">
              <Upload size={16} /> Importar
            </button>
            <button onClick={() => setShowForm(true)} className="flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              <Plus size={16} /> Nuevo
            </button>
          </div>
        }
      />
    </div>
  )
}
