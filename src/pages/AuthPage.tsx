import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Navigate } from 'react-router-dom'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { LOCAL_LOGIN_ENABLED, LOCAL_LOGIN_FULL_NAME } from '@/lib/config'
import { BookOpen, Sparkles, Trophy, Target, Users, Star, Zap } from 'lucide-react'
import { motion } from 'framer-motion'

export function AuthPage() {
  const { user, signIn, signUp, localSignIn, loading } = useAuth()
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-orange-50">
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
                Welcome to <span className="text-blue-600">NatureSpace</span>
              </h1>
              
              <p className="text-xl text-gray-600 mb-8">
                fun, interactive learning adventures!
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
                  {isSignUp ? 'Start Your Journey' : 'Welcome Back'}
                </h2>
                <p className="text-gray-600">
                  {isSignUp 
                    ? 'Create your account to begin learning'
                    : 'Sign in to continue your vocabulary adventure'
                  }
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white/70"
                    placeholder="your@email.com"
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                    Password
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
                    isSignUp ? 'Create Account' : 'Sign In'
                  )}
                </button>
              </form>

              {LOCAL_LOGIN_ENABLED && (
                <div className="mt-6">
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-200" />
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="bg-white/80 px-3 text-gray-400">or</span>
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
                        Continue as {LOCAL_LOGIN_FULL_NAME}
                      </>
                    )}
                  </button>

                  <p className="mt-3 text-center text-xs text-gray-400">
                    One-click demo login - no account or network required, works completely offline
                  </p>
                </div>
              )}

              <div className="mt-6 text-center">
                <p className="text-gray-600">
                  {isSignUp ? 'Already have an account?' : "Don't have an account?"}
                  {' '}
                  <button
                    type="button"
                    onClick={() => setIsSignUp(!isSignUp)}
                    className="text-blue-600 font-medium hover:text-blue-700 transition-colors"
                  >
                    {isSignUp ? 'Sign In' : 'Sign Up'}
                  </button>
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}