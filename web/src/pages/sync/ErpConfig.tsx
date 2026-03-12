import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, Loader2, TestTube, CheckCircle, XCircle, Code } from 'lucide-react'
import { toast } from 'sonner'
import api from '../../api/client'
import { cn } from '../../lib/utils'

interface TenantData {
  id: string
  erpTipo: string
  erpUrl: string | null
  erpCredenciales: Record<string, string> | null
  erpMapping: Record<string, Record<string, string>> | null
}

const erpTypes = [
  { value: 'standalone', label: 'Standalone (sin ERP externo)', description: 'El sistema opera de forma independiente' },
  { value: 'sap_b1', label: 'SAP Business One', description: 'Sincronización con SAP B1 via Service Layer' },
  { value: 'tango', label: 'Tango Gestión', description: 'Sincronización con Tango via API REST' },
  { value: 'custom', label: 'API Custom', description: 'Conexión con API genérica configurada' },
]

const defaultMappingEntities = ['productos', 'clientes', 'pedidos', 'cobranzas']

export default function ErpConfig() {
  const queryClient = useQueryClient()
  const [erpTipo, setErpTipo] = useState('standalone')
  const [erpUrl, setErpUrl] = useState('')
  const [erpCredenciales, setErpCredenciales] = useState<Record<string, string>>({
    user: '', password: '', db: '',
  })
  const [erpMapping, setErpMapping] = useState<Record<string, Record<string, string>>>({})
  const [showMappingJson, setShowMappingJson] = useState(false)
  const [mappingJson, setMappingJson] = useState('')
  const [testResult, setTestResult] = useState<boolean | null>(null)

  const { isLoading } = useQuery({
    queryKey: ['tenant-erp-config'],
    queryFn: async () => {
      // Get tenant info to read ERP config
      const { data: res } = await api.get('/admin/tenants')
      // Use the first tenant (admin is scoped to their tenant)
      const tenants = res.data as TenantData[]
      if (tenants.length > 0) {
        const t = tenants[0]
        setErpTipo(t.erpTipo || 'standalone')
        setErpUrl(t.erpUrl || '')
        if (t.erpCredenciales && typeof t.erpCredenciales === 'object') {
          setErpCredenciales({ user: '', password: '', db: '', ...t.erpCredenciales })
        }
        if (t.erpMapping && typeof t.erpMapping === 'object') {
          setErpMapping(t.erpMapping as Record<string, Record<string, string>>)
          setMappingJson(JSON.stringify(t.erpMapping, null, 2))
        }
        return t
      }
      return null
    },
  })

  useEffect(() => {
    setMappingJson(JSON.stringify(erpMapping, null, 2))
  }, [erpMapping])

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Get tenant id
      const { data: tenants } = await api.get('/admin/tenants')
      const tenantId = tenants.data[0]?.id
      if (!tenantId) throw new Error('No tenant found')

      // Parse mapping JSON if in JSON mode
      let finalMapping = erpMapping
      if (showMappingJson) {
        try {
          finalMapping = JSON.parse(mappingJson)
        } catch {
          throw new Error('JSON de mapeo inválido')
        }
      }

      return api.put(`/admin/tenants/${tenantId}`, {
        erpTipo,
        erpUrl: erpUrl || null,
        erpCredenciales: erpTipo !== 'standalone' ? erpCredenciales : null,
        erpMapping: Object.keys(finalMapping).length > 0 ? finalMapping : null,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-erp-config'] })
      toast.success('Configuración ERP guardada')
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : 'Error al guardar'
      toast.error(msg)
    },
  })

  const testMutation = useMutation({
    mutationFn: () => api.post('/admin/sync/test-erp'),
    onSuccess: (res) => {
      const connected = res.data?.data?.connected
      setTestResult(connected)
      toast.success(connected ? 'Conexión exitosa' : 'No se pudo conectar')
    },
    onError: () => {
      setTestResult(false)
      toast.error('Error de conexión al ERP')
    },
  })

  const handleMappingFieldChange = (entity: string, localField: string, erpField: string) => {
    setErpMapping((prev) => ({
      ...prev,
      [entity]: {
        ...(prev[entity] || {}),
        [localField]: erpField,
      },
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    saveMutation.mutate()
  }

  if (isLoading) return <div className="flex items-center justify-center p-12 text-muted-foreground">Cargando...</div>

  const inputCls = 'h-10 w-full rounded-lg border border-input px-3 text-sm outline-none focus:ring-2 focus:ring-ring'

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Conexión ERP</h1>
        <p className="text-sm text-muted-foreground">Configurar la conexión con el sistema ERP externo</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Tipo de ERP */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 font-semibold">Tipo de ERP</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {erpTypes.map((type) => (
              <button
                key={type.value}
                type="button"
                onClick={() => setErpTipo(type.value)}
                className={cn(
                  'rounded-lg border p-4 text-left transition-colors',
                  erpTipo === type.value
                    ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                    : 'border-border hover:border-primary/50',
                )}
              >
                <span className={cn('text-sm font-medium', erpTipo === type.value && 'text-primary')}>
                  {type.label}
                </span>
                <p className="mt-0.5 text-xs text-muted-foreground">{type.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Credenciales */}
        {erpTipo !== 'standalone' && (
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <h2 className="font-semibold">Credenciales</h2>

            <div>
              <label className="mb-1.5 block text-sm font-medium">URL del ERP</label>
              <input
                type="url"
                value={erpUrl}
                onChange={(e) => setErpUrl(e.target.value)}
                placeholder="https://erp.empresa.com:50000"
                className={inputCls}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Usuario</label>
                <input
                  type="text"
                  value={erpCredenciales.user || ''}
                  onChange={(e) => setErpCredenciales({ ...erpCredenciales, user: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Contraseña</label>
                <input
                  type="password"
                  value={erpCredenciales.password || ''}
                  onChange={(e) => setErpCredenciales({ ...erpCredenciales, password: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Base de datos</label>
                <input
                  type="text"
                  value={erpCredenciales.db || ''}
                  onChange={(e) => setErpCredenciales({ ...erpCredenciales, db: e.target.value })}
                  placeholder="SBO_EMPRESA"
                  className={inputCls}
                />
              </div>
            </div>

            {/* Test conexión */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => testMutation.mutate()}
                disabled={testMutation.isPending}
                className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
              >
                {testMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <TestTube size={14} />}
                Probar Conexión
              </button>
              {testResult === true && (
                <span className="flex items-center gap-1 text-sm text-success"><CheckCircle size={14} /> Conectado</span>
              )}
              {testResult === false && (
                <span className="flex items-center gap-1 text-sm text-destructive"><XCircle size={14} /> Falló</span>
              )}
            </div>
          </div>
        )}

        {/* Mapeo de campos */}
        {erpTipo !== 'standalone' && (
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Mapeo de Campos</h2>
              <button
                type="button"
                onClick={() => setShowMappingJson(!showMappingJson)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <Code size={12} />
                {showMappingJson ? 'Vista tabla' : 'Vista JSON'}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Definí cómo se mapean los campos locales a los campos del ERP. Dejá vacío para usar el nombre original.
            </p>

            {showMappingJson ? (
              <textarea
                value={mappingJson}
                onChange={(e) => setMappingJson(e.target.value)}
                rows={16}
                className="w-full rounded-lg border border-input bg-muted/30 p-3 font-mono text-xs outline-none focus:ring-2 focus:ring-ring"
                placeholder='{\n  "productos": {\n    "codigo": "ItemCode",\n    "nombre": "ItemName"\n  }\n}'
              />
            ) : (
              <div className="space-y-4">
                {defaultMappingEntities.map((entity) => {
                  const localFields = getLocalFields(entity)
                  const currentMapping = erpMapping[entity] || {}
                  return (
                    <div key={entity}>
                      <h3 className="mb-2 text-sm font-medium capitalize">{entity}</h3>
                      <div className="rounded-lg border border-border overflow-hidden">
                        <div className="grid grid-cols-2 gap-0 border-b border-border bg-muted/50 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                          <span>Campo local</span>
                          <span>Campo ERP</span>
                        </div>
                        {localFields.map((field) => (
                          <div key={field} className="grid grid-cols-2 gap-0 border-b border-border last:border-0 px-3 py-1.5 items-center">
                            <span className="text-sm">{field}</span>
                            <input
                              type="text"
                              value={currentMapping[field] || ''}
                              onChange={(e) => handleMappingFieldChange(entity, field, e.target.value)}
                              placeholder={field}
                              className="h-7 rounded border border-input bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-ring"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Guardar */}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saveMutation.isPending}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {saveMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Guardar configuración
          </button>
        </div>
      </form>
    </div>
  )
}

function getLocalFields(entity: string): string[] {
  const fields: Record<string, string[]> = {
    productos: ['codigo', 'nombre', 'descripcion', 'categoria', 'marca', 'precioLista', 'moneda', 'stockBulto', 'stockUnidad', 'equivalencia', 'unidadMedida', 'ivaPorcentaje', 'codigoBarras'],
    clientes: ['codigo', 'nombre', 'cuit', 'condicionIva', 'condicionVenta', 'direccion', 'ciudad', 'provincia', 'telefono', 'email', 'limiteCredito'],
    pedidos: ['clienteId', 'fecha', 'total', 'estado', 'items'],
    cobranzas: ['clienteId', 'fecha', 'total', 'medios'],
  }
  return fields[entity] || []
}
