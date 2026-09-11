import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import zh from './locales/zh.json'

export const SUPPORTED_LANGUAGES = ['en', 'zh'] as const
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number]

export const LANGUAGE_STORAGE_KEY = 'i18nextLng'

function isAppLanguage(value: unknown): value is AppLanguage {
  return value === 'en' || value === 'zh'
}

function getInitialLanguage(): AppLanguage {
  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY)
    if (isAppLanguage(stored)) return stored
  } catch {
    // ignore storage access errors
  }
  // 默认英文
  return 'en'
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    zh: { translation: zh },
  },
  lng: getInitialLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})

function syncHtmlLang(lng: string) {
  document.documentElement.lang = isAppLanguage(lng) ? lng : 'en'
}

syncHtmlLang(i18n.language)
i18n.on('languageChanged', syncHtmlLang)

/**
 * 切换语言并持久化到 localStorage。
 * 登录态下的 profile 同步在 LanguageSwitcher 中处理。
 */
export function setLanguage(lng: AppLanguage) {
  if (!isAppLanguage(lng)) return
  i18n.changeLanguage(lng)
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lng)
  } catch {
    // ignore storage access errors
  }
}

/** 根据已登录用户的 profile 偏好应用语言（登录后调用） */
export function applyPreferredLanguage(preferences?: Record<string, any> | null) {
  const lang = preferences?.language
  if (isAppLanguage(lang)) {
    i18n.changeLanguage(lang)
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, lang)
    } catch {
      // ignore
    }
  }
}

export default i18n
