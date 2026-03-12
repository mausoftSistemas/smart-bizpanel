import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import api from '../../api/client'
import { formatCurrency, formatDate, cn } from '../../lib/utils'

interface Movimiento {
  id: string
  tipo: string
  numero: string
  fecha: string
  monto: number
  saldo: number
}

interface ClienteCC {
  clienteId: string
  razonSocial: string
  codigoErp: string
  saldoTotal: number
  movimientos: Movimiento[]
}

export default function CuentaCorriente() {
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const { data: clientes, isLoading } = useQuery({
    queryKey: ['cc-clientes'],
    queryFn: async () => {
      try {
        const { data: res } = await api.get('/admin/cuenta-corriente/resumen')
        return res.data as ClienteCC[]
      } catch {
        return []
      }
    },
  })

  const filtered = (clientes || []).filter(
    (c) =>
      c.razonSocial.toLowerCase().includes(search.toLowerCase()) ||
      c.codigoErp.toLowerCase().includes(search.toLowerCase()),
  )

  const selected = filtered.find((c) => c.clienteId === selectedId)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Cuenta Corriente</h1>
        <p className="text-sm text-muted-foreground">Estado de cuenta de los clientes</p>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Buscar cliente por nombre o código..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring sm:w-96"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card max-h-[600px] overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center p-12 text-muted-foreground">Cargando...</div>
          ) : filtered.length === 0 ? (
            <div className="flex items-center justify-center p-12 text-muted-foreground">Sin resultados</div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((c) => (
                <button
                  key={c.clienteId}
                  onClick={() => setSelectedId(c.clienteId)}
                  className={cn(
                    'flex w-full items-center justify-between px-5 py-3 text-left transition-colors',
                    selectedId === c.clienteId ? 'bg-primary/5' : 'hover:bg-muted/30',
                  )}
                >
                  <div>
                    <p className="text-sm font-medium">{c.razonSocial}</p>
                    <p className="text-xs text-muted-foreground">{c.codigoErp}</p>
                  </div>
                  <span className={cn('text-sm font-semibold', c.saldoTotal > 0 ? 'text-destructive' : 'text-success')}>
                    {formatCurrency(c.saldoTotal)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card">
          {selected ? (
            <>
              <div className="border-b border-border px-5 py-3">
                <h2 className="font-semibold">{selected.razonSocial}</h2>
                <p className="text-sm text-muted-foreground">
                  Saldo: <span className={cn('font-semibold', selected.saldoTotal > 0 ? 'text-destructive' : 'text-success')}>{formatCurrency(selected.saldoTotal)}</span>
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">Tipo</th>
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">Número</th>
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">Fecha</th>
                      <th className="px-4 py-2 text-right font-medium text-muted-foreground">Monto</th>
                      <th className="px-4 py-2 text-right font-medium text-muted-foreground">Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.movimientos.map((m) => (
                      <tr key={m.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-2 uppercase text-xs font-medium">{m.tipo}</td>
                        <td className="px-4 py-2">{m.numero}</td>
                        <td className="px-4 py-2">{formatDate(m.fecha)}</td>
                        <td className="px-4 py-2 text-right">{formatCurrency(m.monto)}</td>
                        <td className="px-4 py-2 text-right">{formatCurrency(m.saldo)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center p-12 text-muted-foreground">
              Seleccioná un cliente para ver sus movimientos
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
