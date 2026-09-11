import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { useVocabularyStore } from '@/stores/vocabularyStore'
import { useNavigate } from 'react-router-dom'
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
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { AppHeader } from '@/components/AppHeader'
import { getUserFirstName } from '@/lib/userDisplay'
import toast from 'react-hot-toast'

export function LanguagePage() {
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
    if (!currentList) {
      toast.error(t('languagePage.pleaseSelectList'))
      return
    }
    navigate(`/${mode}`)
  }

  const learningModes = [
    {
      id: 'flashcards',
      title: t('languagePage.flashcards'),
      description: t('languagePage.flashcardsDesc'),
      icon: BookOpen,
      color: 'from-blue-500 to-blue-600',
      hoverColor: 'hover:from-blue-600 hover:to-blue-700'
    },
    {
      id: 'quiz',
      title: t('languagePage.quiz'),
      description: t('languagePage.quizDesc'),
      icon: Brain,
      color: 'from-purple-500 to-purple-600',
      hoverColor: 'hover:from-purple-600 hover:to-purple-700'
    },
    {
      id: 'spelling',
      title: t('languagePage.spelling'),
      description: t('languagePage.spellingDesc'),
      icon: Pen,
      color: 'from-green-500 to-green-600',
      hoverColor: 'hover:from-green-600 hover:to-green-700'
    },
    {
      id: 'review',
      title: t('languagePage.review'),
      description: t('languagePage.reviewDesc'),
      icon: RotateCcw,
      color: 'from-orange-500 to-orange-600',
      hoverColor: 'hover:from-orange-600 hover:to-orange-700'
    }
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
            {t('languagePage.welcome', { name: getUserFirstName(user, profile) })}
          </h2>
          <p className="text-gray-600">
            {t('languagePage.subtitle')}
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
              <h3 className="text-xl font-semibold text-gray-800 mb-6">{t('languagePage.chooseMode')}</h3>
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

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Stats Card */}
            <motion.div 
              className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-white/20"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
            >
              <h3 className="text-lg font-semibold text-gray-800 mb-4">🏆 {t('languagePage.achievements')}</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Trophy className="w-5 h-5 text-yellow-600" />
                    <span className="text-sm text-gray-600">{t('languagePage.level')}</span>
                  </div>
                  <span className="font-bold text-lg">{gamification?.current_level || 1}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Star className="w-5 h-5 text-blue-600" />
                    <span className="text-sm text-gray-600">{t('languagePage.points')}</span>
                  </div>
                  <span className="font-bold text-lg">{gamification?.total_points || 0}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Flame className="w-5 h-5 text-orange-600" />
                    <span className="text-sm text-gray-600">{t('languagePage.streak')}</span>
                  </div>
                  <span className="font-bold text-lg">{gamification?.current_streak || 0}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="w-5 h-5 text-green-600" />
                    <span className="text-sm text-gray-600">{t('languagePage.wordsLearned')}</span>
                  </div>
                  <span className="font-bold text-lg">{gamification?.words_learned || 0}</span>
                </div>
              </div>
            </motion.div>

           

          </div>
        </div>
      </div>
    </div>
  )
}