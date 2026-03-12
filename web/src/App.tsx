import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import DashboardLayout from './layouts/DashboardLayout'
import SuperAdminLayout from './layouts/SuperAdminLayout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import ImportWizard from './pages/import/ImportWizard'
import ProductosList from './pages/productos/ProductosList'
import ClientesList from './pages/clientes/ClientesList'
import PedidosList from './pages/pedidos/PedidosList'
import CobranzasList from './pages/cobranzas/CobranzasList'
import FacturasCrud from './pages/facturas/FacturasCrud'
import DevolucionesList from './pages/devoluciones/DevolucionesList'
import SyncStatus from './pages/sync/SyncStatus'
import ErpConfig from './pages/sync/ErpConfig'
import WhiteLabel from './pages/config/WhiteLabel'
import Politicas from './pages/config/Politicas'
import JornadaConfig from './pages/config/JornadaConfig'
import MediosPago from './pages/config/MediosPago'
import General from './pages/config/General'
import UsersList from './pages/users/UsersList'
import VendedorDetail from './pages/vendedores/VendedorDetail'
import MapaVendedores from './pages/vendedores/MapaVendedores'
import VentasPorVendedor from './pages/reportes/VentasPorVendedor'
import CuentaCorriente from './pages/reportes/CuentaCorriente'
import Objetivos from './pages/reportes/Objetivos'
import Intercambio from './pages/intercambio/Intercambio'
import InterConfig from './pages/intercambio/InterConfig'
import ImpersonateBar from './pages/super/ImpersonateBar'

// Super Admin pages
import SuperDashboard from './pages/super/SuperDashboard'
import TenantsList from './pages/super/TenantsList'
import TenantCreate from './pages/super/TenantCreate'
import TenantDetail from './pages/super/TenantDetail'
import Billing from './pages/super/Billing'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuth()
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  const { user, isImpersonating } = useAuth()
  const isSuperAdmin = user?.role === 'super_admin'

  return (
    <>
      {/* Barra roja de impersonate */}
      {isImpersonating && <ImpersonateBar />}

      <Routes>
        <Route path="/login" element={<Login />} />

        {/* Rutas Super Admin */}
        <Route
          path="/super"
          element={
            <PrivateRoute>
              {isSuperAdmin ? <SuperAdminLayout /> : <Navigate to="/" replace />}
            </PrivateRoute>
          }
        >
          <Route index element={<SuperDashboard />} />
          <Route path="tenants" element={<TenantsList />} />
          <Route path="tenants/new" element={<TenantCreate />} />
          <Route path="tenants/:id" element={<TenantDetail />} />
          <Route path="billing" element={<Billing />} />
          {/* Placeholder pages para links futuros */}
          <Route path="activity" element={<PlaceholderPage title="Actividad Global" />} />
          <Route path="sync" element={<PlaceholderPage title="Sync Status Global" />} />
          <Route path="storage" element={<PlaceholderPage title="Almacenamiento" />} />
          <Route path="account" element={<PlaceholderPage title="Mi Cuenta" />} />
          <Route path="logs" element={<PlaceholderPage title="Logs del Sistema" />} />
        </Route>

        {/* Rutas Tenant Admin */}
        <Route
          path="/"
          element={
            <PrivateRoute>
              <DashboardLayout />
            </PrivateRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="importar" element={<ImportWizard />} />
          <Route path="productos" element={<ProductosList />} />
          <Route path="clientes" element={<ClientesList />} />
          <Route path="pedidos" element={<PedidosList />} />
          <Route path="cobranzas" element={<CobranzasList />} />
          <Route path="facturas" element={<FacturasCrud />} />
          <Route path="devoluciones" element={<DevolucionesList />} />
          <Route path="intercambio" element={<Intercambio />} />
          <Route path="intercambio/config" element={<InterConfig />} />
          <Route path="sync" element={<SyncStatus />} />
          <Route path="sync/erp" element={<ErpConfig />} />
          <Route path="config/white-label" element={<WhiteLabel />} />
          <Route path="config/politicas" element={<Politicas />} />
          <Route path="config/jornada" element={<JornadaConfig />} />
          <Route path="config/medios-pago" element={<MediosPago />} />
          <Route path="config/general" element={<General />} />
          <Route path="usuarios" element={<UsersList />} />
          <Route path="vendedores/:id" element={<VendedorDetail />} />
          <Route path="vendedores/mapa" element={<MapaVendedores />} />
          <Route path="reportes/ventas" element={<VentasPorVendedor />} />
          <Route path="reportes/cuenta-corriente" element={<CuentaCorriente />} />
          <Route path="reportes/objetivos" element={<Objetivos />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex h-64 flex-col items-center justify-center text-center">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Próximamente</p>
    </div>
  )
}
