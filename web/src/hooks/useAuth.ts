import { useState, useCallback } from 'react'
import api from '../api/client'

interface User {
  id: string
  email: string
  nombre: string
  rol: string
  tenantId: string
  tenantCodigo: string
}

interface LoginParams {
  tenantCodigo: string
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

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    localStorage.removeItem('tenantId')
    setToken(null)
    setUser(null)
  }, [])

  return { token, user, login, logout }
}
