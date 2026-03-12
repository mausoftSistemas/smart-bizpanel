import { useQuery } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { DollarSign, CheckCircle, AlertTriangle } from 'lucide-react'
import api from '../../api/client'
import StatsCard from '../../components/StatsCard'
import DataTable from '../../components/DataTable'
import { formatDate } from '../../lib/utils'
import { PlanBadge } from './SuperDashboard'
import { cn } from '../../lib/utils'

interface BillingTenant {
  id: string
  codigo: string
  razonSocial: string
  plan: string
  planPrecio: number
  planMoneda: string
  planPeriodicidad: string
  proximoVencimiento: string | null
  diasMora: number
  estado: string
  contactoNombre: string | null
  contactoEmail: string | null
}

interface BillingData {
  empresas: BillingTenant[]
  totalRecaudacionMensualEstimada: number
  empresasMorosas: number
  empresasConPlanVencido: number
}

export default function Billing() {
  const { data, isLoading } = useQuery({
    queryKey: ['super-billing'],
    queryFn: async () => {
      const { data: res } = await api.get('/super/billing')
      return res.data as BillingData
    },
  })

  const billing = data || { empresas: [], totalRecaudacionMensualEstimada: 0, empresasMorosas: 0, empresasConPlanVencido: 0 }

  const alDia = billing.empresas.filter((e) => e.estado === 'activo' && e.diasMora === 0).length

  const columns: ColumnDef<BillingTenant, unknown>[] = [
    {
      accessorKey: 'razonSocial',
      header: 'Empresa',
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.razonSocial}</p>
          <p className="text-[11px] text-muted-foreground">{row.original.contactoNombre || row.original.codigo}</p>
        </div>
      ),
    },
    {
      accessorKey: 'plan',
      header: 'Plan',
      cell: ({ row }) => <PlanBadge plan={row.original.plan} />,
    },
    {
      accessorKey: 'planPrecio',
      header: 'Precio',
      cell: ({ row }) => (
        <span className="text-sm font-medium">
          ${row.original.planPrecio} {row.original.planMoneda}
          <span className="text-xs text-muted-foreground">/{row.original.planPeriodicidad === 'mensual' ? 'mes' : 'año'}</span>
        </span>
      ),
    },
    {
      accessorKey: 'proximoVencimiento',
      header: 'Próximo Vto.',
      cell: ({ row }) => {
        if (!row.original.proximoVencimiento) return <span className="text-xs text-muted-foreground">—</span>
        const vto = new Date(row.original.proximoVencimiento)
        const now = new Date()
        const daysLeft = Math.ceil((vto.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        const isExpired = daysLeft < 0
        const isWarning = daysLeft >= 0 && daysLeft <= 7
        return (
          <span className={cn('text-xs', isExpired ? 'font-medium text-destructive' : isWarning ? 'font-medium text-warning' : 'text-muted-foreground')}>
            {formatDate(row.original.proximoVencimiento)}
          </span>
        )
      },
    },
    {
      accessorKey: 'diasMora',
      header: 'Estado Pago',
      cell: ({ row }) => {
        const mora = row.original.diasMora
        if (row.original.estado !== 'activo') {
          return <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">{row.original.estado}</span>
        }
        if (mora > 0) {
          return <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700">Mora ({mora}d)</span>
        }
        const vto = row.original.proximoVencimiento ? new Date(row.original.proximoVencimiento) : null
        if (vto && vto < new Date()) {
          return <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700">Vencido</span>
        }
        if (vto) {
          const daysLeft = Math.ceil((vto.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
          if (daysLeft <= 7) {
            return <span className="inline-flex rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-medium text-yellow-700">Por vencer</span>
          }
        }
        return <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700">Al día</span>
      },
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Facturación</h1>
        <p className="text-sm text-muted-foreground">Gestión de planes y cobros</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatsCard
          title="MRR (Ingreso Mensual)"
          value={`$${billing.totalRecaudacionMensualEstimada.toFixed(2)}`}
          subtitle="Recaudación estimada"
          icon={<DollarSign size={20} />}
        />
        <StatsCard
          title="Empresas al Día"
          value={alDia}
          icon={<CheckCircle size={20} />}
        />
        <StatsCard
          title="Empresas Morosas"
          value={billing.empresasMorosas}
          icon={<AlertTriangle size={20} />}
          className={billing.empresasMorosas > 0 ? 'border-destructive/30' : ''}
        />
      </div>

      <DataTable
        data={billing.empresas}
        columns={columns}
        searchPlaceholder="Buscar empresa..."
        loading={isLoading}
        pageSize={20}
      />
    </div>
  )
}
