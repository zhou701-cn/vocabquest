import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { setLanguage, SUPPORTED_LANGUAGES, type AppLanguage } from '@/i18n'

interface LanguageSwitcherProps {
  className?: string
}

/**
 * 语言切换器：EN / 中文。
 * 切换时写入 localStorage；若已登录则同步到 profile.preferences.language。
 */
export function LanguageSwitcher({ className }: LanguageSwitcherProps) {
  const { i18n } = useTranslation()
  const { profile, updateProfile } = useAuth()

  const current: AppLanguage = (i18n.language || 'en').startsWith('zh') ? 'zh' : 'en'

  const change = async (lng: AppLanguage) => {
    if (lng === current) return
    setLanguage(lng)
    if (profile) {
      try {
        await updateProfile({
          preferences: { ...(profile.preferences || {}), language: lng },
        })
      } catch {
        // 语言已在本地切换，profile 同步失败可忽略
      }
    }
  }

  return (
    <div className={`inline-flex rounded-lg bg-gray-100 p-0.5 ${className || ''}`}>
      {SUPPORTED_LANGUAGES.map((lng) => (
        <button
          key={lng}
          type="button"
          onClick={() => change(lng)}
          className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
            current === lng
              ? 'bg-white text-gray-800 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          aria-pressed={current === lng}
        >
          {lng === 'en' ? 'EN' : '中文'}
        </button>
      ))}
    </div>
  )
}
