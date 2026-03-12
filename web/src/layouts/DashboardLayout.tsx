import { useState } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import {
  LayoutDashboard,
  Upload,
  Package,
  Users,
  FileText,
  ShoppingCart,
  Banknote,
  RotateCcw,
  UserCheck,
  Map,
  Settings,
  Scale,
  UserCog,
  Cable,
  RefreshCw,
  ArrowLeftRight,
  LogOut,
  Menu,
  X,
  ChevronRight,
} from 'lucide-react'
import { cn } from '../lib/utils'

interface NavItem {
  label: string
  to: string
  icon: React.ReactNode
  end?: boolean
}

interface NavSection {
  title: string
  items: NavItem[]
}

const sections: NavSection[] = [
  {
    title: '',
    items: [
      { label: 'Dashboard', to: '/', icon: <LayoutDashboard size={18} />, end: true },
    ],
  },
  {
    title: 'Datos',
    items: [
      { label: 'Importar Datos', to: '/importar', icon: <Upload size={18} /> },
      { label: 'Productos', to: '/productos', icon: <Package size={18} /> },
      { label: 'Clientes', to: '/clientes', icon: <Users size={18} /> },
      { label: 'Facturas / Cta Cte', to: '/facturas', icon: <FileText size={18} /> },
      { label: 'Intercambio ERP', to: '/intercambio', icon: <ArrowLeftRight size={18} /> },
    ],
  },
  {
    title: 'Operaciones',
    items: [
      { label: 'Pedidos', to: '/pedidos', icon: <ShoppingCart size={18} /> },
      { label: 'Cobranzas', to: '/cobranzas', icon: <Banknote size={18} /> },
      { label: 'Devoluciones', to: '/devoluciones', icon: <RotateCcw size={18} /> },
    ],
  },
  {
    title: 'Vendedores',
    items: [
      { label: 'Vendedores', to: '/vendedores/mapa', icon: <UserCheck size={18} /> },
      { label: 'Mapa en Vivo', to: '/vendedores/mapa', icon: <Map size={18} /> },
    ],
  },
  {
    title: 'Configuración',
    items: [
      { label: 'Configuración', to: '/config/general', icon: <Settings size={18} /> },
      { label: 'Políticas', to: '/config/politicas', icon: <Scale size={18} /> },
      { label: 'Usuarios', to: '/usuarios', icon: <UserCog size={18} /> },
      { label: 'Conexión ERP', to: '/sync/erp', icon: <Cable size={18} /> },
      { label: 'Sync Status', to: '/sync', icon: <RefreshCw size={18} /> },
    ],
  },
]

// Breadcrumb config
const breadcrumbMap: Record<string, string> = {
  '/': 'Dashboard',
  '/importar': 'Importar Datos',
  '/productos': 'Productos',
  '/clientes': 'Clientes',
  '/facturas': 'Facturas / Cta Cte',
  '/pedidos': 'Pedidos',
  '/cobranzas': 'Cobranzas',
  '/devoluciones': 'Devoluciones',
  '/intercambio': 'Intercambio ERP',
  '/intercambio/config': 'Config Intercambio',
  '/sync': 'Sync Status',
  '/sync/erp': 'Conexión ERP',
  '/config/general': 'Configuración',
  '/config/politicas': 'Políticas',
  '/config/white-label': 'White Label',
  '/config/jornada': 'Jornada',
  '/config/medios-pago': 'Medios de Pago',
  '/usuarios': 'Usuarios',
  '/vendedores/mapa': 'Mapa en Vivo',
  '/reportes/ventas': 'Ventas por Vendedor',
  '/reportes/cuenta-corriente': 'Cuenta Corriente',
  '/reportes/objetivos': 'Objetivos',
}

export default function DashboardLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const currentPage = breadcrumbMap[location.pathname] || ''

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Overlay móvil */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-60 flex-col bg-sidebar transition-transform lg:static lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Logo */}
        <div className="flex h-14 items-center gap-2.5 border-b border-sidebar-accent px-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
            BV
          </div>
          <span className="text-lg font-semibold text-sidebar-foreground">BizVentas</span>
          <button onClick={() => setSidebarOpen(false)} className="ml-auto text-sidebar-muted lg:hidden">
            <X size={20} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-2">
          {sections.map((section) => (
            <div key={section.title || '_top'} className="mb-1">
              {section.title && (
                <div className="mb-1 mt-4 px-3 text-[10px] font-semibold uppercase tracking-wider text-sidebar-muted">
                  {section.title}
                </div>
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <NavLink
                    key={item.label + item.to}
                    to={item.to}
                    end={item.end}
                    onClick={() => setSidebarOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'text-sidebar-foreground hover:bg-sidebar-accent',
                      )
                    }
                  >
                    {item.icon}
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* User + Tenant */}
        <div className="border-t border-sidebar-accent p-3">
          <div className="mb-2 rounded-lg bg-sidebar-accent/50 px-3 py-1.5">
            <p className="text-[10px] font-medium uppercase tracking-wider text-sidebar-muted">Tenant</p>
            <p className="text-sm font-medium text-sidebar-foreground truncate">{user?.tenantCodigo}</p>
          </div>
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-bold">
              {user?.nombre?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">{user?.nombre}</p>
              <p className="text-[11px] text-sidebar-muted truncate">{user?.rol}</p>
            </div>
            <button
              onClick={handleLogout}
              className="text-sidebar-muted hover:text-sidebar-foreground transition-colors"
              title="Cerrar sesión"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-14 items-center gap-4 border-b border-border bg-card px-4 lg:px-6">
          <button onClick={() => setSidebarOpen(true)} className="text-muted-foreground lg:hidden">
            <Menu size={20} />
          </button>

          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-sm">
            <span className="text-muted-foreground">Panel</span>
            {currentPage && currentPage !== 'Dashboard' && (
              <>
                <ChevronRight size={14} className="text-muted-foreground" />
                <span className="font-medium">{currentPage}</span>
              </>
            )}
          </div>

          <div className="flex-1" />

          {/* User badge */}
          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-muted-foreground sm:inline">{user?.nombre}</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
              {user?.nombre?.charAt(0).toUpperCase() || 'U'}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
