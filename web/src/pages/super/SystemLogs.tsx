import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { Loader2 } from 'lucide-react'
import api from '../../api/client'
import DataTable from '../../components/DataTable'
import { formatDateTime } from '../../lib/utils'

interface LogItem {
  id: string
  tipo: string
  tenantId: string
  tenantCodigo: string
  entidad: string
  registros: number
  estado: string
  fecha: string
}

interface LogsData {
  items: LogItem[]
  pagination: { total: number; page: number; limit: number; totalPages: number }
}

const tipoBadge: Record<string, string> = {
  sync: 'bg-blue-100 text-blue-700',
  import: 'bg-purple-100 text-purple-700',
  intercambio: 'bg-amber-100 text-amber-700',
}

const estadoBadge: Record<string, string> = {
  success: 'bg-green-100 text-green-700',
  ok: 'bg-green-100 text-green-700',
  error: 'bg-red-100 text-red-700',
}

const columns: ColumnDef<LogItem>[] = [
  {
    accessorKey: 'tipo',
    header: 'Tipo',
    cell: ({ row }) => (
      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${tipoBadge[row.original.tipo] || 'bg-muted'}`}>
        {row.original.tipo}
      </span>
    ),
  },
  {
    accessorKey: 'tenantCodigo',
    header: 'Empresa',
  },
  {
    accessorKey: 'entidad',
    header: 'Entidad',
  },
  {
    accessorKey: 'registros',
    header: 'Registros',
    cell: ({ row }) => <span className="font-mono text-sm">{row.original.registros}</span>,
  },
  {
    accessorKey: 'estado',
    header: 'Estado',
    cell: ({ row }) => (
      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${estadoBadge[row.original.estado] || 'bg-muted'}`}>
        {row.original.estado}
      </span>
    ),
  },
  {
    accessorKey: 'fecha',
    header: 'Fecha',
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground">{formatDateTime(row.original.fecha)}</span>
    ),
  },
]

export default function SystemLogs() {
  const [tipo, setTipo] = useState('all')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['super-logs', tipo, page],
    queryFn: async () => {
      const { data: res } = await api.get('/super/logs', { params: { tipo, page, limit: 50 } })
      return res.data as LogsData
    },
  })

  const pagination = data?.pagination || { total: 0, page: 1, limit: 50, totalPages: 1 }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Logs del Sistema</h1>
          <p className="text-sm text-muted-foreground">
            Historial de sincronizaciones, importaciones e intercambios
          </p>
        </div>
        <select
          value={tipo}
          onChange={(e) => { setTipo(e.target.value); setPage(1) }}
          className="rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="all">Todos</option>
          <option value="sync">Sync</option>
          <option value="import">Import</option>
          <option value="intercambio">Intercambio</option>
        </select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <DataTable
            columns={columns}
            data={data?.items || []}
            searchColumn="tenantCodigo"
            searchPlaceholder="Buscar por empresa..."
          />

          {/* Paginación */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between border-t pt-4">
              <p className="text-sm text-muted-foreground">
                {pagination.total} registros - Página {pagination.page} de {pagination.totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                  disabled={page >= pagination.totalPages}
                  className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
