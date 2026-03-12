import { useState } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import {
  LayoutDashboard,
  Building2,
  PlusCircle,
  Receipt,
  AlertTriangle,
  Activity,
  RefreshCw,
  HardDrive,
  User,
  Terminal,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Shield,
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
      { label: 'Dashboard Global', to: '/super', icon: <LayoutDashboard size={18} />, end: true },
    ],
  },
  {
    title: 'Empresas',
    items: [
      { label: 'Todas las Empresas', to: '/super/tenants', icon: <Building2 size={18} /> },
      { label: 'Crear Empresa', to: '/super/tenants/new', icon: <PlusCircle size={18} /> },
    ],
  },
  {
    title: 'Facturación',
    items: [
      { label: 'Facturación', to: '/super/billing', icon: <Receipt size={18} /> },
      { label: 'Empresas Morosas', to: '/super/billing?filter=morosas', icon: <AlertTriangle size={18} /> },
    ],
  },
  {
    title: 'Monitoreo',
    items: [
      { label: 'Actividad Global', to: '/super/activity', icon: <Activity size={18} /> },
      { label: 'Sync Status Global', to: '/super/sync', icon: <RefreshCw size={18} /> },
      { label: 'Almacenamiento', to: '/super/storage', icon: <HardDrive size={18} /> },
    ],
  },
  {
    title: 'Sistema',
    items: [
      { label: 'Mi Cuenta', to: '/super/account', icon: <User size={18} /> },
      { label: 'Logs del Sistema', to: '/super/logs', icon: <Terminal size={18} /> },
    ],
  },
]

const breadcrumbMap: Record<string, string> = {
  '/super': 'Dashboard Global',
  '/super/tenants': 'Empresas',
  '/super/tenants/new': 'Crear Empresa',
  '/super/billing': 'Facturación',
  '/super/activity': 'Actividad Global',
  '/super/sync': 'Sync Status',
  '/super/storage': 'Almacenamiento',
  '/super/account': 'Mi Cuenta',
  '/super/logs': 'Logs',
}

export default function SuperAdminLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  // Detectar breadcrumb, incluyendo /super/tenants/:id
  let currentPage = breadcrumbMap[location.pathname] || ''
  if (!currentPage && location.pathname.startsWith('/super/tenants/') && location.pathname !== '/super/tenants/new') {
    currentPage = 'Detalle Empresa'
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Overlay móvil */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar negro */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-60 flex-col bg-black transition-transform lg:static lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Logo */}
        <div className="flex h-14 items-center gap-2.5 border-b border-white/10 px-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-black">
            <Shield size={16} />
          </div>
          <div>
            <span className="text-sm font-semibold text-white">BizVentas</span>
            <span className="ml-1 rounded bg-red-600 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">Admin</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="ml-auto text-white/50 lg:hidden">
            <X size={20} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-2">
          {sections.map((section) => (
            <div key={section.title || '_top'} className="mb-1">
              {section.title && (
                <div className="mb-1 mt-4 px-3 text-[10px] font-semibold uppercase tracking-wider text-white/40">
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
                          ? 'bg-white text-black'
                          : 'text-white/80 hover:bg-white/10',
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

        {/* User */}
        <div className="border-t border-white/10 p-3">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-600 text-white text-xs font-bold">
              SA
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.nombre}</p>
              <p className="text-[11px] text-white/50 truncate">Super Admin</p>
            </div>
            <button
              onClick={handleLogout}
              className="text-white/50 hover:text-white transition-colors"
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
            <span className="text-muted-foreground">Super Admin</span>
            {currentPage && currentPage !== 'Dashboard Global' && (
              <>
                <ChevronRight size={14} className="text-muted-foreground" />
                <span className="font-medium">{currentPage}</span>
              </>
            )}
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-2">
            <span className="rounded bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">Super Admin</span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
