import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { MoreVertical, Eye, LogIn, Pencil, Ban, CheckCircle, PlusCircle } from 'lucide-react'
import { toast } from 'sonner'
import api from '../../api/client'
import DataTable from '../../components/DataTable'
import { useAuth } from '../../hooks/useAuth'
import { formatDate } from '../../lib/utils'
import { PlanBadge, EstadoBadge } from './SuperDashboard'

interface Tenant {
  id: string
  codigo: string
  razonSocial: string
  email: string
  plan: string
  estado: string
  maxVendedores: number
  cantidadUsuarios: number
  cantidadProductos: number
  cantidadClientes: number
  cantidadPedidosMes: number
  ultimaActividad: string | null
  proximoVencimiento: string | null
  createdAt: string
}

export default function TenantsList() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { impersonate } = useAuth()
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [filterEstado, setFilterEstado] = useState('')
  const [filterPlan, setFilterPlan] = useState('')

  const { data: tenants = [], isLoading } = useQuery({
    queryKey: ['super-tenants', filterEstado, filterPlan],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filterEstado) params.set('estado', filterEstado)
      if (filterPlan) params.set('plan', filterPlan)
      const { data: res } = await api.get(`/super/tenants?${params}`)
      return res.data as Tenant[]
    },
  })

  const suspendMutation = useMutation({
    mutationFn: (id: string) => api.put(`/super/tenants/${id}/suspend`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-tenants'] })
      toast.success('Empresa suspendida')
    },
  })

  const activateMutation = useMutation({
    mutationFn: (id: string) => api.put(`/super/tenants/${id}/activate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-tenants'] })
      toast.success('Empresa reactivada')
    },
  })

  const handleImpersonate = async (tenant: Tenant) => {
    try {
      await impersonate(tenant.id)
      window.open('/', '_blank')
    } catch {
      toast.error('Error al impersonar')
    }
    setOpenMenu(null)
  }

  const columns: ColumnDef<Tenant, unknown>[] = [
    {
      accessorKey: 'razonSocial',
      header: 'Empresa',
      cell: ({ row }) => (
        <div className="min-w-[120px]">
          <p className="font-medium">{row.original.razonSocial}</p>
          <p className="text-[11px] text-muted-foreground">{row.original.codigo}</p>
        </div>
      ),
    },
    {
      accessorKey: 'plan',
      header: 'Plan',
      cell: ({ row }) => <PlanBadge plan={row.original.plan} />,
    },
    {
      accessorKey: 'estado',
      header: 'Estado',
      cell: ({ row }) => <EstadoBadge estado={row.original.estado} />,
    },
    {
      header: 'Vendedores',
      cell: ({ row }) => (
        <span className="text-xs">{row.original.cantidadUsuarios} / {row.original.maxVendedores}</span>
      ),
    },
    {
      accessorKey: 'cantidadProductos',
      header: 'Productos',
      cell: ({ row }) => <span className="text-xs">{row.original.cantidadProductos}</span>,
    },
    {
      accessorKey: 'cantidadClientes',
      header: 'Clientes',
      cell: ({ row }) => <span className="text-xs">{row.original.cantidadClientes}</span>,
    },
    {
      accessorKey: 'cantidadPedidosMes',
      header: 'Pedidos/Mes',
      cell: ({ row }) => <span className="text-xs font-medium">{row.original.cantidadPedidosMes}</span>,
    },
    {
      accessorKey: 'ultimaActividad',
      header: 'Última Actividad',
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {row.original.ultimaActividad ? formatDate(row.original.ultimaActividad) : '—'}
        </span>
      ),
    },
    {
      accessorKey: 'proximoVencimiento',
      header: 'Vto. Plan',
      cell: ({ row }) => {
        if (!row.original.proximoVencimiento) return <span className="text-xs text-muted-foreground">—</span>
        const vto = new Date(row.original.proximoVencimiento)
        const isExpired = vto < new Date()
        return (
          <span className={`text-xs ${isExpired ? 'font-medium text-destructive' : 'text-muted-foreground'}`}>
            {formatDate(row.original.proximoVencimiento)}
          </span>
        )
      },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <ActionsMenu
          tenant={row.original}
          openMenu={openMenu}
          setOpenMenu={setOpenMenu}
          onView={(t) => { navigate(`/super/tenants/${t.id}`); setOpenMenu(null) }}
          onEdit={(t) => { navigate(`/super/tenants/${t.id}?edit=true`); setOpenMenu(null) }}
          onImpersonate={handleImpersonate}
          onSuspend={(t) => { suspendMutation.mutate(t.id); setOpenMenu(null) }}
          onActivate={(t) => { activateMutation.mutate(t.id); setOpenMenu(null) }}
        />
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Empresas</h1>
          <p className="text-sm text-muted-foreground">{tenants.length} empresas registradas</p>
        </div>
        <button
          onClick={() => navigate('/super/tenants/new')}
          className="flex items-center gap-1.5 rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-black/90 transition-colors"
        >
          <PlusCircle size={16} />
          Crear Empresa
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <select
          value={filterEstado}
          onChange={(e) => setFilterEstado(e.target.value)}
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Todos los estados</option>
          <option value="activo">Activo</option>
          <option value="trial">Trial</option>
          <option value="suspendido">Suspendido</option>
          <option value="cancelado">Cancelado</option>
        </select>
        <select
          value={filterPlan}
          onChange={(e) => setFilterPlan(e.target.value)}
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Todos los planes</option>
          <option value="basico">Básico</option>
          <option value="starter">Starter</option>
          <option value="profesional">Profesional</option>
          <option value="premium">Premium</option>
          <option value="enterprise">Enterprise</option>
        </select>
      </div>

      <DataTable
        data={tenants}
        columns={columns}
        searchPlaceholder="Buscar empresa..."
        loading={isLoading}
        pageSize={15}
      />
    </div>
  )
}

// ─── Menú de acciones con posicionamiento fixed ─────────────────

interface ActionsMenuProps {
  tenant: Tenant
  openMenu: string | null
  setOpenMenu: (id: string | null) => void
  onView: (t: Tenant) => void
  onEdit: (t: Tenant) => void
  onImpersonate: (t: Tenant) => void
  onSuspend: (t: Tenant) => void
  onActivate: (t: Tenant) => void
}

function ActionsMenu({ tenant, openMenu, setOpenMenu, onView, onEdit, onImpersonate, onSuspend, onActivate }: ActionsMenuProps) {
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const isOpen = openMenu === tenant.id

  useEffect(() => {
    if (!isOpen || !btnRef.current || !menuRef.current) return
    const btnRect = btnRef.current.getBoundingClientRect()
    const menu = menuRef.current
    const menuH = menu.offsetHeight
    const menuW = menu.offsetWidth

    // Posicionar debajo del botón, alineado a la derecha
    let top = btnRect.bottom + 4
    let left = btnRect.right - menuW

    // Si se sale por abajo, mostrar arriba
    if (top + menuH > window.innerHeight) {
      top = btnRect.top - menuH - 4
    }
    // Si se sale por la izquierda
    if (left < 8) left = 8

    menu.style.top = `${top}px`
    menu.style.left = `${left}px`
  }, [isOpen])

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpenMenu(isOpen ? null : tenant.id)}
        className="rounded p-1 hover:bg-muted transition-colors"
      >
        <MoreVertical size={16} />
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpenMenu(null)} />
          <div
            ref={menuRef}
            className="fixed z-50 w-48 rounded-lg border border-border bg-card py-1 shadow-lg"
          >
            <button
              onClick={() => onView(tenant)}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors"
            >
              <Eye size={14} /> Ver detalle
            </button>
            <button
              onClick={() => onImpersonate(tenant)}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors"
            >
              <LogIn size={14} /> Entrar como admin
            </button>
            <button
              onClick={() => onEdit(tenant)}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors"
            >
              <Pencil size={14} /> Editar
            </button>
            <div className="my-1 border-t border-border" />
            {tenant.estado === 'activo' ? (
              <button
                onClick={() => onSuspend(tenant)}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-muted transition-colors"
              >
                <Ban size={14} /> Suspender
              </button>
            ) : (
              <button
                onClick={() => onActivate(tenant)}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-green-600 hover:bg-muted transition-colors"
              >
                <CheckCircle size={14} /> Activar
              </button>
            )}
          </div>
        </>
      )}
    </>
  )
}
