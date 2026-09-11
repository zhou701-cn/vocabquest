import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { motion } from 'framer-motion'
import { ArrowLeft, User, Save, BookOpen } from 'lucide-react'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import toast from 'react-hot-toast'

export function ProfilePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { profile, updateProfile, loading } = useAuth()
  const [formData, setFormData] = useState({
    full_name: '',
    grade_level: 4,
    role: 'student' as 'student' | 'admin'
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || '',
        grade_level: profile.grade_level || 4,
        role: profile.role || 'student'
      })
    }
  }, [profile])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.full_name) {
      toast.error(t('profile.enterName'))
      return
    }

    setSaving(true)
    try {
      await updateProfile(formData)
    } catch (error) {
      console.error('Error updating profile:', error)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-orange-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-white/20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>{t('profile.backToDashboard')}</span>
            </button>
            
            <div className="flex items-center space-x-2">
              <BookOpen className="w-6 h-6 text-blue-600" />
              <h1 className="text-xl font-semibold text-gray-800">{t('profile.title')}</h1>
            </div>
            
            <div className="w-20" /> {/* Spacer */}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="bg-white/60 backdrop-blur-sm rounded-2xl p-8 border border-white/20"
        >
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-2xl mx-auto mb-4">
              {formData.full_name?.[0]?.toUpperCase() || 'U'}
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">{t('profile.yourProfile')}</h2>
            <p className="text-gray-600">{t('profile.updateInfo')}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="full_name" className="block text-sm font-medium text-gray-700 mb-2">
                {t('profile.fullName')}
              </label>
              <input
                id="full_name"
                type="text"
                value={formData.full_name}
                onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white/70"
                placeholder={t('profile.fullNamePlaceholder')}
              />
            </div>

            <div>
              <label htmlFor="grade_level" className="block text-sm font-medium text-gray-700 mb-2">
                {t('profile.gradeLevel')}
              </label>
              <select
                id="grade_level"
                value={formData.grade_level}
                onChange={(e) => setFormData(prev => ({ ...prev, grade_level: parseInt(e.target.value) }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white/70"
              >
                <option value={3}>{t('profile.grade3')}</option>
                <option value={4}>{t('profile.grade4')}</option>
                <option value={5}>{t('profile.grade5')}</option>
              </select>
            </div>


            <button
              type="submit"
              disabled={saving}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-6 rounded-xl font-medium transition-all duration-200 hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {saving ? (
                <LoadingSpinner size="sm" />
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  <span>{t('profile.saveChanges')}</span>
                </>
              )}
            </button>
          </form>
        </motion.div>
      </div>
    </div>
  )
}