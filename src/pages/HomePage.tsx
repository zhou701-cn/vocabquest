import { useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useVocabularyStore } from '@/stores/vocabularyStore'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { 
  BookOpen, 
  Brain, 
  Pen, 
  RotateCcw, 
  Trophy, 
  Target, 
  Flame, 
  Star,
  TrendingUp
} from 'lucide-react'
import { AppHeader } from '@/components/AppHeader'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { getUserFirstName } from '@/lib/userDisplay'
import toast from 'react-hot-toast'

export function HomePage() {
  const { t } = useTranslation()
  const { user, profile, gamification, signOut } = useAuth()
  const { 
    fetchVocabularyLists, 
    fetchUserProgress,
    vocabularyLists,
    currentList,
    loading 
  } = useVocabularyStore()
  const navigate = useNavigate()

  useEffect(() => {
    if (user) {
      fetchVocabularyLists()
      fetchUserProgress(user.id)
    }
  }, [user, fetchVocabularyLists, fetchUserProgress])

  const startLearningMode = (mode: 'language' | 'poem') => {
    // Poem Reciting 不依赖词汇表，直接进入诗歌页面
    if (mode === 'poem') {
      navigate('/poem')
      return
    }
    if (!currentList) {
      toast.error(t('languagePage.pleaseSelectList'))
      return
    }
    navigate(`/${mode}`)
  }

  const learningModes = [
    {
      id: 'language',
      title: t('home.englishLearningTitle'),
      description: t('home.englishLearningDesc'),
      icon: BookOpen,
      color: 'from-blue-500 to-blue-600',
      hoverColor: 'hover:from-blue-600 hover:to-blue-700'
    },
    {
      id: 'poem',
      title: t('home.poemRecitingTitle'),
      description: t('home.poemRecitingDesc'),
      icon: Brain,
      color: 'from-purple-500 to-purple-600',
      hoverColor: 'hover:from-purple-600 hover:to-purple-700'
    },
  ]


  if (loading && !vocabularyLists.length) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-orange-50">
      <AppHeader />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <motion.div 
          className="mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl font-bold text-gray-800 mb-2">
            {t('home.welcome', { name: getUserFirstName(user, profile) })}
          </h2>
          <p className="text-gray-600">
            {t('home.subtitle')}
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">

            {/* Learning Modes */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
            >
              <div className="grid md:grid-cols-2 gap-4">
                {learningModes.map((mode, index) => {
                  const Icon = mode.icon
                  return (
                    <motion.button
                      key={mode.id}
                      onClick={() => startLearningMode(mode.id as any)}
                      className={`bg-gradient-to-r ${mode.color} ${mode.hoverColor} text-white rounded-2xl p-6 text-left transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl h-24 flex items-center`}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 + index * 0.1, duration: 0.6 }}
                    >
                      <div className="flex items-center space-x-4">
                        <div className="bg-white/20 p-3 rounded-xl">
                          <Icon className="w-6 h-6" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-lg">{mode.title}</h4>
                          <p className="text-white/90 text-sm">{mode.description}</p>
                        </div>
                      </div>
                    </motion.button>
                  )
                })}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}