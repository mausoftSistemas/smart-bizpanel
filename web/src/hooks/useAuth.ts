import { useState, useCallback } from 'react'
import api from '../api/client'

interface User {
  id: string
  email: string
  nombre: string
  rol: string
  tenantId?: string
  tenantCodigo?: string
  role?: string // 'super_admin' para super admins
  impersonated?: boolean
  impersonatedBy?: string
}

interface LoginParams {
  tenantCodigo: string
  email: string
  password: string
}

interface SuperLoginParams {
  email: string
  password: string
}

export function useAuth() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'))
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem('user')
    return stored ? JSON.parse(stored) : null
  })

  const login = useCallback(async (params: LoginParams) => {
    const { data } = await api.post('/auth/login', params)
    const { token: newToken, user: newUser } = data.data
    localStorage.setItem('token', newToken)
    localStorage.setItem('user', JSON.stringify(newUser))
    localStorage.setItem('tenantId', newUser.tenantId)
    setToken(newToken)
    setUser(newUser)
    return newUser
  }, [])

  const superLogin = useCallback(async (params: SuperLoginParams) => {
    const { data } = await api.post('/super/login', params)
    const { token: newToken, user: newUser } = data.data
    localStorage.setItem('token', newToken)
    localStorage.setItem('user', JSON.stringify(newUser))
    localStorage.removeItem('tenantId')
    setToken(newToken)
    setUser(newUser)
    return newUser
  }, [])

  const impersonate = useCallback(async (tenantId: string) => {
    // Guardar token actual de super admin para poder volver
    const currentToken = localStorage.getItem('token')
    const currentUser = localStorage.getItem('user')
    if (currentToken) localStorage.setItem('superToken', currentToken)
    if (currentUser) localStorage.setItem('superUser', currentUser)

    const { data } = await api.post(`/super/tenants/${tenantId}/impersonate`)
    const { token: newToken, tenant, user: impUser } = data.data
    const impersonatedUser: User = {
      ...impUser,
      rol: 'admin',
      tenantId: tenant.id,
      tenantCodigo: tenant.codigo,
      impersonated: true,
    }
    localStorage.setItem('token', newToken)
    localStorage.setItem('user', JSON.stringify(impersonatedUser))
    localStorage.setItem('tenantId', tenant.id)
    setToken(newToken)
    setUser(impersonatedUser)
  }, [])

  const exitImpersonate = useCallback(() => {
    const superToken = localStorage.getItem('superToken')
    const superUser = localStorage.getItem('superUser')
    if (superToken && superUser) {
      localStorage.setItem('token', superToken)
      localStorage.setItem('user', superUser)
      localStorage.removeItem('tenantId')
      localStorage.removeItem('superToken')
      localStorage.removeItem('superUser')
      setToken(superToken)
      setUser(JSON.parse(superUser))
    }
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    localStorage.removeItem('tenantId')
    localStorage.removeItem('superToken')
    localStorage.removeItem('superUser')
    setToken(null)
    setUser(null)
  }, [])

  const isSuperAdmin = user?.role === 'super_admin'
  const isImpersonating = user?.impersonated === true

  return { token, user, login, superLogin, impersonate, exitImpersonate, logout, isSuperAdmin, isImpersonating }
}
