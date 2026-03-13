import { useQuery } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { HardDrive, Package, Users, ShoppingCart } from 'lucide-react'
import api from '../../api/client'
import StatsCard from '../../components/StatsCard'
import DataTable from '../../components/DataTable'

interface StorageStats {
  totalAlmacenamientoMb: number
  totalProductos: number
  totalClientes: number
  totalPedidos: number
}

interface TenantStorage {
  id: string
  codigo: string
  razonSocial: string
  cantidadProductos: number
  cantidadClientes: number
  cantidadPedidosMes: number
  almacenamientoMb: number
  estado: string
}

interface StorageData {
  stats: StorageStats
  tenants: TenantStorage[]
}

export default function Storage() {
  const { data, isLoading } = useQuery({
    queryKey: ['super-storage'],
    queryFn: async () => {
      const { data: res } = await api.get('/super/storage')
      return res.data as StorageData
    },
  })

  const stats = data?.stats || { totalAlmacenamientoMb: 0, totalProductos: 0, totalClientes: 0, totalPedidos: 0 }
  const tenants = data?.tenants || []
  const maxMb = Math.max(...tenants.map((t) => t.almacenamientoMb), 1)

  const columns: ColumnDef<TenantStorage>[] = [
    {
      accessorKey: 'razonSocial',
      header: 'Empresa',
      cell: ({ row }) => (
        <div>
          <p className="text-sm font-medium">{row.original.razonSocial}</p>
          <p className="text-[11px] text-muted-foreground">{row.original.codigo}</p>
        </div>
      ),
    },
    {
      accessorKey: 'cantidadProductos',
      header: 'Productos',
      cell: ({ row }) => <span className="font-mono text-sm">{row.original.cantidadProductos.toLocaleString()}</span>,
    },
    {
      accessorKey: 'cantidadClientes',
      header: 'Clientes',
      cell: ({ row }) => <span className="font-mono text-sm">{row.original.cantidadClientes.toLocaleString()}</span>,
    },
    {
      accessorKey: 'cantidadPedidosMes',
      header: 'Pedidos/Mes',
      cell: ({ row }) => <span className="font-mono text-sm">{row.original.cantidadPedidosMes.toLocaleString()}</span>,
    },
    {
      accessorKey: 'almacenamientoMb',
      header: 'Almacenamiento',
      cell: ({ row }) => {
        const mb = row.original.almacenamientoMb
        const pct = (mb / maxMb) * 100
        return (
          <div className="flex items-center gap-2">
            <div className="h-2 w-24 rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-primary"
                style={{ width: `${Math.max(pct, 2)}%` }}
              />
            </div>
            <span className="font-mono text-xs">{mb.toFixed(1)} MB</span>
          </div>
        )
      },
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Almacenamiento</h1>
        <p className="text-sm text-muted-foreground">Uso de almacenamiento y registros por empresa</p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl border border-border bg-muted/30" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatsCard
              title="Almacenamiento Total"
              value={`${stats.totalAlmacenamientoMb.toFixed(1)} MB`}
              icon={<HardDrive size={20} />}
            />
            <StatsCard title="Total Productos" value={stats.totalProductos.toLocaleString()} icon={<Package size={20} />} />
            <StatsCard title="Total Clientes" value={stats.totalClientes.toLocaleString()} icon={<Users size={20} />} />
            <StatsCard title="Total Pedidos" value={stats.totalPedidos.toLocaleString()} icon={<ShoppingCart size={20} />} />
          </div>

          <DataTable
            columns={columns}
            data={tenants}
            searchColumn="razonSocial"
            searchPlaceholder="Buscar empresa..."
          />
        </>
      )}
    </div>
  )
}
