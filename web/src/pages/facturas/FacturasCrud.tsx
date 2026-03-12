import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createColumnHelper } from '@tanstack/react-table'
import { Plus, Upload, X, Loader2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../../api/client'
import DataTable from '../../components/DataTable'
import { formatCurrency, formatDate, cn } from '../../lib/utils'

interface Cliente {
  id: string
  codigo: string
  nombre: string
  saldoCuenta: number
  limiteCredito: number | null
}

interface Movimiento {
  id: string
  tipoMovimiento: string
  numero: string
  fecha: string
  fechaVencimiento: string | null
  debe: number
  haber: number
  saldo: number
  estado: string | null
  cliente: { nombre: string; codigo: string }
}

const col = createColumnHelper<Movimiento & { saldoProgresivo: number }>()

const tipoLabels: Record<string, string> = {
  factura: 'FA',
  nota_credito: 'NC',
  nota_debito: 'ND',
  recibo: 'RC',
  nc: 'NC',
  nd: 'ND',
}

const tipoColors: Record<string, string> = {
  factura: 'bg-destructive/10 text-destructive',
  nota_debito: 'bg-destructive/10 text-destructive',
  nd: 'bg-destructive/10 text-destructive',
  nota_credito: 'bg-success/10 text-success',
  nc: 'bg-success/10 text-success',
  recibo: 'bg-primary/10 text-primary',
}

export default function FacturasCrud() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const initialClienteId = searchParams.get('clienteId') || ''

  const [selectedClienteId, setSelectedClienteId] = useState(initialClienteId)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    tipoMovimiento: 'factura', numero: '', fecha: '', fechaVencimiento: '', monto: '',
  })

  // Cargar clientes para el selector
  const { data: clientes } = useQuery({
    queryKey: ['clientes-select'],
    queryFn: async () => {
      const { data: res } = await api.get('/clientes?limit=1000')
      return res.data as Cliente[]
    },
  })

  // Cargar movimientos
  const { data: movimientos, isLoading } = useQuery({
    queryKey: ['cuenta-corriente', selectedClienteId],
    queryFn: async () => {
      const url = selectedClienteId
        ? `/admin/cuenta-corriente?clienteId=${selectedClienteId}&limit=500`
        : '/admin/cuenta-corriente?limit=500'
      const { data: res } = await api.get(url)
      return res.data as Movimiento[]
    },
  })

  const selectedCliente = clientes?.find((c) => c.id === selectedClienteId)

  // Calcular saldo progresivo
  const movimientosConSaldo = useMemo(() => {
    if (!movimientos) return []
    // Ordenar por fecha ASC para calcular saldo progresivo
    const sorted = [...movimientos].sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())
    let acum = 0
    const withSaldo = sorted.map((m) => {
      acum += Number(m.debe) - Number(m.haber)
      return { ...m, saldoProgresivo: acum }
    })
    // Devolver en orden DESC (más recientes primero)
    return withSaldo.reverse()
  }, [movimientos])

  // Resumen del cliente
  const resumen = useMemo(() => {
    if (!selectedCliente) return null
    const saldo = Number(selectedCliente.saldoCuenta) || 0
    const limite = Number(selectedCliente.limiteCredito) || 0
    const disponible = limite > 0 ? limite - saldo : 0
    const vencidas = (movimientos || []).filter((m) => {
      if (!m.fechaVencimiento || Number(m.debe) <= 0) return false
      return new Date(m.fechaVencimiento) < new Date()
    }).length
    return { saldo, limite, disponible, vencidas }
  }, [selectedCliente, movimientos])

  const saveMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post('/admin/cuenta-corriente', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cuenta-corriente'] })
      queryClient.invalidateQueries({ queryKey: ['clientes'] })
      queryClient.invalidateQueries({ queryKey: ['clientes-select'] })
      toast.success('Movimiento creado')
      setShowForm(false)
      setForm({ tipoMovimiento: 'factura', numero: '', fecha: '', fechaVencimiento: '', monto: '' })
    },
    onError: () => toast.error('Error al crear movimiento'),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedClienteId) {
      toast.error('Seleccioná un cliente primero')
      return
    }
    saveMutation.mutate({
      clienteId: selectedClienteId,
      tipoMovimiento: form.tipoMovimiento,
      numero: form.numero,
      fecha: form.fecha,
      fechaVencimiento: form.fechaVencimiento || null,
      monto: parseFloat(form.monto),
    })
  }

  const columns = [
    col.accessor('tipoMovimiento', {
      header: 'Tipo',
      cell: (info) => {
        const tipo = info.getValue()
        return (
          <span className={cn('inline-flex rounded px-1.5 py-0.5 text-[10px] font-bold uppercase', tipoColors[tipo] || 'bg-muted')}>
            {tipoLabels[tipo] || tipo}
          </span>
        )
      },
    }),
    col.accessor('numero', { header: 'Número' }),
    col.accessor('fecha', { header: 'Fecha', cell: (info) => formatDate(info.getValue()) }),
    col.accessor('fechaVencimiento', {
      header: 'Vto',
      cell: (info) => {
        const v = info.getValue()
        if (!v) return '—'
        const isVencido = new Date(v) < new Date()
        return <span className={isVencido ? 'text-destructive font-medium' : ''}>{formatDate(v)}</span>
      },
    }),
    ...(!selectedClienteId ? [col.accessor('cliente.nombre' as keyof (Movimiento & { saldoProgresivo: number }), { header: 'Cliente' })] : []),
    col.accessor('debe', {
      header: 'Debe',
      cell: (info) => {
        const v = Number(info.getValue())
        return v > 0 ? <span className="text-destructive font-medium">{formatCurrency(v)}</span> : '—'
      },
    }),
    col.accessor('haber', {
      header: 'Haber',
      cell: (info) => {
        const v = Number(info.getValue())
        return v > 0 ? <span className="text-success font-medium">{formatCurrency(v)}</span> : '—'
      },
    }),
    col.accessor('saldoProgresivo', {
      header: 'Saldo',
      cell: (info) => {
        const v = info.getValue()
        return (
          <span className={cn('font-medium', v > 0 ? 'text-destructive' : v < 0 ? 'text-success' : '')}>
            {formatCurrency(v)}
          </span>
        )
      },
    }),
  ]

  const inputCls = 'h-9 rounded-lg border border-input px-3 text-sm outline-none focus:ring-2 focus:ring-ring'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Facturas / Cuenta Corriente</h1>
          <p className="text-sm text-muted-foreground">Movimientos de cuenta corriente de clientes</p>
        </div>
      </div>

      {/* Selector de cliente */}
      <div className="rounded-xl border border-border bg-card p-4">
        <label className="mb-1.5 block text-sm font-medium">Filtrar por cliente</label>
        <select
          value={selectedClienteId}
          onChange={(e) => setSelectedClienteId(e.target.value)}
          className={cn(inputCls, 'w-full max-w-md')}
        >
          <option value="">— Todos los clientes —</option>
          {clientes?.map((c) => (
            <option key={c.id} value={c.id}>{c.codigo} — {c.nombre}</option>
          ))}
        </select>
      </div>

      {/* Resumen del cliente seleccionado */}
      {resumen && selectedCliente && (
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-border p-4 text-center">
            <p className="text-sm text-muted-foreground">Saldo</p>
            <p className={cn('text-xl font-bold', resumen.saldo > 0 ? 'text-destructive' : 'text-success')}>
              {formatCurrency(resumen.saldo)}
            </p>
          </div>
          <div className="rounded-lg border border-border p-4 text-center">
            <p className="text-sm text-muted-foreground">Límite</p>
            <p className="text-xl font-bold">{resumen.limite > 0 ? formatCurrency(resumen.limite) : '—'}</p>
          </div>
          <div className="rounded-lg border border-border p-4 text-center">
            <p className="text-sm text-muted-foreground">Disponible</p>
            <p className={cn('text-xl font-bold', resumen.disponible < 0 ? 'text-destructive' : 'text-success')}>
              {resumen.limite > 0 ? formatCurrency(resumen.disponible) : '—'}
            </p>
          </div>
          <div className="rounded-lg border border-border p-4 text-center">
            <p className="text-sm text-muted-foreground">Vencidas</p>
            <p className={cn('text-xl font-bold', resumen.vencidas > 0 ? 'text-destructive' : '')}>
              {resumen.vencidas}
              {resumen.vencidas > 0 && <AlertTriangle size={16} className="inline ml-1 text-destructive" />}
            </p>
          </div>
        </div>
      )}

      {/* Formulario nuevo movimiento */}
      {showForm && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Nuevo movimiento</h2>
            <button onClick={() => setShowForm(false)} className="rounded p-1 hover:bg-muted"><X size={16} /></button>
          </div>
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-3">
            <select value={form.tipoMovimiento} onChange={(e) => setForm({ ...form, tipoMovimiento: e.target.value })} className={inputCls}>
              <option value="factura">Factura</option>
              <option value="nota_credito">Nota de crédito</option>
              <option value="nota_debito">Nota de débito</option>
              <option value="recibo">Recibo</option>
            </select>
            <input required placeholder="Número *" value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} className={inputCls} />
            <input required type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} className={inputCls} />
            <input type="date" value={form.fechaVencimiento} onChange={(e) => setForm({ ...form, fechaVencimiento: e.target.value })} className={inputCls} placeholder="Vencimiento" />
            <input required type="number" step="0.01" placeholder="Monto *" value={form.monto} onChange={(e) => setForm({ ...form, monto: e.target.value })} className={inputCls} />
            <div className="flex items-end">
              <button type="submit" disabled={saveMutation.isPending} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                {saveMutation.isPending && <Loader2 size={14} className="animate-spin" />}
                Crear
              </button>
            </div>
          </form>
        </div>
      )}

      <DataTable
        data={movimientosConSaldo}
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
