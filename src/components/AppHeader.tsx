import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BookOpen, User, LogOut, Settings } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { getUserNickname, getUserInitial } from '@/lib/userDisplay'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'

/**
 * 全局应用头部导航栏：品牌 Logo + 用户头像下拉菜单。
 * 各页面统一调用，避免重复实现登录态相关的导航。
 */
export function AppHeader() {
  const { t } = useTranslation()
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [showProfileMenu, setShowProfileMenu] = useState(false)

  // 默认用邮箱前缀作为昵称；只有真实设置了 full_name 时才显示名字
  const accountName = getUserNickname(user, profile)
  const initial = getUserInitial(accountName)
  const isAdmin = profile?.role === 'admin' || user?.role === 'admin'

  return (
    <header className="bg-white/80 backdrop-blur-sm border-b border-white/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <button
            onClick={() => navigate('/index')}
            className="flex items-center space-x-3"
            aria-label="Go to home"
          >
            <BookOpen className="w-8 h-8 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-800">NatureSpace</h1>
          </button>

          <div className="relative">
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-medium text-sm">
                {initial}
              </div>
              <span className="text-gray-700 font-medium">
                {accountName}
              </span>
            </button>

            {showProfileMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2">
                <div className="px-4 py-2 flex items-center justify-between">
                  <span className="text-sm text-gray-600">{t('nav.language')}</span>
                  <LanguageSwitcher />
                </div>
                <hr className="my-1" />
                <button
                  onClick={() => navigate('/profile')}
                  className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center space-x-2"
                >
                  <User className="w-4 h-4" />
                  <span>{t('nav.profile')}</span>
                </button>
                {isAdmin && (
                  <button
                    onClick={() => navigate('/admin')}
                    className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center space-x-2 text-blue-600"
                  >
                    <Settings className="w-4 h-4" />
                    <span>{t('nav.admin')}</span>
                  </button>
                )}
                <hr className="my-1" />
                <button
                  onClick={signOut}
                  className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center space-x-2 text-red-600"
                >
                  <LogOut className="w-4 h-4" />
                  <span>{t('nav.signOut')}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
