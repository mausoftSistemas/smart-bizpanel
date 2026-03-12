import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import {
  LayoutDashboard,
  Upload,
  Package,
  Users,
  ShoppingCart,
  Banknote,
  FileText,
  RotateCcw,
  RefreshCw,
  Settings,
  Palette,
  Scale,
  Clock,
  CreditCard,
  Sliders,
  UserCog,
  MapPin,
  BarChart3,
  Wallet,
  Target,
  LogOut,
  Menu,
  X,
  ChevronDown,
} from 'lucide-react'
import { cn } from '../lib/utils'

interface NavItem {
  label: string
  to: string
  icon: React.ReactNode
  children?: { label: string; to: string; icon: React.ReactNode }[]
}

const navigation: NavItem[] = [
  { label: 'Dashboard', to: '/', icon: <LayoutDashboard size={18} /> },
  { label: 'Importar datos', to: '/importar', icon: <Upload size={18} /> },
  { label: 'Productos', to: '/productos', icon: <Package size={18} /> },
  { label: 'Clientes', to: '/clientes', icon: <Users size={18} /> },
  { label: 'Pedidos', to: '/pedidos', icon: <ShoppingCart size={18} /> },
  { label: 'Cobranzas', to: '/cobranzas', icon: <Banknote size={18} /> },
  { label: 'Facturas', to: '/facturas', icon: <FileText size={18} /> },
  { label: 'Devoluciones', to: '/devoluciones', icon: <RotateCcw size={18} /> },
  {
    label: 'Sincronización',
    to: '/sync',
    icon: <RefreshCw size={18} />,
    children: [
      { label: 'Estado', to: '/sync', icon: <RefreshCw size={18} /> },
      { label: 'Configurar ERP', to: '/sync/erp', icon: <Settings size={18} /> },
    ],
  },
  {
    label: 'Configuración',
    to: '/config',
    icon: <Settings size={18} />,
    children: [
      { label: 'General', to: '/config/general', icon: <Sliders size={18} /> },
      { label: 'White Label', to: '/config/white-label', icon: <Palette size={18} /> },
      { label: 'Políticas', to: '/config/politicas', icon: <Scale size={18} /> },
      { label: 'Jornada', to: '/config/jornada', icon: <Clock size={18} /> },
      { label: 'Medios de Pago', to: '/config/medios-pago', icon: <CreditCard size={18} /> },
    ],
  },
  { label: 'Usuarios', to: '/usuarios', icon: <UserCog size={18} /> },
  {
    label: 'Vendedores',
    to: '/vendedores',
    icon: <MapPin size={18} />,
    children: [
      { label: 'Mapa en vivo', to: '/vendedores/mapa', icon: <MapPin size={18} /> },
    ],
  },
  {
    label: 'Reportes',
    to: '/reportes',
    icon: <BarChart3 size={18} />,
    children: [
      { label: 'Ventas por vendedor', to: '/reportes/ventas', icon: <BarChart3 size={18} /> },
      { label: 'Cuenta corriente', to: '/reportes/cuenta-corriente', icon: <Wallet size={18} /> },
      { label: 'Objetivos', to: '/reportes/objetivos', icon: <Target size={18} /> },
    ],
  },
]

function SidebarItem({ item }: { item: NavItem }) {
  const [open, setOpen] = useState(false)

  if (item.children) {
    return (
      <div>
        <button
          onClick={() => setOpen(!open)}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
        >
          {item.icon}
          <span className="flex-1 text-left">{item.label}</span>
          <ChevronDown size={14} className={cn('transition-transform', open && 'rotate-180')} />
        </button>
        {open && (
          <div className="ml-4 mt-1 space-y-1 border-l border-sidebar-accent pl-3">
            {item.children.map((child) => (
              <NavLink
                key={child.to}
                to={child.to}
                end
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent',
                  )
                }
              >
                {child.icon}
                {child.label}
              </NavLink>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
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
  )
}

export default function DashboardLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Overlay móvil */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-sidebar transition-transform lg:static lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-14 items-center gap-2 border-b border-sidebar-accent px-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
            BV
          </div>
          <span className="text-lg font-semibold text-sidebar-foreground">BizVentas</span>
          <button onClick={() => setSidebarOpen(false)} className="ml-auto text-sidebar-muted lg:hidden">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {navigation.map((item) => (
            <SidebarItem key={item.label} item={item} />
          ))}
        </nav>

        <div className="border-t border-sidebar-accent p-3">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-accent text-sidebar-foreground text-xs font-medium">
              {user?.nombre?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">{user?.nombre}</p>
              <p className="text-xs text-sidebar-muted truncate">{user?.rol}</p>
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

      {/* Contenido principal */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center gap-4 border-b border-border bg-card px-4 lg:px-6">
          <button onClick={() => setSidebarOpen(true)} className="text-muted-foreground lg:hidden">
            <Menu size={20} />
          </button>
          <div className="flex-1" />
          <span className="text-sm text-muted-foreground">{user?.tenantCodigo}</span>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
