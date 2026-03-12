import { useAuth } from '../../hooks/useAuth'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export default function ImpersonateBar() {
  const { user, isImpersonating, exitImpersonate } = useAuth()
  const navigate = useNavigate()

  if (!isImpersonating) return null

  const handleExit = () => {
    exitImpersonate()
    navigate('/super')
  }

  return (
    <div className="flex items-center justify-between bg-red-600 px-4 py-2 text-sm text-white">
      <span>
        Estás viendo como: <strong>{user?.tenantCodigo}</strong> — {user?.email}
      </span>
      <button
        onClick={handleExit}
        className="flex items-center gap-1.5 rounded-md bg-white/20 px-3 py-1 text-xs font-medium hover:bg-white/30 transition-colors"
      >
        <ArrowLeft size={14} />
        Volver a Super Admin
      </button>
    </div>
  )
}
