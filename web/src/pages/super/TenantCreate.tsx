import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, CheckCircle, Loader2, Building2, Copy } from 'lucide-react'
import { toast } from 'sonner'
import api from '../../api/client'
import { cn } from '../../lib/utils'

const steps = ['Datos de la Empresa', 'Plan y Módulos', 'Usuario Admin']

interface FormData {
  razonSocial: string
  codigo: string
  cuit: string
  email: string
  contactoNombre: string
  contactoTelefono: string
  contactoEmail: string
  notas: string
  plan: string
  maxVendedores: number
  moduloGps: boolean
  moduloMp: boolean
  moduloFirma: boolean
  moduloEmail: boolean
  planPrecio: number
  planMoneda: string
  planPeriodicidad: string
  adminNombre: string
  adminEmail: string
  adminPassword: string
}

const planDefaults: Record<string, { maxVendedores: number; gps: boolean; mp: boolean; firma: boolean; email: boolean; precio: number }> = {
  starter: { maxVendedores: 3, gps: false, mp: false, firma: false, email: false, precio: 29 },
  profesional: { maxVendedores: 10, gps: true, mp: true, firma: true, email: true, precio: 79 },
  enterprise: { maxVendedores: 50, gps: true, mp: true, firma: true, email: true, precio: 199 },
}

function generatePassword() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let pw = ''
  for (let i = 0; i < 10; i++) pw += chars[Math.floor(Math.random() * chars.length)]
  return pw
}

function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 30)
}

