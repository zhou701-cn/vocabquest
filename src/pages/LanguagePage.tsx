import { useEffect, useState } from 'react'
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
  TrendingUp,
  User,
  LogOut,
  Settings
} from 'lucide-react'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import toast from 'react-hot-toast'

export function LanguagePage() {
  const { user, profile, gamification, signOut } = useAuth()
  const { 
    fetchVocabularyLists, 
    fetchUserProgress,
    vocabularyLists,
    currentList,
    loading 
  } = useVocabularyStore()
  const navigate = useNavigate()
  const [showProfileMenu, setShowProfileMenu] = useState(false)

  useEffect(() => {
    if (user) {
      fetchVocabularyLists()
      fetchUserProgress(user.id)
    }
  }, [user, fetchVocabularyLists, fetchUserProgress])

  const startLearningMode = (mode: 'language' | 'poem') => {
    if (!currentList) {
      toast.error('Please select a vocabulary list first')
      return
    }
    navigate(`/${mode}`)
  }

  const learningModes = [
    {
      id: 'flashcards',
      title: 'Flashcards',
      description: 'Learn new words with interactive flashcards',
      icon: BookOpen,
      color: 'from-blue-500 to-blue-600',
      hoverColor: 'hover:from-blue-600 hover:to-blue-700'
    },
    {
      id: 'quiz',
      title: 'Quiz Mode',
      description: 'Test your knowledge with multiple choice questions',
      icon: Brain,
      color: 'from-purple-500 to-purple-600',
      hoverColor: 'hover:from-purple-600 hover:to-purple-700'
    },
    {
      id: 'spelling',
      title: 'Spelling',
      description: 'Practice spelling words correctly',
      icon: Pen,
      color: 'from-green-500 to-green-600',
      hoverColor: 'hover:from-green-600 hover:to-green-700'
    },
    {
      id: 'review',
      title: 'Smart Review',
      description: 'Review words using spaced repetition',
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
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <BookOpen className="w-8 h-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-800">NatureSpace</h1>
            </div>
            
            <div className="relative">
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-medium text-sm">
                  {profile?.full_name?.[0]?.toUpperCase() || 'U'}
                </div>
                <span className="text-gray-700 font-medium">
                  {profile?.full_name || 'User'}
                </span>
              </button>
              
              {showProfileMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2">
                  <button
                    onClick={() => navigate('/profile')}
                    className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center space-x-2"
                  >
                    <User className="w-4 h-4" />
                    <span>Profile</span>
                  </button>
                  {profile?.role === 'admin' && (
                    <button
                      onClick={() => navigate('/admin')}
                      className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center space-x-2 text-blue-600"
                    >
                      <Settings className="w-4 h-4" />
                      <span>Admin Dashboard</span>
                    </button>
                  )}
                  <hr className="my-1" />
                  <button
                    onClick={signOut}
                    className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center space-x-2 text-red-600"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <motion.div 
          className="mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl font-bold text-gray-800 mb-2">
            Welcome back, {profile?.full_name?.split(' ')[0] || 'Student'}! 🎉
          </h2>
          <p className="text-gray-600">
            Ready to continue your vocabulary journey? Let's learn some new words today!
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
              <h3 className="text-xl font-semibold text-gray-800 mb-6">Choose Your Learning Mode</h3>
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
              <h3 className="text-lg font-semibold text-gray-800 mb-4">🏆 My Achievements</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Trophy className="w-5 h-5 text-yellow-600" />
                    <span className="text-sm text-gray-600">Level</span>
                  </div>
                  <span className="font-bold text-lg">{gamification?.current_level || 1}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Star className="w-5 h-5 text-blue-600" />
                    <span className="text-sm text-gray-600">Points</span>
                  </div>
                  <span className="font-bold text-lg">{gamification?.total_points || 0}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Flame className="w-5 h-5 text-orange-600" />
                    <span className="text-sm text-gray-600">Streak</span>
                  </div>
                  <span className="font-bold text-lg">{gamification?.current_streak || 0}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="w-5 h-5 text-green-600" />
                    <span className="text-sm text-gray-600">Words Learned</span>
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