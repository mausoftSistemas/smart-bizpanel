import { useState } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import {
  LayoutDashboard,
  Banknote,
  ClipboardCheck,
  Users,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Vault,
} from 'lucide-react'
import { cn } from '../lib/utils'

const navItems = [
  { label: 'Dashboard Caja', to: '/tesoreria', icon: <LayoutDashboard size={18} />, end: true },
  { label: 'Cobranzas', to: '/tesoreria/cobranzas', icon: <Banknote size={18} /> },
  { label: 'Rendiciones', to: '/tesoreria/rendiciones', icon: <ClipboardCheck size={18} /> },
  { label: 'Vendedores', to: '/tesoreria/vendedores', icon: <Users size={18} /> },
]

const breadcrumbMap: Record<string, string> = {
  '/tesoreria': 'Dashboard Caja',
  '/tesoreria/cobranzas': 'Cobranzas',
  '/tesoreria/rendiciones': 'Rendiciones',
  '/tesoreria/vendedores': 'Vendedores',
}

export default function TesoreroLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  let currentPage = breadcrumbMap[location.pathname] || ''
  if (!currentPage && location.pathname.startsWith('/tesoreria/cobranzas/')) currentPage = 'Detalle Cobranza'
  if (!currentPage && location.pathname.startsWith('/tesoreria/rendiciones/')) currentPage = 'Detalle Rendicion'
  if (!currentPage && location.pathname.startsWith('/tesoreria/vendedores/')) currentPage = 'Detalle Vendedor'

  return (
    <div className="flex h-screen overflow-hidden">
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-60 flex-col bg-slate-900 transition-transform lg:static lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-14 items-center gap-2.5 border-b border-white/10 px-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-600 text-white">
            <Vault size={16} />
          </div>
          <div>
            <span className="text-sm font-semibold text-white">BizVentas</span>
            <span className="ml-1 rounded bg-teal-600 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">Tesorero</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="ml-auto text-white/50 lg:hidden">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="space-y-0.5">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                    isActive
                      ? 'bg-white text-slate-900'
                      : 'text-white/80 hover:bg-white/10',
                  )
                }
              >
                {item.icon}
                {item.label}
              </NavLink>
            ))}
          </div>
        </nav>

        <div className="border-t border-white/10 p-3">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-600 text-white text-xs font-bold">
              TE
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.nombre}</p>
              <p className="text-[11px] text-white/50 truncate">Tesorero</p>
            </div>
            <button
              onClick={handleLogout}
              className="text-white/50 hover:text-white transition-colors"
              title="Cerrar sesion"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center gap-4 border-b border-border bg-card px-4 lg:px-6">
          <button onClick={() => setSidebarOpen(true)} className="text-muted-foreground lg:hidden">
            <Menu size={20} />
          </button>

          <div className="flex items-center gap-1.5 text-sm">
            <span className="text-muted-foreground">Tesoreria</span>
            {currentPage && currentPage !== 'Dashboard Caja' && (
              <>
                <ChevronRight size={14} className="text-muted-foreground" />
                <span className="font-medium">{currentPage}</span>
              </>
            )}
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-2">
            <span className="rounded bg-teal-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">Tesorero</span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
