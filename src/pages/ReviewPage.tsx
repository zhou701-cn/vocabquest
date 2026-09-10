import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useVocabularyStore } from '@/stores/vocabularyStore'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  ArrowLeft, 
  RotateCcw, 
  CheckCircle, 
  XCircle, 
  Trophy, 
  Target, 
  Flame, 
  Star,
  Volume2,
  Eye,
  EyeOff,
  RefreshCw,
  TrendingUp,
  Clock,
  Award,
  Zap
} from 'lucide-react'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { AchievementNotification, REVIEW_ACHIEVEMENTS } from '@/components/AchievementNotification'
import { SessionSummary } from '@/components/SessionSummary'
import { VocabularyWord, ReviewMode, ReviewSession, Achievement } from '@/types'
import { apiFetch } from '@/lib/api'
import toast from 'react-hot-toast'

export function ReviewPage() {
  const navigate = useNavigate()
  const { user, gamification, refreshProfile } = useAuth()
  const { currentList, words, userProgress, fetchWordsForList, updateProgress, getWordsForReview } = useVocabularyStore()
  
  // Session state
  const [reviewSession, setReviewSession] = useState<ReviewSession | null>(null)
  const [reviewWords, setReviewWords] = useState<VocabularyWord[]>([])
  const [currentWord, setCurrentWord] = useState<VocabularyWord | null>(null)
  const [showDefinition, setShowDefinition] = useState(false)
  const [reviewMode, setReviewMode] = useState<ReviewMode>('definition-to-word')
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [isAnswering, setIsAnswering] = useState(false)
  const [responseStartTime, setResponseStartTime] = useState<Date | null>(null)
  const [sessionComplete, setSessionComplete] = useState(false)
  const [loading, setLoading] = useState(true)
  const [multipleChoiceOptions, setMultipleChoiceOptions] = useState<string[]>([])
  const [currentAchievement, setCurrentAchievement] = useState<Achievement | null>(null)
  const [completedSessionsToday, setCompletedSessionsToday] = useState(0)
  const [showHint, setShowHint] = useState(false)
  const [hintUsed, setHintUsed] = useState(false)

  // Initialize review session
  useEffect(() => {
    initializeReviewSession()
  }, [user, currentList])

  // Regenerate options when mode changes
  useEffect(() => {
    if (currentWord) {
      generateMultipleChoice(currentWord)
    }
  }, [reviewMode, currentWord])

  const loadSessionCount = async () => {
    if (!user) return

    try {
      // Get session count for achievement tracking
      const { count } = await apiFetch<{ count: number }>('/sessions/today-count?mode=review')
      setCompletedSessionsToday(count || 0)
    } catch (error) {
      console.error('Error loading session count:', error)
    }
  }

  const checkForAchievements = (session: ReviewSession, responseTime: number, isCorrect: boolean) => {
    // Check for streak master (5 in a row)
    if (session.currentStreak >= 5 && !localStorage.getItem('streak_master_today')) {
      setCurrentAchievement(REVIEW_ACHIEVEMENTS.STREAK_MASTER)
      localStorage.setItem('streak_master_today', 'true')
    }
    
    // Check for quick learner (fast responses)
    if (responseTime < 3 && isCorrect) {
      const newQuickAnswers = session.quickAnswers + 1
      if (newQuickAnswers >= 10 && !localStorage.getItem('quick_learner_today')) {
        setCurrentAchievement(REVIEW_ACHIEVEMENTS.QUICK_LEARNER)
        localStorage.setItem('quick_learner_today', 'true')
      }
    }
    
    // Check for first review (if this is first session)
    if (completedSessionsToday === 0 && !localStorage.getItem('first_review_ever')) {
      setCurrentAchievement(REVIEW_ACHIEVEMENTS.FIRST_REVIEW)
      localStorage.setItem('first_review_ever', 'true')
    }
  }

  const checkSessionAchievements = (session: ReviewSession) => {
    const accuracy = (session.correctAnswers / session.totalWords) * 100
    
    // Perfect session achievement
    if (accuracy === 100 && session.totalWords >= 5) {
      const today = new Date().toISOString().split('T')[0]
      if (!localStorage.getItem(`perfect_session_${today}`)) {
        setCurrentAchievement(REVIEW_ACHIEVEMENTS.PERFECT_SESSION)
        localStorage.setItem(`perfect_session_${today}`, 'true')
      }
    }
    
    // Dedicated student (5 sessions)
    const newSessionCount = completedSessionsToday + 1
    if (newSessionCount >= 5 && !localStorage.getItem('dedicated_student_today')) {
      setCurrentAchievement(REVIEW_ACHIEVEMENTS.DEDICATED_STUDENT)
      localStorage.setItem('dedicated_student_today', 'true')
    }
  }

  const initializeReviewSession = async () => {
    if (!user || !currentList) {
      navigate('/dashboard')
      return
    }

    setLoading(true)
    try {
      // Get words due for review
      const wordsForReview = await getWordsForReview(user.id)
      
      if (wordsForReview.length === 0) {
        toast.success('Great job! No words need review right now.')
        navigate('/dashboard')
        return
      }

      setReviewWords(wordsForReview)
      setCurrentWord(wordsForReview[0])
      setReviewSession({
        totalWords: wordsForReview.length,
        currentIndex: 0,
        correctAnswers: 0,
        startTime: new Date(),
        wordsReviewed: [],
        currentStreak: 0,
        maxStreak: 0,
        pointsEarned: 0,
        quickAnswers: 0
      })
      setResponseStartTime(new Date())
      generateMultipleChoice(wordsForReview[0])
      
      // Load session count
      await loadSessionCount()
    } catch (error) {
      console.error('Error initializing review session:', error)
      toast.error('Failed to load review session')
    } finally {
      setLoading(false)
    }
  }

  const generateMultipleChoice = (word: VocabularyWord) => {
    // Use reviewWords instead of words for generating options
    const availableWords = reviewWords.length > 0 ? reviewWords : words
    
    if (reviewMode === 'definition-to-word') {
      // Show definition, user picks the word
      const incorrectWords = availableWords
        .filter(w => w.id !== word.id && w.part_of_speech === word.part_of_speech)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)
        .map(w => w.word)
      
      const options = [word.word, ...incorrectWords].sort(() => Math.random() - 0.5)
      setMultipleChoiceOptions(options)
    } else {
      // Show word, user picks the definition
      // Get incorrect definitions from other words (not just same part of speech)
      const incorrectWords = availableWords
        .filter(w => w.id !== word.id)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)
        .map(w => w.simple_definition || w.definition)
      
      const correctDefinition = word.simple_definition || word.definition
      const options = [correctDefinition, ...incorrectWords].sort(() => Math.random() - 0.5)
      setMultipleChoiceOptions(options)
    }
  }

  const handleAnswer = async (answer: string) => {
    if (!currentWord || !reviewSession || isAnswering) return

    setIsAnswering(true)
    setSelectedAnswer(answer)

    const responseTime = responseStartTime 
      ? (new Date().getTime() - responseStartTime.getTime()) / 1000
      : 0

    const isCorrect = reviewMode === 'definition-to-word' 
      ? answer === currentWord.word
      : answer === (currentWord.simple_definition || currentWord.definition)

    // Update progress via spaced repetition algorithm
    await updateProgress(currentWord.id, isCorrect, responseTime)

    // Update session stats
    const newStreak = isCorrect ? reviewSession.currentStreak + 1 : 0
    const hintPenalty = hintUsed ? 2 : 0 // Small penalty for using hint
    const pointsEarned = isCorrect ? Math.max(1, 10 + (newStreak >= 5 ? 5 : 0) + (responseTime < 3 ? 5 : 0) - hintPenalty) : 0
    const newQuickAnswers = isCorrect && responseTime < 3 ? reviewSession.quickAnswers + 1 : reviewSession.quickAnswers
    
    const updatedSession = {
      ...reviewSession,
      correctAnswers: isCorrect ? reviewSession.correctAnswers + 1 : reviewSession.correctAnswers,
      currentStreak: newStreak,
      maxStreak: Math.max(reviewSession.maxStreak, newStreak),
      pointsEarned: reviewSession.pointsEarned + pointsEarned,
      quickAnswers: newQuickAnswers,
      wordsReviewed: [...reviewSession.wordsReviewed, {
        word: currentWord,
        isCorrect,
        responseTime
      }]
    }
    
    setReviewSession(updatedSession)

    // Check for achievements
    checkForAchievements(updatedSession, responseTime, isCorrect)

    // Show feedback
    if (isCorrect) {
      if (responseTime < 3) {
        toast.success(`Lightning fast! +${pointsEarned} points${hintUsed ? ' (hint used)' : ''}`, { icon: '⚡' })
      } else {
        toast.success(`Correct! +${pointsEarned} points${hintUsed ? ' (hint used)' : ''}`, { icon: '✅' })
      }
    } else {
      toast.error('Not quite right, keep trying!', { icon: '❌' })
    }

    // Move to next word after delay
    setTimeout(() => {
      moveToNextWord()
    }, 2000)
  }

  const moveToNextWord = () => {
    if (!reviewSession) return

    const nextIndex = reviewSession.currentIndex + 1
    
    if (nextIndex >= reviewWords.length) {
      completeSession()
      return
    }

    const nextWord = reviewWords[nextIndex]
    setCurrentWord(nextWord)
    setReviewSession({ ...reviewSession, currentIndex: nextIndex })
    setSelectedAnswer(null)
    setShowDefinition(false)
    setIsAnswering(false)
    setShowHint(false)
    setHintUsed(false)
    setResponseStartTime(new Date())
    generateMultipleChoice(nextWord)
  }

  const completeSession = async () => {
    if (!reviewSession) return

    // Check for session-based achievements
    checkSessionAchievements(reviewSession)
    
    setSessionComplete(true)
    
    // Log the session to database
    try {
      const sessionDuration = Math.round((new Date().getTime() - reviewSession.startTime.getTime()) / 1000 / 60)
      const accuracy = Math.round((reviewSession.correctAnswers / reviewSession.totalWords) * 100)
      
      await apiFetch('/sessions', {
        method: 'POST',
        body: {
          mode: 'review',
          duration_minutes: sessionDuration,
          words_studied: reviewSession.totalWords,
          words_correct: reviewSession.correctAnswers,
          accuracy_percentage: accuracy,
          points_earned: reviewSession.pointsEarned,
          metadata: {
            max_streak: reviewSession.maxStreak,
            quick_answers: reviewSession.quickAnswers,
            review_mode: reviewMode
          },
          session_end: new Date().toISOString(),
          is_completed: true
        }
      })
      
      // Refresh data
      await refreshProfile()
      
      // Show completion message
      toast.success(`Session complete! ${accuracy}% accuracy, ${reviewSession.pointsEarned} points earned!`, {
        duration: 4000
      })
    } catch (error) {
      console.error('Error logging session:', error)
    }
  }

  const playAudio = async () => {
    if (!currentWord || !currentWord.audio_url) {
      toast.error('Audio not available for this word')
      return
    }

    try {
      const audio = new Audio(currentWord.audio_url)
      await audio.play()
    } catch (error) {
      console.error('Error playing audio:', error)
      toast.error('Could not play audio')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-red-50 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-gray-600">Preparing your review session...</p>
        </div>
      </div>
    )
  }

  if (sessionComplete && reviewSession) {
    const accuracy = Math.round((reviewSession.correctAnswers / reviewSession.totalWords) * 100)
    const duration = Math.round((new Date().getTime() - reviewSession.startTime.getTime()) / 1000 / 60)

    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-red-50">
        <SessionSummary
          totalWords={reviewSession.totalWords}
          correctAnswers={reviewSession.correctAnswers}
          duration={duration}
          pointsEarned={reviewSession.pointsEarned}
          maxStreak={reviewSession.maxStreak}
          wordsReviewed={reviewSession.wordsReviewed}
          onRestart={initializeReviewSession}
          onBackToDashboard={() => navigate('/dashboard')}
        />
      </div>
    )
  }

  if (!currentWord || !reviewSession) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-red-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">No words available for review</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-6 py-3 rounded-xl font-medium hover:from-orange-600 hover:to-red-600 transition-all duration-200"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  const progress = ((reviewSession.currentIndex) / reviewSession.totalWords) * 100
  const currentAccuracy = reviewSession.currentIndex > 0 
    ? Math.round((reviewSession.correctAnswers / (reviewSession.currentIndex)) * 100)
    : 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-red-50">
      {/* Achievement Notification */}
      <AchievementNotification 
        achievement={currentAchievement} 
        onClose={() => setCurrentAchievement(null)} 
      />

      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-white/20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back</span>
            </button>
            
            <div className="flex items-center space-x-2">
              <RotateCcw className="w-6 h-6 text-orange-600" />
              <h1 className="text-xl font-semibold text-gray-800">Smart Review</h1>
            </div>
            
            <div className="flex items-center space-x-4 text-sm">
              <div className="flex items-center space-x-1 bg-blue-100 px-3 py-1 rounded-full">
                <Target className="w-4 h-4 text-blue-600" />
                <span className="text-blue-800 font-medium">{reviewSession.currentIndex + 1}/{reviewSession.totalWords}</span>
              </div>
              <div className="flex items-center space-x-1 bg-green-100 px-3 py-1 rounded-full">
                <TrendingUp className="w-4 h-4 text-green-600" />
                <span className="text-green-800 font-medium">{currentAccuracy}%</span>
              </div>
              <div className="flex items-center space-x-1 bg-orange-100 px-3 py-1 rounded-full">
                <Flame className="w-4 h-4 text-orange-600" />
                <span className="text-orange-800 font-medium">{reviewSession.currentStreak}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="bg-white/60 backdrop-blur-sm border-b border-white/20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Progress</span>
            <span className="text-sm font-medium text-gray-800">{Math.round(progress)}% Complete</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <motion.div 
              className="bg-gradient-to-r from-orange-500 to-red-500 h-3 rounded-full"
              style={{ width: `${progress}%` }}
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>
      </div>

      {/* Review Mode Selector */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex justify-center mb-6">
          <div className="bg-white/60 backdrop-blur-sm rounded-xl p-1 border border-white/20">
            <div className="flex space-x-1">
              {[
                { id: 'definition-to-word', label: 'Definition → Word' },
                { id: 'word-to-definition', label: 'Word → Definition' }
              ].map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => {
                    setReviewMode(mode.id as ReviewMode)
                    setSelectedAnswer(null)
                    setShowHint(false)
                    setHintUsed(false)
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    reviewMode === mode.id
                      ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg'
                      : 'text-gray-600 hover:text-gray-800 hover:bg-white/40'
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Word Card */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`${currentWord.id}-${reviewMode}`}
            className="max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 20, rotateY: -10 }}
            animate={{ opacity: 1, y: 0, rotateY: 0 }}
            exit={{ opacity: 0, y: -20, rotateY: 10 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-8 shadow-2xl border border-white/20 relative overflow-hidden">
              {/* Decorative Elements */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-orange-200 to-transparent rounded-full -translate-y-16 translate-x-16 opacity-50" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-red-200 to-transparent rounded-full translate-y-12 -translate-x-12 opacity-50" />

              {/* Card Content */}
              <div className="relative z-10">
                {/* Part of Speech Badge */}
                <div className="flex justify-center mb-6">
                  <span className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-4 py-2 rounded-full text-sm font-medium uppercase tracking-wide">
                    {currentWord.part_of_speech}
                  </span>
                </div>

                {/* Question Section */}
                <div className="text-center mb-8">
                  {reviewMode === 'definition-to-word' ? (
                    <div>
                      <h2 className="text-lg text-gray-600 mb-4">What word matches this definition?</h2>
                      <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-2xl p-6 mb-4">
                        <p className="text-xl text-gray-800 leading-relaxed">
                          {currentWord.simple_definition || currentWord.definition}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <h2 className="text-lg text-gray-600 mb-4">What does this word mean?</h2>
                      <div className="mb-6">
                        <div className="flex items-center justify-center space-x-4 mb-4">
                          <h3 className="text-4xl font-bold text-gray-800">{currentWord.word}</h3>
                          {currentWord.audio_url && (
                            <button
                              onClick={playAudio}
                              className="p-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-full hover:from-blue-600 hover:to-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
                            >
                              <Volume2 className="w-5 h-5" />
                            </button>
                          )}
                        </div>
                        {currentWord.pronunciation_guide && (
                          <p className="text-gray-500 text-lg mb-2">/{currentWord.pronunciation_guide}/</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Multiple Choice Options */}
                <div className="grid grid-cols-1 gap-3">
                  {multipleChoiceOptions.map((option, index) => {
                    const isSelected = selectedAnswer === option
                    const isCorrect = reviewMode === 'definition-to-word' 
                      ? option === currentWord.word
                      : option === (currentWord.simple_definition || currentWord.definition)
                    
                    let buttonClass = "w-full p-4 rounded-xl text-left font-medium transition-all duration-200 border-2 "
                    
                    if (isAnswering && isSelected) {
                      buttonClass += isCorrect 
                        ? "bg-gradient-to-r from-green-100 to-green-200 border-green-300 text-green-800 shadow-lg transform scale-105"
                        : "bg-gradient-to-r from-red-100 to-red-200 border-red-300 text-red-800 shadow-lg"
                    } else if (isAnswering && isCorrect) {
                      buttonClass += "bg-gradient-to-r from-green-100 to-green-200 border-green-300 text-green-800 shadow-lg"
                    } else if (isAnswering) {
                      buttonClass += "bg-gray-100 border-gray-200 text-gray-500 cursor-not-allowed"
                    } else {
                      buttonClass += "bg-white/60 border-gray-200 text-gray-700 hover:bg-white/80 hover:border-orange-300 hover:shadow-lg hover:transform hover:scale-102"
                    }

                    return (
                      <motion.button
                        key={index}
                        onClick={() => !isAnswering && handleAnswer(option)}
                        className={buttonClass}
                        disabled={isAnswering}
                        whileHover={!isAnswering ? { scale: 1.02 } : {}}
                        whileTap={!isAnswering ? { scale: 0.98 } : {}}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-base">{option}</span>
                          {isAnswering && isSelected && (
                            <div className="ml-2">
                              {isCorrect ? (
                                <CheckCircle className="w-6 h-6 text-green-600" />
                              ) : (
                                <XCircle className="w-6 h-6 text-red-600" />
                              )}
                            </div>
                          )}
                          {isAnswering && !isSelected && isCorrect && (
                            <CheckCircle className="w-6 h-6 text-green-600 ml-2" />
                          )}
                        </div>
                      </motion.button>
                    )
                  })}
                </div>

                {/* Hint Button */}
                {currentWord.example_sentence && (
                  <div className="flex justify-center mt-6">
                    <button
                      onClick={() => {
                        setShowHint(!showHint)
                        if (!showHint) setHintUsed(true)
                      }}
                      className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 ${
                        reviewMode === 'definition-to-word'
                          ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700'
                          : 'bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700'
                      }`}
                    >
                      <span className="text-sm font-medium">
                        {showHint ? 'Hide Hint' : 'Show Hint'}
                      </span>
                      <span className="text-lg">{showHint ? '👁️‍🗨️' : '💡'}</span>
                    </button>
                  </div>
                )}

                {/* Hint Content */}
                {showHint && currentWord.example_sentence && (
                  <div className={`mt-4 rounded-2xl p-4 ${
                    reviewMode === 'definition-to-word'
                      ? 'bg-gradient-to-r from-blue-50 to-blue-100'
                      : 'bg-gradient-to-r from-green-50 to-green-100'
                  }`}>
                    <p className={`text-sm ${
                      reviewMode === 'definition-to-word' ? 'text-blue-800' : 'text-green-800'
                    }`}>
                      <strong>Example:</strong> {currentWord.example_sentence}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Session Stats */}
        <div className="max-w-2xl mx-auto mt-8">
          <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
            <div className="grid grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-blue-600">{reviewSession.correctAnswers}</div>
                <div className="text-sm text-gray-600">Correct</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{currentAccuracy}%</div>
                <div className="text-sm text-gray-600">Accuracy</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-orange-600">{reviewSession.currentStreak}</div>
                <div className="text-sm text-gray-600">Streak</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-600">{reviewSession.pointsEarned}</div>
                <div className="text-sm text-gray-600">Points</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}