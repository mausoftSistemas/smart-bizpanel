import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { User, Lock, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import api from '../../api/client'

interface SuperAdminProfile {
  id: string
  email: string
  nombre: string
  createdAt: string
  lastLogin: string | null
}

export default function Account() {
  const queryClient = useQueryClient()

  const { data: profile, isLoading } = useQuery({
    queryKey: ['super-me'],
    queryFn: async () => {
      const { data: res } = await api.get('/super/me')
      return res.data as SuperAdminProfile
    },
  })

  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [profileInit, setProfileInit] = useState(false)

  // Inicializar campos cuando llega la data
  if (profile && !profileInit) {
    setNombre(profile.nombre)
    setEmail(profile.email)
    setProfileInit(true)
  }

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const updateProfile = useMutation({
    mutationFn: async () => {
      const { data: res } = await api.put('/super/me', { nombre, email })
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-me'] })
      toast.success('Perfil actualizado')
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message || 'Error al actualizar perfil'
      toast.error(msg)
    },
  })

  const updatePassword = useMutation({
    mutationFn: async () => {
      const { data: res } = await api.put('/super/me', { currentPassword, newPassword })
      return res.data
    },
    onSuccess: () => {
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      toast.success('Contraseña actualizada')
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message || 'Error al cambiar contraseña'
      toast.error(msg)
    },
  })

  const canSubmitPassword = currentPassword && newPassword && newPassword.length >= 6 && newPassword === confirmPassword

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mi Cuenta</h1>
        <p className="text-sm text-muted-foreground">Administrá tu perfil y contraseña</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Perfil */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="mb-4 flex items-center gap-2">
            <User size={20} className="text-primary" />
            <h2 className="text-lg font-semibold">Perfil</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Nombre</label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <button
              onClick={() => updateProfile.mutate()}
              disabled={updateProfile.isPending}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {updateProfile.isPending && <Loader2 size={14} className="animate-spin" />}
              Guardar Cambios
            </button>
          </div>
        </div>

        {/* Contraseña */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="mb-4 flex items-center gap-2">
            <Lock size={20} className="text-primary" />
            <h2 className="text-lg font-semibold">Cambiar Contraseña</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Contraseña Actual</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Nueva Contraseña</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {newPassword && newPassword.length < 6 && (
                <p className="mt-1 text-xs text-red-500">Mínimo 6 caracteres</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Confirmar Contraseña</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {confirmPassword && confirmPassword !== newPassword && (
                <p className="mt-1 text-xs text-red-500">Las contraseñas no coinciden</p>
              )}
            </div>
            <button
              onClick={() => updatePassword.mutate()}
              disabled={!canSubmitPassword || updatePassword.isPending}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {updatePassword.isPending && <Loader2 size={14} className="animate-spin" />}
              Cambiar Contraseña
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
