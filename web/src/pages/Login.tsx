import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { LogIn, Loader2, Shield } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '../lib/utils'

export default function Login() {
  const { login, superLogin } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [isSuperMode, setIsSuperMode] = useState(false)
  const [form, setForm] = useState({ tenantCodigo: '', email: '', password: '' })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      if (isSuperMode) {
        await superLogin({ email: form.email, password: form.password })
        navigate('/super')
      } else {
        await login(form)
        navigate('/')
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message || 'Error al iniciar sesión'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className={cn(
            'mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl font-bold text-xl transition-colors',
            isSuperMode ? 'bg-black text-white' : 'bg-primary text-primary-foreground',
          )}>
            {isSuperMode ? <Shield size={28} /> : 'BV'}
          </div>
          <h1 className="text-2xl font-bold">BizVentas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isSuperMode ? 'Super Administrador' : 'Panel de Administración'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className={cn(
          'space-y-4 rounded-xl border bg-card p-6 shadow-sm',
          isSuperMode ? 'border-black/20' : 'border-border',
        )}>
          {!isSuperMode && (
            <div>
              <label className="mb-1.5 block text-sm font-medium">Código de empresa</label>
              <input
                type="text"
                required
                value={form.tenantCodigo}
                onChange={(e) => setForm({ ...form, tenantCodigo: e.target.value })}
                placeholder="ej: demo"
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          )}
          <div>
            <label className="mb-1.5 block text-sm font-medium">Email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder={isSuperMode ? 'superadmin@bizventas.com' : 'admin@empresa.com'}
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Contraseña</label>
            <input
              type="password"
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className={cn(
              'flex h-10 w-full items-center justify-center gap-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors',
              isSuperMode
                ? 'bg-black text-white hover:bg-black/90'
                : 'bg-primary text-primary-foreground hover:bg-primary/90',
            )}
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
            Iniciar sesión
          </button>
        </form>

        <button
          type="button"
          onClick={() => setIsSuperMode(!isSuperMode)}
          className="mt-4 flex w-full items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Shield size={12} />
          {isSuperMode ? 'Volver al login de empresa' : 'Acceso Super Admin'}
        </button>
      </div>
    </div>
  )
}
