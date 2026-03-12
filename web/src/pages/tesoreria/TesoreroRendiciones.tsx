import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createColumnHelper } from '@tanstack/react-table'
import { useNavigate } from 'react-router-dom'
import api from '../../api/client'
import DataTable from '../../components/DataTable'
import { formatCurrency, formatDate, cn } from '../../lib/utils'

interface Rendicion {
  id: string
  fecha: string
  totalEsperado: number
  totalRecaudado: number
  diferencia: number
  estado: string
  vendedorId: string
  vendedorNombre: string
  totalEfectivo: number
  totalCheques: number
  totalTransferencias: number
}

interface Vendedor {
  id: string
  nombre: string
}

const col = createColumnHelper<Rendicion>()

const estadoColors: Record<string, string> = {
  pendiente: 'bg-amber-100 text-amber-700',
  entregado: 'bg-blue-100 text-blue-700',
  aprobado: 'bg-green-100 text-green-700',
  rechazado: 'bg-red-100 text-red-700',
  con_diferencia: 'bg-orange-100 text-orange-700',
}

export default function TesoreroRendiciones() {
  const navigate = useNavigate()
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [vendedorId, setVendedorId] = useState('')
  const [estado, setEstado] = useState('')

  const { data: vendedores } = useQuery({
    queryKey: ['tesoreria-vendedores-list'],
    queryFn: async () => {
      const { data: res } = await api.get('/tesoreria/vendedores')
      return res.data as Vendedor[]
    },
  })

  const { data, isLoading } = useQuery({
    queryKey: ['tesoreria-rendiciones', desde, hasta, vendedorId, estado],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (desde) params.set('desde', desde)
      if (hasta) params.set('hasta', hasta)
      if (vendedorId) params.set('vendedorId', vendedorId)
      if (estado) params.set('estado', estado)
      params.set('limit', '200')
      const { data: res } = await api.get(`/tesoreria/rendiciones?${params}`)
      return res.data as Rendicion[]
    },
  })

  const columns = [
    col.accessor('fecha', {
      header: 'Fecha',
      cell: (info) => formatDate(info.getValue()),
    }),
    col.accessor('vendedorNombre', {
      header: 'Vendedor',
      cell: (info) => info.getValue(),
    }),
    col.accessor('totalRecaudado', {
      header: 'Recaudado',
      cell: (info) => <span className="font-medium">{formatCurrency(Number(info.getValue()))}</span>,
    }),
    col.accessor('totalEsperado', {
      header: 'Esperado',
      cell: (info) => formatCurrency(Number(info.getValue())),
    }),
    col.accessor('diferencia', {
      header: 'Diferencia',
      cell: (info) => {
        const val = Number(info.getValue())
        const color = val === 0 ? 'text-green-600' : val < 0 ? 'text-red-600' : 'text-orange-600'
        return <span className={cn('font-medium', color)}>{formatCurrency(val)}</span>
      },
    }),
    col.accessor('estado', {
      header: 'Estado',
      cell: (info) => (
        <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize', estadoColors[info.getValue()] || 'bg-muted')}>
          {info.getValue().replace('_', ' ')}
        </span>
      ),
    }),
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Rendiciones</h1>
        <p className="text-sm text-muted-foreground">Rendiciones de vendedores</p>
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
          <label className="mb-1 block text-xs text-muted-foreground">Estado</label>
          <select value={estado} onChange={(e) => setEstado(e.target.value)} className="h-9 rounded-lg border border-input px-3 text-sm outline-none focus:ring-2 focus:ring-ring">
            <option value="">Todos</option>
            <option value="pendiente">Pendiente</option>
            <option value="entregado">Entregado</option>
            <option value="aprobado">Aprobado</option>
            <option value="rechazado">Rechazado</option>
            <option value="con_diferencia">Con diferencia</option>
          </select>
        </div>
      </div>

      <DataTable
        data={data || []}
        columns={columns}
        searchPlaceholder="Buscar rendiciones..."
        loading={isLoading}
        onRowClick={(row) => navigate(`/tesoreria/rendiciones/${row.id}`)}
      />
    </div>
  )
}
