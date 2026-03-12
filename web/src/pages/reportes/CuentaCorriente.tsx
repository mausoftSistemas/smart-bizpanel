import { useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Search, Download, Loader2, X } from 'lucide-react'
import api from '../../api/client'
import { formatCurrency, formatDate, cn } from '../../lib/utils'

interface Movimiento {
  id: string
  tipoMovimiento: string
  numero: string
  fecha: string
  monto: number | string
  observaciones: string | null
}

interface ClienteOption {
  id: string
  codigo: string
  nombre: string
  saldoCuenta: number
}

const tipoLabels: Record<string, string> = {
  factura: 'Factura',
  nota_credito: 'Nota Crédito',
  nota_debito: 'Nota Débito',
  recibo: 'Recibo',
}

const debeTypes = ['factura', 'nota_debito']

export default function CuentaCorriente() {
  const [searchParams] = useSearchParams()
  const [selectedClienteId, setSelectedClienteId] = useState(searchParams.get('clienteId') || '')
  const [search, setSearch] = useState('')
  const [filtroDesde, setFiltroDesde] = useState('')
  const [filtroHasta, setFiltroHasta] = useState('')

  // Cargar lista de clientes
  const { data: clientes, isLoading: loadingClientes } = useQuery({
    queryKey: ['cc-clientes'],
    queryFn: async () => {
      const { data: res } = await api.get('/clientes?limit=9999')
      return res.data as ClienteOption[]
    },
  })

  // Cargar movimientos del cliente seleccionado
  const { data: movimientos, isLoading: loadingMov } = useQuery({
    queryKey: ['cc-movimientos', selectedClienteId],
    queryFn: async () => {
      const { data: res } = await api.get(`/admin/cuenta-corriente?clienteId=${selectedClienteId}`)
      return res.data as Movimiento[]
    },
    enabled: !!selectedClienteId,
  })

  const filteredClientes = (clientes || []).filter(c =>
    !search ||
    c.nombre.toLowerCase().includes(search.toLowerCase()) ||
    c.codigo.toLowerCase().includes(search.toLowerCase()),
  )

  const selectedCliente = clientes?.find(c => c.id === selectedClienteId)

  // Calcular saldo progresivo y filtrar por fecha
  const movConSaldo = useMemo(() => {
    if (!movimientos?.length) return []

    let filtered = [...movimientos]
    if (filtroDesde) filtered = filtered.filter(m => new Date(m.fecha) >= new Date(filtroDesde))
    if (filtroHasta) {
      const h = new Date(filtroHasta)
      h.setDate(h.getDate() + 1)
      filtered = filtered.filter(m => new Date(m.fecha) < h)
    }

    // Sort ASC para calcular saldo progresivo
    const sorted = [...filtered].sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())
    let saldo = 0
    const result = sorted.map(m => {
      const monto = Number(m.monto)
      const debe = debeTypes.includes(m.tipoMovimiento) ? monto : 0
      const haber = !debeTypes.includes(m.tipoMovimiento) ? monto : 0
      saldo += debe - haber
      return { ...m, debe, haber, saldo }
    })
    return result.reverse() // Mostrar más reciente primero
  }, [movimientos, filtroDesde, filtroHasta])

  // Resumen
  const resumen = useMemo(() => {
    const totalDebe = movConSaldo.reduce((s, m) => s + m.debe, 0)
    const totalHaber = movConSaldo.reduce((s, m) => s + m.haber, 0)
    return { totalDebe, totalHaber, saldo: totalDebe - totalHaber }
  }, [movConSaldo])

  const exportPdf = () => {
    if (!movConSaldo.length || !selectedCliente) return
    // Export as printable HTML that can be saved as PDF
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Cuenta Corriente - ${selectedCliente.nombre}</title>
    <style>body{font-family:Arial,sans-serif;font-size:12px;margin:20px}h1{font-size:18px}table{width:100%;border-collapse:collapse;margin-top:10px}th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}th{background:#f5f5f5}td.right{text-align:right}.total{font-weight:bold;background:#f5f5f5}</style></head><body>
    <h1>Cuenta Corriente: ${selectedCliente.nombre} (${selectedCliente.codigo})</h1>
    <p>Saldo actual: $${Number(selectedCliente.saldoCuenta).toFixed(2)}</p>
    ${filtroDesde || filtroHasta ? `<p>Período: ${filtroDesde || '...'} a ${filtroHasta || '...'}</p>` : ''}
    <table><thead><tr><th>Fecha</th><th>Tipo</th><th>Número</th><th>Debe</th><th>Haber</th><th>Saldo</th></tr></thead><tbody>
    ${movConSaldo.map(m => `<tr><td>${formatDate(m.fecha)}</td><td>${tipoLabels[m.tipoMovimiento] || m.tipoMovimiento}</td><td>${m.numero}</td><td class="right">${m.debe > 0 ? '$' + m.debe.toFixed(2) : ''}</td><td class="right">${m.haber > 0 ? '$' + m.haber.toFixed(2) : ''}</td><td class="right">$${m.saldo.toFixed(2)}</td></tr>`).join('')}
    <tr class="total"><td colspan="3">TOTALES</td><td class="right">$${resumen.totalDebe.toFixed(2)}</td><td class="right">$${resumen.totalHaber.toFixed(2)}</td><td class="right">$${resumen.saldo.toFixed(2)}</td></tr>
    </tbody></table></body></html>`
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const w = window.open(url)
    if (w) setTimeout(() => { w.print() }, 500)
  }

  const inputCls = 'h-9 rounded-lg border border-input px-3 text-sm outline-none focus:ring-2 focus:ring-ring'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cuenta Corriente</h1>
          <p className="text-sm text-muted-foreground">Estado de cuenta y movimientos por cliente</p>
        </div>
        <button
          onClick={exportPdf}
          disabled={!movConSaldo.length}
          className="flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
        >
          <Download size={14} /> Exportar PDF
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* Lista de clientes */}
        <div className="rounded-xl border border-border bg-card">
          <div className="border-b border-border p-3">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar cliente..."
                className={cn(inputCls, 'w-full pl-8')}
              />
            </div>
          </div>
          {loadingClientes ? (
            <div className="flex items-center justify-center p-12 text-muted-foreground">
              <Loader2 size={16} className="animate-spin mr-2" /> Cargando...
            </div>
          ) : (
            <div className="divide-y divide-border overflow-y-auto" style={{ maxHeight: 'calc(100vh - 16rem)' }}>
              {filteredClientes.map(c => (
                <button
                  key={c.id}
                  onClick={() => setSelectedClienteId(c.id)}
                  className={cn(
                    'flex w-full items-center justify-between px-4 py-3 text-left transition-colors',
                    selectedClienteId === c.id ? 'bg-primary/5 border-l-2 border-l-primary' : 'hover:bg-muted/30',
                  )}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{c.nombre}</p>
                    <p className="text-xs text-muted-foreground">{c.codigo}</p>
                  </div>
                  <span className={cn(
                    'ml-2 text-sm font-semibold whitespace-nowrap',
                    Number(c.saldoCuenta) > 0 ? 'text-destructive' : 'text-success',
                  )}>
                    {formatCurrency(Number(c.saldoCuenta))}
                  </span>
                </button>
              ))}
              {!filteredClientes.length && (
                <div className="flex items-center justify-center p-8 text-sm text-muted-foreground">Sin resultados</div>
              )}
            </div>
          )}
        </div>

        {/* Movimientos */}
        <div className="space-y-4">
          {!selectedClienteId ? (
            <div className="flex items-center justify-center rounded-xl border border-border p-16 text-muted-foreground">
              Seleccioná un cliente para ver sus movimientos
            </div>
          ) : (
            <>
              {/* Resumen card */}
              {selectedCliente && (
                <div className="grid gap-4 sm:grid-cols-4">
                  <div className="rounded-xl border border-border p-4 sm:col-span-2">
                    <p className="text-sm font-semibold">{selectedCliente.nombre}</p>
                    <p className="text-xs text-muted-foreground">{selectedCliente.codigo}</p>
                  </div>
                  <div className="rounded-xl border border-border p-4">
                    <p className="text-xs text-muted-foreground">Saldo actual</p>
                    <p className={cn('text-xl font-bold', Number(selectedCliente.saldoCuenta) > 0 ? 'text-destructive' : 'text-success')}>
                      {formatCurrency(Number(selectedCliente.saldoCuenta))}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border p-4">
                    <p className="text-xs text-muted-foreground">Movimientos</p>
                    <p className="text-xl font-bold">{movimientos?.length || 0}</p>
                  </div>
                </div>
              )}

              {/* Filtros de fecha */}
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Desde</label>
                  <input type="date" value={filtroDesde} onChange={(e) => setFiltroDesde(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Hasta</label>
                  <input type="date" value={filtroHasta} onChange={(e) => setFiltroHasta(e.target.value)} className={inputCls} />
                </div>
                {(filtroDesde || filtroHasta) && (
                  <button
                    onClick={() => { setFiltroDesde(''); setFiltroHasta('') }}
                    className="flex h-9 items-center gap-1 rounded-lg border border-border px-3 text-xs hover:bg-muted"
                  >
                    <X size={12} /> Limpiar
                  </button>
                )}
              </div>

              {/* Tabla */}
              {loadingMov ? (
                <div className="flex items-center justify-center p-12 text-muted-foreground">
                  <Loader2 size={16} className="animate-spin mr-2" /> Cargando...
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border bg-card">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/50 text-xs">
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">Fecha</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">Tipo</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">Número</th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">Debe</th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">Haber</th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">Saldo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {!movConSaldo.length ? (
                        <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">Sin movimientos</td></tr>
                      ) : movConSaldo.map(m => (
                        <tr key={m.id} className="border-b border-border last:border-0">
                          <td className="px-4 py-2.5">{formatDate(m.fecha)}</td>
                          <td className="px-4 py-2.5">
                            <span className={cn(
                              'inline-flex rounded px-1.5 py-0.5 text-[10px] font-bold uppercase',
                              debeTypes.includes(m.tipoMovimiento) ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success',
                            )}>
                              {tipoLabels[m.tipoMovimiento] || m.tipoMovimiento}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 font-mono text-xs">{m.numero}</td>
                          <td className="px-4 py-2.5 text-right">{m.debe > 0 ? formatCurrency(m.debe) : ''}</td>
                          <td className="px-4 py-2.5 text-right">{m.haber > 0 ? formatCurrency(m.haber) : ''}</td>
                          <td className={cn('px-4 py-2.5 text-right font-medium', m.saldo > 0 ? 'text-destructive' : 'text-success')}>
                            {formatCurrency(m.saldo)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {movConSaldo.length > 0 && (
                      <tfoot>
                        <tr className="border-t-2 border-border font-semibold bg-muted/30">
                          <td colSpan={3} className="px-4 py-3">TOTALES</td>
                          <td className="px-4 py-3 text-right">{formatCurrency(resumen.totalDebe)}</td>
                          <td className="px-4 py-3 text-right">{formatCurrency(resumen.totalHaber)}</td>
                          <td className={cn('px-4 py-3 text-right', resumen.saldo > 0 ? 'text-destructive' : 'text-success')}>
                            {formatCurrency(resumen.saldo)}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
