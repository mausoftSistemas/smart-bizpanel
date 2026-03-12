import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { LogIn, Save, Loader2, UserPlus, Ban, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'
import api from '../../api/client'
import { useAuth } from '../../hooks/useAuth'
import StatsCard from '../../components/StatsCard'
import DataTable from '../../components/DataTable'
import { type ColumnDef } from '@tanstack/react-table'
import { formatDate, formatDateTime, formatCurrency } from '../../lib/utils'
import { PlanBadge, EstadoBadge } from './SuperDashboard'
import { cn } from '../../lib/utils'

const tabs = ['Resumen', 'Config', 'Usuarios', 'Facturación', 'Logs']

interface TenantFull {
  id: string
  codigo: string
  razonSocial: string
  cuit: string | null
  email: string
  plan: string
  estado: string
  maxVendedores: number
  moduloGps: boolean
  moduloMp: boolean
  moduloFirma: boolean
  moduloEmail: boolean
  contactoNombre: string | null
  contactoTelefono: string | null
  contactoEmail: string | null
  notas: string | null
  planPrecio: number
  planMoneda: string
  planPeriodicidad: string
  proximoVencimiento: string | null
  diasMora: number
  colorPrimario: string
  colorSecundario: string
  nombreApp: string
  logo: string | null
  erpTipo: string
  createdAt: string
  config: Record<string, unknown> | null
  _count: { users: number; productos: number; clientes: number; pedidos: number; cobranzas: number }
}

interface TenantUser {
  id: string
  email: string
  nombre: string
  rol: string
  activo: boolean
  lastLogin: string | null
  createdAt: string
}

interface TenantStats {
  usuarios: number
  productos: number
  clientes: number
  pedidosMes: number
  montoVendidoMes: number
  cobranzasMes: number
  montoCobranzasMes: number
  ultimosSyncLogs: { id: number; direction: string; entityType: string; recordCount: number; status: string; startedAt: string }[]
}

export default function TenantDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { impersonate } = useAuth()
  const [activeTab, setActiveTab] = useState(0)

  const { data: tenant, isLoading } = useQuery({
    queryKey: ['super-tenant', id],
    queryFn: async () => {
      const { data: res } = await api.get(`/super/tenants/${id}`)
      return res.data as TenantFull
    },
  })

  const { data: stats } = useQuery({
    queryKey: ['super-tenant-stats', id],
    queryFn: async () => {
      const { data: res } = await api.get(`/super/tenants/${id}/stats`)
      return res.data as TenantStats
    },
  })

  const { data: users = [] } = useQuery({
    queryKey: ['super-tenant-users', id],
    queryFn: async () => {
      const { data: res } = await api.get(`/super/tenants/${id}/users`)
      return res.data as TenantUser[]
    },
    enabled: activeTab === 2,
  })

  const handleImpersonate = async () => {
    if (!id) return
    try {
      await impersonate(id)
      window.open('/', '_blank')
    } catch {
      toast.error('Error al impersonar')
    }
  }

  if (isLoading || !tenant) {
    return <div className="flex h-64 items-center justify-center text-muted-foreground">Cargando...</div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{tenant.razonSocial}</h1>
            <PlanBadge plan={tenant.plan} />
            <EstadoBadge estado={tenant.estado} />
          </div>
          <p className="text-sm text-muted-foreground">
            Código: <code className="rounded bg-muted px-1 font-mono text-xs">{tenant.codigo}</code> — Creada: {formatDate(tenant.createdAt)}
          </p>
        </div>
        <button
          onClick={handleImpersonate}
          className="flex items-center gap-1.5 rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-black/90 transition-colors"
        >
          <LogIn size={16} /> Entrar como Admin
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {tabs.map((tab, i) => (
          <button
            key={tab}
            onClick={() => setActiveTab(i)}
            className={cn(
              'border-b-2 px-4 py-2 text-sm font-medium transition-colors',
              activeTab === i ? 'border-black text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 0 && <TabResumen tenant={tenant} stats={stats} />}
      {activeTab === 1 && <TabConfig tenant={tenant} />}
      {activeTab === 2 && <TabUsuarios tenantId={tenant.id} users={users} maxVendedores={tenant.maxVendedores} />}
      {activeTab === 3 && <TabFacturacion tenant={tenant} />}
      {activeTab === 4 && <TabLogs stats={stats} />}
    </div>
  )
}

// ── Tab Resumen ──────────────────────────────────────────

function TabResumen({ tenant, stats }: { tenant: TenantFull; stats?: TenantStats }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard title="Usuarios" value={tenant._count.users} icon={<span className="text-lg">👥</span>} />
        <StatsCard title="Productos" value={tenant._count.productos} icon={<span className="text-lg">📦</span>} />
        <StatsCard title="Clientes" value={tenant._count.clientes} icon={<span className="text-lg">🏪</span>} />
        <StatsCard title="Pedidos/Mes" value={stats?.pedidosMes || 0} subtitle={stats ? formatCurrency(stats.montoVendidoMes) : ''} icon={<span className="text-lg">🛒</span>} />
      </div>

      {stats && (
        <div className="grid gap-4 sm:grid-cols-2">
          <StatsCard title="Cobranzas/Mes" value={stats.cobranzasMes} subtitle={formatCurrency(stats.montoCobranzasMes)} icon={<span className="text-lg">💰</span>} />
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">Información de contacto</p>
            <div className="mt-2 space-y-1 text-sm">
              <p>{tenant.contactoNombre || '—'}</p>
              <p className="text-muted-foreground">{tenant.contactoTelefono || '—'}</p>
              <p className="text-muted-foreground">{tenant.contactoEmail || tenant.email}</p>
            </div>
          </div>
        </div>
      )}

      {tenant.notas && (
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="mb-2 text-sm font-semibold">Notas internas</p>
          <p className="text-sm whitespace-pre-wrap">{tenant.notas}</p>
        </div>
      )}
    </div>
  )
}

// ── Tab Config ───────────────────────────────────────────

function TabConfig({ tenant }: { tenant: TenantFull }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({
    razonSocial: tenant.razonSocial,
    email: tenant.email,
    plan: tenant.plan,
    maxVendedores: tenant.maxVendedores,
    moduloGps: tenant.moduloGps,
    moduloMp: tenant.moduloMp,
    moduloFirma: tenant.moduloFirma,
    moduloEmail: tenant.moduloEmail,
    contactoNombre: tenant.contactoNombre || '',
    contactoTelefono: tenant.contactoTelefono || '',
    notas: tenant.notas || '',
    colorPrimario: tenant.colorPrimario,
    colorSecundario: tenant.colorSecundario,
    nombreApp: tenant.nombreApp,
  })
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.put(`/super/tenants/${tenant.id}`, form)
      queryClient.invalidateQueries({ queryKey: ['super-tenant', tenant.id] })
      toast.success('Configuración guardada')
    } catch {
      toast.error('Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium">Razón Social</label>
          <input type="text" value={form.razonSocial} onChange={(e) => setForm({ ...form, razonSocial: e.target.value })} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">Email</label>
          <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">Plan</label>
          <select value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring">
            <option value="basico">Básico</option>
            <option value="starter">Starter</option>
            <option value="profesional">Profesional</option>
            <option value="premium">Premium</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">Máx. Vendedores</label>
          <input type="number" value={form.maxVendedores} onChange={(e) => setForm({ ...form, maxVendedores: Number(e.target.value) })} min={1} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold">Módulos</h3>
        <div className="grid gap-3 sm:grid-cols-4">
          {[
            { key: 'moduloGps' as const, label: 'GPS' },
            { key: 'moduloMp' as const, label: 'Mercado Pago' },
            { key: 'moduloFirma' as const, label: 'Firma Digital' },
            { key: 'moduloEmail' as const, label: 'Emails' },
          ].map((m) => (
            <label key={m.key} className="flex items-center gap-2 rounded-lg border border-border p-3 cursor-pointer">
              <input type="checkbox" checked={form[m.key]} onChange={(e) => setForm({ ...form, [m.key]: e.target.checked })} className="h-4 w-4 accent-black" />
              <span className="text-sm">{m.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold">White Label</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Nombre App</label>
            <input type="text" value={form.nombreApp} onChange={(e) => setForm({ ...form, nombreApp: e.target.value })} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Color Primario</label>
            <input type="color" value={form.colorPrimario} onChange={(e) => setForm({ ...form, colorPrimario: e.target.value })} className="h-10 w-full rounded-lg border border-input bg-background px-1" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Color Secundario</label>
            <input type="color" value={form.colorSecundario} onChange={(e) => setForm({ ...form, colorSecundario: e.target.value })} className="h-10 w-full rounded-lg border border-input bg-background px-1" />
          </div>
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium">Notas internas</label>
        <textarea value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} rows={3} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring resize-none" />
      </div>

      <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 hover:bg-black/90 transition-colors">
        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
        Guardar Cambios
      </button>
    </div>
  )
}

// ── Tab Usuarios ─────────────────────────────────────────

function TabUsuarios({ tenantId, users, maxVendedores }: { tenantId: string; users: TenantUser[]; maxVendedores: number }) {
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [newUser, setNewUser] = useState({ email: '', password: '', nombre: '', rol: 'vendedor' })

  const createMutation = useMutation({
    mutationFn: () => api.post(`/super/tenants/${tenantId}/users`, newUser),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-tenant-users', tenantId] })
      toast.success('Usuario creado')
      setShowCreate(false)
      setNewUser({ email: '', password: '', nombre: '', rol: 'vendedor' })
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message || 'Error al crear usuario'
      toast.error(msg)
    },
  })

  const columns: ColumnDef<TenantUser, unknown>[] = [
    { accessorKey: 'nombre', header: 'Nombre' },
    { accessorKey: 'email', header: 'Email' },
    {
      accessorKey: 'rol',
      header: 'Rol',
      cell: ({ row }) => <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium">{row.original.rol}</span>,
    },
    {
      accessorKey: 'activo',
      header: 'Estado',
      cell: ({ row }) => row.original.activo
        ? <span className="text-xs text-success font-medium">Activo</span>
        : <span className="text-xs text-destructive font-medium">Inactivo</span>,
    },
    {
      accessorKey: 'lastLogin',
      header: 'Último Login',
      cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.original.lastLogin ? formatDateTime(row.original.lastLogin) : '—'}</span>,
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{users.length} usuarios — {users.filter((u) => u.rol === 'vendedor').length}/{maxVendedores} vendedores</p>
        <button onClick={() => setShowCreate(!showCreate)} className="flex items-center gap-1.5 rounded-lg bg-black px-3 py-2 text-sm font-medium text-white hover:bg-black/90 transition-colors">
          <UserPlus size={16} /> Crear Usuario
        </button>
      </div>

      {showCreate && (
        <div className="rounded-lg border border-border p-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-4">
            <input type="text" placeholder="Nombre" value={newUser.nombre} onChange={(e) => setNewUser({ ...newUser, nombre: e.target.value })} className="h-9 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
            <input type="email" placeholder="Email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} className="h-9 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
            <input type="text" placeholder="Contraseña" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} className="h-9 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
            <select value={newUser.rol} onChange={(e) => setNewUser({ ...newUser, rol: e.target.value })} className="h-9 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring">
              <option value="admin">Admin</option>
              <option value="supervisor">Supervisor</option>
              <option value="vendedor">Vendedor</option>
              <option value="deposito">Depósito</option>
              <option value="repartidor">Repartidor</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={() => createMutation.mutate()} disabled={!newUser.nombre || !newUser.email || !newUser.password || createMutation.isPending} className="flex items-center gap-1 rounded-lg bg-black px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 hover:bg-black/90 transition-colors">
              {createMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />} Crear
            </button>
            <button onClick={() => setShowCreate(false)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors">Cancelar</button>
          </div>
        </div>
      )}

      <DataTable data={users} columns={columns} searchPlaceholder="Buscar usuario..." pageSize={10} />
    </div>
  )
}

// ── Tab Facturación ──────────────────────────────────────

function TabFacturacion({ tenant }: { tenant: TenantFull }) {
  const queryClient = useQueryClient()
  const [editPlan, setEditPlan] = useState(false)
  const [planForm, setPlanForm] = useState({
    planPrecio: tenant.planPrecio,
    planPeriodicidad: tenant.planPeriodicidad,
    proximoVencimiento: tenant.proximoVencimiento?.split('T')[0] || '',
  })
  const [saving, setSaving] = useState(false)

  const handleSavePlan = async () => {
    setSaving(true)
    try {
      await api.put(`/super/tenants/${tenant.id}`, {
        planPrecio: planForm.planPrecio,
        planPeriodicidad: planForm.planPeriodicidad,
        proximoVencimiento: planForm.proximoVencimiento || null,
      })
      queryClient.invalidateQueries({ queryKey: ['super-tenant', tenant.id] })
      toast.success('Plan actualizado')
      setEditPlan(false)
    } catch {
      toast.error('Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const isExpired = tenant.proximoVencimiento && new Date(tenant.proximoVencimiento) < new Date()

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Plan Actual</p>
          <p className="mt-1 text-xl font-bold capitalize">{tenant.plan}</p>
          <p className="text-sm text-muted-foreground">${tenant.planPrecio} {tenant.planMoneda}/{tenant.planPeriodicidad === 'mensual' ? 'mes' : 'año'}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Próximo Vencimiento</p>
          <p className={cn('mt-1 text-xl font-bold', isExpired ? 'text-destructive' : '')}>
            {tenant.proximoVencimiento ? formatDate(tenant.proximoVencimiento) : '—'}
          </p>
          {isExpired && <p className="text-xs text-destructive">Vencido — {tenant.diasMora} días de mora</p>}
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Días de Mora</p>
          <p className={cn('mt-1 text-xl font-bold', tenant.diasMora > 0 ? 'text-destructive' : 'text-success')}>
            {tenant.diasMora}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Configuración de Plan</h3>
          <button onClick={() => setEditPlan(!editPlan)} className="text-xs text-primary hover:underline">{editPlan ? 'Cancelar' : 'Editar'}</button>
        </div>
        {editPlan && (
          <div className="mt-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium">Precio</label>
                <input type="number" value={planForm.planPrecio} onChange={(e) => setPlanForm({ ...planForm, planPrecio: Number(e.target.value) })} className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Periodicidad</label>
                <select value={planForm.planPeriodicidad} onChange={(e) => setPlanForm({ ...planForm, planPeriodicidad: e.target.value })} className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring">
                  <option value="mensual">Mensual</option>
                  <option value="anual">Anual</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Próximo Vencimiento</label>
                <input type="date" value={planForm.proximoVencimiento} onChange={(e) => setPlanForm({ ...planForm, proximoVencimiento: e.target.value })} className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
              </div>
            </div>
            <button onClick={handleSavePlan} disabled={saving} className="flex items-center gap-1 rounded-lg bg-black px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 hover:bg-black/90 transition-colors">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Guardar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Tab Logs ─────────────────────────────────────────────

function TabLogs({ stats }: { stats?: TenantStats }) {
  if (!stats) return <div className="text-sm text-muted-foreground">Cargando...</div>

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-3 text-sm font-semibold">Últimas sincronizaciones</h3>
        {stats.ultimosSyncLogs.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-xs text-muted-foreground">
                  <th className="px-4 py-2 text-left font-medium">Dirección</th>
                  <th className="px-4 py-2 text-left font-medium">Entidad</th>
                  <th className="px-4 py-2 text-right font-medium">Registros</th>
                  <th className="px-4 py-2 text-left font-medium">Estado</th>
                  <th className="px-4 py-2 text-left font-medium">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {stats.ultimosSyncLogs.map((log) => (
                  <tr key={log.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-2 text-xs">
                      <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', log.direction === 'pull' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700')}>
                        {log.direction}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs">{log.entityType}</td>
                    <td className="px-4 py-2 text-xs text-right">{log.recordCount}</td>
                    <td className="px-4 py-2">
                      <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', log.status === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}>
                        {log.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">{formatDateTime(log.startedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Sin sincronizaciones recientes</p>
        )}
      </div>
    </div>
  )
}