export default function TenantCreate() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [creating, setCreating] = useState(false)
  const [result, setResult] = useState<{ tenant: { codigo: string; razonSocial: string }; adminUser: { email: string } } | null>(null)

  const [form, setForm] = useState<FormData>({
    razonSocial: '', codigo: '', cuit: '', email: '',
    contactoNombre: '', contactoTelefono: '', contactoEmail: '', notas: '',
    plan: 'profesional', maxVendedores: 10,
    moduloGps: true, moduloMp: true, moduloFirma: true, moduloEmail: true,
    planPrecio: 79, planMoneda: 'USD', planPeriodicidad: 'mensual',
    adminNombre: '', adminEmail: '', adminPassword: generatePassword(),
  })

  const set = (field: keyof FormData, value: unknown) => setForm((f) => ({ ...f, [field]: value }))

  const handleRazonSocialChange = (val: string) => {
    set('razonSocial', val)
    if (!form.codigo || form.codigo === slugify(form.razonSocial)) {
      set('codigo', slugify(val))
    }
  }

  const handlePlanChange = (plan: string) => {
    const d = planDefaults[plan]
    if (d) {
      setForm((f) => ({
        ...f, plan,
        maxVendedores: d.maxVendedores,
        moduloGps: d.gps, moduloMp: d.mp, moduloFirma: d.firma, moduloEmail: d.email,
        planPrecio: d.precio,
      }))
    } else {
      set('plan', plan)
    }
  }

  const canNext = () => {
    if (step === 0) return form.razonSocial.trim() && form.codigo.trim() && form.email.trim()
    if (step === 1) return true
    if (step === 2) return form.adminNombre.trim() && form.adminEmail.trim() && form.adminPassword.trim()
    return false
  }

  const handleCreate = async () => {
    setCreating(true)
    try {
      const { data: res } = await api.post('/super/tenants', form)
      setResult(res.data)
      toast.success('Empresa creada exitosamente')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message || 'Error al crear empresa'
      toast.error(msg)
    } finally {
      setCreating(false)
    }
  }

  if (result) {
    return (
      <div className="mx-auto max-w-lg space-y-6">
        <div className="flex flex-col items-center rounded-xl border border-border bg-card p-8 text-center">
          <CheckCircle size={48} className="mb-4 text-success" />
          <h2 className="text-xl font-semibold">Empresa creada</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            <strong>{result.tenant.razonSocial}</strong> está lista para usar.
          </p>
          <div className="mt-6 w-full space-y-3 rounded-lg bg-muted/50 p-4 text-left text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Código de empresa:</span>
              <span className="font-medium">{result.tenant.codigo}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Email admin:</span>
              <span className="font-medium">{result.adminUser.email}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Contraseña:</span>
              <div className="flex items-center gap-1.5">
                <span className="font-mono font-medium">{form.adminPassword}</span>
                <button
                  onClick={() => { navigator.clipboard.writeText(form.adminPassword); toast.success('Copiada') }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Copy size={14} />
                </button>
              </div>
            </div>
          </div>
          <div className="mt-6 flex gap-3">
            <button
              onClick={() => navigate('/super/tenants')}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
            >
              Ir a Empresas
            </button>
            <button
              onClick={() => { setResult(null); setStep(0); setForm({ ...form, razonSocial: '', codigo: '', cuit: '', email: '', contactoNombre: '', contactoTelefono: '', contactoEmail: '', notas: '', adminNombre: '', adminEmail: '', adminPassword: generatePassword() }) }}
              className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-black/90 transition-colors"
            >
              Crear otra empresa
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Crear Empresa</h1>
        <p className="text-sm text-muted-foreground">Configurá una nueva empresa en BizVentas</p>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2">
        {steps.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition-colors',
              i === step ? 'bg-black text-white' : i < step ? 'bg-success text-white' : 'bg-muted text-muted-foreground',
            )}>
              {i < step ? <CheckCircle size={14} /> : i + 1}
            </div>
            <span className={cn('hidden text-sm sm:inline', i === step ? 'font-medium' : 'text-muted-foreground')}>{label}</span>
            {i < steps.length - 1 && <div className="mx-1 h-px w-6 bg-border sm:w-10" />}
          </div>
        ))}
      </div>

      {/* Contenido */}
      <div className="rounded-xl border border-border bg-card p-6">
        {/* Paso 1: Datos */}
        {step === 0 && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm font-medium">Razón Social *</label>
                <input type="text" value={form.razonSocial} onChange={(e) => handleRazonSocialChange(e.target.value)} placeholder="Nueva Empresa S.A." className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Código único *</label>
                <input type="text" value={form.codigo} onChange={(e) => set('codigo', e.target.value)} placeholder="nueva-empresa" className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-mono outline-none focus:ring-2 focus:ring-ring" />
                <p className="mt-1 text-[11px] text-muted-foreground">Se usa para login. Sin espacios ni caracteres especiales.</p>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">CUIT</label>
                <input type="text" value={form.cuit} onChange={(e) => set('cuit', e.target.value)} placeholder="30-12345678-9" className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm font-medium">Email de la empresa *</label>
                <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="info@empresa.com" className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <h3 className="mb-3 text-sm font-semibold text-muted-foreground">Contacto</h3>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Nombre</label>
                  <input type="text" value={form.contactoNombre} onChange={(e) => set('contactoNombre', e.target.value)} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Teléfono</label>
                  <input type="text" value={form.contactoTelefono} onChange={(e) => set('contactoTelefono', e.target.value)} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Email</label>
                  <input type="email" value={form.contactoEmail} onChange={(e) => set('contactoEmail', e.target.value)} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
                </div>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">Notas internas</label>
              <textarea value={form.notas} onChange={(e) => set('notas', e.target.value)} rows={3} placeholder="Notas privadas sobre este cliente..." className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring resize-none" />
            </div>
          </div>
        )}

        {/* Paso 2: Plan y Módulos */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h3 className="mb-3 text-sm font-semibold">Plan</h3>
              <div className="grid gap-3 sm:grid-cols-3">
                {Object.entries(planDefaults).map(([key, def]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handlePlanChange(key)}
                    className={cn(
                      'rounded-lg border-2 p-4 text-left transition-colors',
                      form.plan === key ? 'border-black bg-black/5' : 'border-border hover:border-muted-foreground',
                    )}
                  >
                    <p className="font-semibold capitalize">{key}</p>
                    <p className="mt-1 text-xl font-bold">${def.precio}<span className="text-sm font-normal text-muted-foreground">/mes</span></p>
                    <p className="mt-1 text-xs text-muted-foreground">Hasta {def.maxVendedores} vendedores</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="mb-3 text-sm font-semibold">Módulos</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { key: 'moduloGps' as const, label: 'GPS / Tracking', desc: 'Seguimiento en tiempo real de vendedores' },
                  { key: 'moduloMp' as const, label: 'Mercado Pago', desc: 'Cobros con QR y link de pago' },
                  { key: 'moduloFirma' as const, label: 'Firma Digital', desc: 'Firma del cliente en pedidos' },
                  { key: 'moduloEmail' as const, label: 'Emails', desc: 'Envío de comprobantes por email' },
                ].map((mod) => (
                  <label key={mod.key} className="flex items-start gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-muted/30 transition-colors">
                    <input
                      type="checkbox"
                      checked={form[mod.key]}
                      onChange={(e) => set(mod.key, e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-input accent-black"
                    />
                    <div>
                      <p className="text-sm font-medium">{mod.label}</p>
                      <p className="text-xs text-muted-foreground">{mod.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Máx. Vendedores</label>
                <input type="number" value={form.maxVendedores} onChange={(e) => set('maxVendedores', Number(e.target.value))} min={1} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Precio</label>
                <input type="number" value={form.planPrecio} onChange={(e) => set('planPrecio', Number(e.target.value))} min={0} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Periodicidad</label>
                <select value={form.planPeriodicidad} onChange={(e) => set('planPeriodicidad', e.target.value)} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring">
                  <option value="mensual">Mensual</option>
                  <option value="anual">Anual</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Paso 3: Admin */}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Credenciales del administrador de la empresa.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm font-medium">Nombre del admin *</label>
                <input type="text" value={form.adminNombre} onChange={(e) => set('adminNombre', e.target.value)} placeholder="Juan Pérez" className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Email del admin *</label>
                <input type="email" value={form.adminEmail} onChange={(e) => set('adminEmail', e.target.value)} placeholder="admin@empresa.com" className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Contraseña temporal *</label>
                <div className="flex gap-2">
                  <input type="text" value={form.adminPassword} onChange={(e) => set('adminPassword', e.target.value)} className="h-10 flex-1 rounded-lg border border-input bg-background px-3 text-sm font-mono outline-none focus:ring-2 focus:ring-ring" />
                  <button type="button" onClick={() => set('adminPassword', generatePassword())} className="h-10 rounded-lg border border-border px-3 text-xs font-medium hover:bg-muted transition-colors">
                    Generar
                  </button>
                </div>
              </div>
            </div>

            {/* Preview */}
            <div className="mt-6 rounded-lg bg-muted/50 p-4">
              <h3 className="mb-2 text-sm font-semibold">Resumen</h3>
              <div className="space-y-1 text-sm">
                <p>Se creará <strong>{form.razonSocial}</strong> (código: <code className="rounded bg-muted px-1 font-mono text-xs">{form.codigo}</code>)</p>
                <p>Plan: <strong className="capitalize">{form.plan}</strong> — ${form.planPrecio}/{form.planPeriodicidad === 'mensual' ? 'mes' : 'año'}</p>
                <p>Admin: <strong>{form.adminNombre}</strong> ({form.adminEmail})</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navegación */}
      <div className="flex justify-between">
        <button
          onClick={() => setStep((s) => s - 1)}
          disabled={step === 0}
          className="flex items-center gap-1 rounded-lg border border-border px-4 py-2 text-sm font-medium disabled:opacity-50 hover:bg-muted transition-colors"
        >
          <ChevronLeft size={16} /> Anterior
        </button>
        {step === 2 ? (
          <button
            onClick={handleCreate}
            disabled={!canNext() || creating}
            className="flex items-center gap-1.5 rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 hover:bg-black/90 transition-colors"
          >
            {creating ? <Loader2 size={16} className="animate-spin" /> : <Building2 size={16} />}
            Crear Empresa
          </button>
        ) : (
          <button
            onClick={() => setStep((s) => s + 1)}
            disabled={!canNext()}
            className="flex items-center gap-1 rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 hover:bg-black/90 transition-colors"
          >
            Siguiente <ChevronRight size={16} />
          </button>
        )}
      </div>
    </div>
  )
}
