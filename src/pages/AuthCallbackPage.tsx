import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { readAuthSession } from '@/lib/api'
import { LoadingSpinner } from '@/components/LoadingSpinner'

/**
 * 兼容保留页：自建后端注册即时生效，不再有邮箱确认回调。
 * 已登录 → /dashboard，未登录 → /auth。
 */
export function AuthCallbackPage() {
  const navigate = useNavigate()

  useEffect(() => {
    const session = readAuthSession()
    navigate(session ? '/dashboard' : '/auth', { replace: true })
  }, [navigate])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-orange-50">
      <div className="text-center">
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-gray-600">Redirecting...</p>
      </div>
    </div>
  )
}
