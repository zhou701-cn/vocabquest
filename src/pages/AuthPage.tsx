import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { LOCAL_LOGIN_ENABLED, LOCAL_LOGIN_FULL_NAME } from '@/lib/config'
import { apiFetch } from '@/lib/api'
import toast from 'react-hot-toast'
import { BookOpen, Sparkles, Zap } from 'lucide-react'
import { motion } from 'framer-motion'

export function AuthPage() {
  const { t } = useTranslation()
  const { user, signIn, signUp, localSignIn, loading } = useAuth()
  const [isSignUp, setIsSignUp] = useState(false)
  const [isReset, setIsReset] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLocalSigningIn, setIsLocalSigningIn] = useState(false)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (user) {
    return <Navigate to="/dashboard" replace />
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return

    setIsSubmitting(true)
    try {
      if (isSignUp) {
        await signUp(email, password)
      } else {
        await signIn(email, password)
      }
    } catch (error) {
      console.error('Auth error:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleLocalSignIn = async () => {
    setIsLocalSigningIn(true)
    try {
      await localSignIn()
      // Success: AuthContext updates `user`, and the <Navigate> below
      // redirects to the dashboard.
    } catch (error) {
      console.error('Local sign-in error:', error)
    } finally {
      setIsLocalSigningIn(false)
    }
  }

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !newPassword || !confirmPassword) return
    if (newPassword.length < 6) {
      toast.error(t('auth.passwordTooShort'))
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error(t('auth.passwordMismatch'))
      return
    }

    setIsSubmitting(true)
    try {
      await apiFetch('/auth/reset-password', {
        method: 'POST',
        body: { email, newPassword, confirmPassword },
      })
      toast.success(t('auth.passwordResetSuccess'))
      setIsReset(false)
      setNewPassword('')
      setConfirmPassword('')
    } catch (error) {
      console.error('Reset error:', error)
      toast.error((error as Error).message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-orange-50 relative">
      <div className="absolute top-4 right-4 z-10">
        <LanguageSwitcher />
      </div>

      <div className="flex min-h-screen">
        {/* Left Side - Hero Section */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-lg text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="flex items-center justify-center mb-8">
                <div className="relative">
                  <BookOpen className="w-16 h-16 text-blue-600" />
                  <Sparkles className="w-8 h-8 text-orange-500 absolute -top-2 -right-2 animate-pulse" />
                </div>
              </div>

              <h1 className="text-4xl font-bold text-gray-800 mb-4">
                {t('auth.heroTitle')} <span className="text-blue-600">NatureSpace</span>
              </h1>

              <p className="text-xl text-gray-600 mb-8">
                {t('auth.heroSubtitle')}
              </p>
            </motion.div>

            {/* Features Grid */}
          </div>
        </div>

        {/* Right Side - Auth Form */}
        <div className="flex-1 flex items-center justify-center p-8">
          <motion.div
            className="w-full max-w-md"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
          >
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 border border-white/20 shadow-xl">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-2">
                  {isReset
                    ? t('auth.resetPassword')
                    : isSignUp
                    ? t('auth.startJourney')
                    : t('auth.welcomeBackTitle')}
                </h2>
                <p className="text-gray-600">
                  {isReset
                    ? t('auth.resetDesc')
                    : isSignUp
                    ? t('auth.signUpDesc')
                    : t('auth.signInDesc')}
                </p>
              </div>

              {isReset ? (
                <form onSubmit={handleReset} className="space-y-6">
                  <div>
                    <label htmlFor="reset-email" className="block text-sm font-medium text-gray-700 mb-2">
                      {t('auth.email')}
                    </label>
                    <input
                      id="reset-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white/70"
                      placeholder={t('auth.emailPlaceholder')}
                    />
                  </div>

                  <div>
                    <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 mb-2">
                      {t('auth.newPassword')}
                    </label>
                    <input
                      id="new-password"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      minLength={6}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white/70"
                      placeholder="••••••••"
                    />
                  </div>

                  <div>
                    <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-2">
                      {t('auth.confirmPassword')}
                    </label>
                    <input
                      id="confirm-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={6}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white/70"
                      placeholder="••••••••"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting || !email || !newPassword || !confirmPassword}
                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-6 rounded-xl font-medium transition-all duration-200 hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                  >
                    {isSubmitting ? <LoadingSpinner size="sm" /> : t('auth.resetPasswordBtn')}
                  </button>

                  <button
                    type="button"
                    onClick={() => { setIsReset(false); setNewPassword(''); setConfirmPassword('') }}
                    className="w-full text-center text-sm text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    {t('common.backToSignIn')}
                  </button>
                </form>
              ) : (
                <>
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                        {t('auth.email')}
                      </label>
                      <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white/70"
                        placeholder={t('auth.emailPlaceholder')}
                      />
                    </div>

                    <div>
                      <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                        {t('auth.password')}
                      </label>
                      <input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={6}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white/70"
                        placeholder="••••••••"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting || !email || !password}
                      className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-6 rounded-xl font-medium transition-all duration-200 hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                      {isSubmitting ? (
                        <LoadingSpinner size="sm" />
                      ) : (
                        isSignUp ? t('auth.createAccount') : t('auth.signInBtn')
                      )}
                    </button>
                  </form>

                  {false && LOCAL_LOGIN_ENABLED && (
                    <div className="mt-6">
                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-gray-200" />
                        </div>
                        <div className="relative flex justify-center text-xs">
                          <span className="bg-white/80 px-3 text-gray-400">{t('common.or')}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleLocalSignIn}
                        disabled={isSubmitting || isLocalSigningIn}
                        className="mt-6 w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white py-3 px-6 rounded-xl font-medium transition-all duration-200 hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isLocalSigningIn ? (
                          <LoadingSpinner size="sm" />
                        ) : (
                          <>
                            <Zap className="w-5 h-5" />
                            {t('auth.continueAs', { name: LOCAL_LOGIN_FULL_NAME })}
                          </>
                        )}
                      </button>

                      <p className="mt-3 text-center text-xs text-gray-400">
                        {t('auth.demoHint')}
                      </p>
                    </div>
                  )}

                  <div className="mt-6 text-center">
                    <p className="text-gray-600">
                      {isSignUp ? t('auth.hasAccount') : t('auth.noAccount')}
                      {' '}
                      <button
                        type="button"
                        onClick={() => setIsSignUp(!isSignUp)}
                        className="text-blue-600 font-medium hover:text-blue-700 transition-colors"
                      >
                        {isSignUp ? t('auth.toggleSignIn') : t('auth.toggleSignUp')}
                      </button>
                    </p>
                    {!isSignUp && (
                      <p className="mt-3">
                        <button
                          type="button"
                          onClick={() => setIsReset(true)}
                          className="text-sm text-blue-600 font-medium hover:text-blue-700 transition-colors"
                        >
                          {t('auth.forgotPassword')}
                        </button>
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
