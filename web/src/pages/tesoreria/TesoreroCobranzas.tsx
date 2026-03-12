import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createColumnHelper } from '@tanstack/react-table'
import { useNavigate } from 'react-router-dom'
import { Download } from 'lucide-react'
import api from '../../api/client'
import DataTable from '../../components/DataTable'
import { formatCurrency, formatDate, cn } from '../../lib/utils'

interface Cobranza {
  id: string
  fecha: string
  total: number
  estado: string
  cliente: { id: string; nombre: string; codigo: string }
  vendedor: { id: string; nombre: string }
  medios: { tipo: string; monto: number }[]
}

interface Vendedor {
  id: string
  nombre: string
}

const col = createColumnHelper<Cobranza>()

const tipoMedioBadge: Record<string, string> = {
  efectivo: 'bg-green-100 text-green-700',
  cheque: 'bg-blue-100 text-blue-700',
  transferencia: 'bg-purple-100 text-purple-700',
  billetera: 'bg-orange-100 text-orange-700',
  tarjeta: 'bg-pink-100 text-pink-700',
}

export default function TesoreroCobranzas() {
  const navigate = useNavigate()
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [vendedorId, setVendedorId] = useState('')
  const [medioPago, setMedioPago] = useState('')

  const { data: vendedores } = useQuery({
    queryKey: ['tesoreria-vendedores-list'],
    queryFn: async () => {
      const { data: res } = await api.get('/tesoreria/vendedores')
      return res.data as Vendedor[]
    },
  })

  const { data, isLoading } = useQuery({
    queryKey: ['tesoreria-cobranzas', desde, hasta, vendedorId, medioPago],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (desde) params.set('desde', desde)
      if (hasta) params.set('hasta', hasta)
      if (vendedorId) params.set('vendedorId', vendedorId)
      if (medioPago) params.set('medioPago', medioPago)
      params.set('limit', '200')
      const { data: res } = await api.get(`/tesoreria/cobranzas?${params}`)
      return res.data as Cobranza[]
    },
  })

  const handleExport = async () => {
    const params = new URLSearchParams()
    if (desde) params.set('desde', desde)
    if (hasta) params.set('hasta', hasta)
    if (vendedorId) params.set('vendedorId', vendedorId)
    const response = await api.get(`/tesoreria/cobranzas/export?${params}`, { responseType: 'blob' })
    const url = window.URL.createObjectURL(new Blob([response.data]))
    const link = document.createElement('a')
    link.href = url
    link.download = 'cobranzas.xlsx'
    link.click()
    window.URL.revokeObjectURL(url)
  }

  const columns = [
    col.accessor('fecha', {
      header: 'Fecha',
      cell: (info) => formatDate(info.getValue()),
    }),
    col.accessor('vendedor', {
      header: 'Vendedor',
      cell: (info) => info.getValue().nombre,
    }),
    col.accessor('cliente', {
      header: 'Cliente',
      cell: (info) => info.getValue().nombre,
    }),
    col.accessor('total', {
      header: 'Total',
      cell: (info) => <span className="font-medium">{formatCurrency(Number(info.getValue()))}</span>,
    }),
    col.accessor('medios', {
      header: 'Medios',
      cell: (info) => (
        <div className="flex flex-wrap gap-1">
          {info.getValue().map((m, i) => (
            <span key={i} className={cn('inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium capitalize', tipoMedioBadge[m.tipo] || 'bg-muted')}>
              {m.tipo}
            </span>
          ))}
        </div>
      ),
    }),
    col.accessor('estado', {
      header: 'Estado',
      cell: (info) => (
        <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize',
          info.getValue() === 'confirmado' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning')}>
          {info.getValue()}
        </span>
      ),
    }),
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Cobranzas</h1>
        <p className="text-sm text-muted-foreground">Todas las cobranzas registradas</p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Desde</label>
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="h-9 rounded-lg border border-input px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Hasta</label>
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="h-9 rounded-lg border border-input px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Vendedor</label>
          <select value={vendedorId} onChange={(e) => setVendedorId(e.target.value)} className="h-9 rounded-lg border border-input px-3 text-sm outline-none focus:ring-2 focus:ring-ring">
            <option value="">Todos</option>
            {vendedores?.map((v) => <option key={v.id} value={v.id}>{v.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Medio</label>
          <select value={medioPago} onChange={(e) => setMedioPago(e.target.value)} className="h-9 rounded-lg border border-input px-3 text-sm outline-none focus:ring-2 focus:ring-ring">
            <option value="">Todos</option>
            <option value="efectivo">Efectivo</option>
            <option value="cheque">Cheque</option>
            <option value="transferencia">Transferencia</option>
            <option value="billetera">Billetera</option>
            <option value="tarjeta">Tarjeta</option>
          </select>
        </div>
      </div>

      <DataTable
        data={data || []}
        columns={columns}
        searchPlaceholder="Buscar cobranzas..."
        loading={isLoading}
        onRowClick={(row) => navigate(`/tesoreria/cobranzas/${row.id}`)}
        actions={
          <button onClick={handleExport} className="flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <Download size={16} /> Exportar Excel
          </button>
        }
      />
    </div>
  )
}
