import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Volume2, VolumeX, Lightbulb, RotateCcw, CheckCircle, XCircle, Trophy, Target, ChevronLeft, ChevronRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useVocabularyStore } from '@/stores/vocabularyStore'
import { useAuth } from '@/contexts/AuthContext'
import { VocabularyWord } from '@/types'
import { SpellingSessionManager, SpellingSessionData, SpellingWordAttempt, HintLevel } from '@/lib/spellingSession'
import i18n from '@/i18n'
import toast from 'react-hot-toast'

interface SpellingSessionStats {
  wordsAttempted: number
  wordsCorrect: number
  totalHintsUsed: number
  totalTime: number
  pointsEarned: number
}

export function SpellingPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const {
    words,
    currentWord,
    startLearningSession,
    getNextWord,
    updateProgress,
    fetchVocabularyLists,
    setCurrentList,
    vocabularyLists
  } = useVocabularyStore()
  
  // Session state
  const [currentAnswer, setCurrentAnswer] = useState('')
  const [hintLevel, setHintLevel] = useState<HintLevel>(0)
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  const [showFeedback, setShowFeedback] = useState(false)
  const [sessionStats, setSessionStats] = useState<SpellingSessionStats>({
    wordsAttempted: 0,
    wordsCorrect: 0,
    totalHintsUsed: 0,
    totalTime: 0,
    pointsEarned: 0
  })
  const [sessionStartTime, setSessionStartTime] = useState<number>(Date.now())
  const [wordStartTime, setWordStartTime] = useState<number>(Date.now())
  const [sessionActive, setSessionActive] = useState(false)
  const [sessionComplete, setSessionComplete] = useState(false)
  const [initializationError, setInitializationError] = useState(false)
  
  // Session persistence state
  const [sessionId, setSessionId] = useState<string>('')
  const [sessionWords, setSessionWords] = useState<VocabularyWord[]>([])
  const [currentWordIndex, setCurrentWordIndex] = useState(0)
  const [wordAttempts, setWordAttempts] = useState<SpellingWordAttempt[]>([])
  const [isResuming, setIsResuming] = useState(false)
  
  // Audio state
  const [isPlaying, setIsPlaying] = useState(false)
  const [audioEnabled, setAudioEnabled] = useState(true)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  
  // Initialize session
  useEffect(() => {
    const initializeSession = async () => {
      try {
        // Set a timeout to prevent infinite loading
        const timeoutId = setTimeout(() => {
          console.error('Spelling session initialization timeout')
          setInitializationError(true)
        }, 10000) // 10 second timeout
        
        // Check for existing session first
        const existingSession = SpellingSessionManager.loadSession()
        if (existingSession && existingSession.userId === user?.id) {
          await resumeSpellingSession(existingSession)
          clearTimeout(timeoutId)
          return
        }
        
        // Fetch vocabulary lists if not already loaded
        if (vocabularyLists.length === 0) {
          await fetchVocabularyLists()
        }
        
        // Wait a bit for the store to update
        await new Promise(resolve => setTimeout(resolve, 100))
        
        // Get the updated lists from the store
        const currentLists = useVocabularyStore.getState().vocabularyLists
        if (currentLists.length > 0) {
          const defaultList = currentLists.find(list => list.is_default) || currentLists[0]
          if (defaultList) {
            await setCurrentList(defaultList)
          }
        } else {
          console.error('No vocabulary lists available')
          setInitializationError(true)
          clearTimeout(timeoutId)
          return
        }
        
        // Wait for words to be loaded
        await new Promise(resolve => setTimeout(resolve, 100))
        const currentWords = useVocabularyStore.getState().words
        
        if (currentWords.length > 0) {
          startNewSpellingSession()
        } else {
          console.error('No words available for the selected list')
          setInitializationError(true)
        }
        
        clearTimeout(timeoutId)
      } catch (error) {
        console.error('Error initializing spelling session:', error)
        setInitializationError(true)
      }
    }
    
    initializeSession()
  }, [user?.id])
  
  // Note: Removed automatic audio playback - browsers require user interaction
  
  // Save session state whenever it changes
  useEffect(() => {
    if (sessionActive && sessionId && sessionWords.length > 0) {
      saveSessionState()
    }
  }, [sessionWords, currentWordIndex, wordAttempts, currentAnswer, hintLevel, sessionStats, sessionActive, sessionId])

  const startNewSpellingSession = () => {
    const newSessionId = SpellingSessionManager.createSessionId()
    setSessionId(newSessionId)
    
    const currentWords = useVocabularyStore.getState().words
    const sessionWordsList = currentWords.slice(0, 20) // Limit to 20 words
    setSessionWords(sessionWordsList)
    setCurrentWordIndex(0)
    
    // Initialize word attempts
    const initialAttempts = sessionWordsList.map(word => SpellingSessionManager.createWordAttempt(word))
    setWordAttempts(initialAttempts)
    
    startLearningSession('spelling')
    setSessionActive(true)
    setSessionStartTime(Date.now())
    setWordStartTime(Date.now())
    resetWordState()
  }

  const resumeSpellingSession = async (sessionData: SpellingSessionData) => {
    setIsResuming(true)
    
    try {
      setSessionId(sessionData.sessionId)
      setSessionWords(sessionData.sessionWords)
      setCurrentWordIndex(sessionData.currentWordIndex)
      setWordAttempts(sessionData.wordAttempts)
      setCurrentAnswer(sessionData.currentAnswer)
      setHintLevel(sessionData.currentHintLevel)
      setSessionStats(sessionData.sessionStats)
      setSessionStartTime(sessionData.sessionStartTime)
      setWordStartTime(sessionData.wordStartTime)
      setAudioEnabled(sessionData.audioEnabled)
      setSessionActive(true)
      
      // Set current word in store
      const currentWord = sessionData.sessionWords[sessionData.currentWordIndex]
      if (currentWord) {
        useVocabularyStore.getState().setCurrentWord(currentWord)
      }
      
      setWordStartTime(Date.now())
      setIsResuming(false)
      
      toast.success(t('spelling.resumed', { current: sessionData.currentWordIndex + 1, total: sessionData.sessionWords.length }))
    } catch (error) {
      console.error('Error resuming spelling session:', error)
      setIsResuming(false)
      setInitializationError(true)
    }
  }

  const saveSessionState = () => {
    if (!user?.id || !sessionId || sessionWords.length === 0) return
    
    const sessionData: SpellingSessionData = {
      sessionId,
      userId: user.id,
      currentWordIndex,
      sessionWords,
      wordAttempts,
      currentAnswer,
      currentHintLevel: hintLevel,
      sessionStats,
      sessionStartTime,
      wordStartTime,
      audioEnabled,
      createdAt: sessionStartTime,
      lastUpdated: Date.now()
    }
    
    SpellingSessionManager.saveSession(sessionData)
  }
  
  const resetWordState = () => {
    setCurrentAnswer('')
    setHintLevel(0)
    setIsCorrect(null)
    setShowFeedback(false)
    setWordStartTime(Date.now())
  }
  
  const playWordAudio = async () => {
    if (!currentWord || !audioEnabled) return
    
    try {
      setIsPlaying(true)
      // Use sort_order for audio file naming since audio files are numbered sequentially
      const audioId = currentWord.sort_order ? currentWord.sort_order.toString().padStart(3, '0') : '001'
      const audioUrl = `/audio/word_${audioId}_${currentWord.word}.mp3`
      
      // Clean up previous audio
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
      
      // Create new audio element
      audioRef.current = new Audio(audioUrl)
      audioRef.current.volume = 0.8
      
      // Set up event handlers
      audioRef.current.onended = () => setIsPlaying(false)
      audioRef.current.onerror = (e) => {
        setIsPlaying(false)
        console.error(`Audio error for word: ${currentWord.word}`, e)
      }
      
      // Play the audio
      await audioRef.current.play()
    } catch (error) {
      setIsPlaying(false)
      console.error('Error playing audio:', error)
      // Don't show error to user for autoplay policy issues
      if (error.name !== 'NotAllowedError') {
        console.warn(`Audio not available for word: ${currentWord.word}`)
      }
    }
  }
  
  const getWordHint = (word: string, level: HintLevel): string => {
    if (!word) return ''
    
    switch (level) {
      case 0:
        return '' // No hint
      case 1:
        return word.split('').map(() => '_').join(' ') // Show length
      case 2:
        return word[0] + ' ' + word.slice(1).split('').map(() => '_').join(' ') // First letter
      case 3:
        return word[0] + ' ' + word.slice(1, -1).split('').map(() => '_').join(' ') + ' ' + word[word.length - 1] // First and last
      case 4:
        return `${i18n.t('spelling.definitionLabel')}: ${currentWord?.definition || i18n.t('spelling.definitionFallback')}` // Definition
      case 5:
        return word.toUpperCase() // Show complete word
      default:
        return ''
    }
  }
  
  const handleHintRequest = () => {
    if (hintLevel < 5) {
      setHintLevel((prev) => (prev + 1) as HintLevel)
      setSessionStats(prev => ({
        ...prev,
        totalHintsUsed: prev.totalHintsUsed + 1
      }))
    }
  }
  
  const checkSpelling = () => {
    if (!currentWord || !currentAnswer.trim()) return
    
    const correct = currentAnswer.toLowerCase().trim() === currentWord.word.toLowerCase()
    const responseTime = (Date.now() - wordStartTime) / 1000
    
    setIsCorrect(correct)
    setShowFeedback(true)
    
    // Update word attempt
    const currentWordAttempt = wordAttempts[currentWordIndex]
    const updatedAttempt = SpellingSessionManager.addWordAttempt(
      currentWordAttempt,
      currentAnswer,
      hintLevel,
      correct
    )
    
    const updatedAttempts = [...wordAttempts]
    updatedAttempts[currentWordIndex] = updatedAttempt
    setWordAttempts(updatedAttempts)
    
    // Calculate points based on hints used and correctness
    let points = 0
    if (correct) {
      points = Math.max(10 - (hintLevel * 2), 2) // Base 10 points, -2 per hint, minimum 2
      toast.success(t('spelling.correctPoints', { points }), {
        icon: '🎉',
        duration: 2000,
      })
    } else {
      toast.error(t('spelling.tryAgain'), {
        icon: '💪',
        duration: 1500,
      })
    }
    
    // Update stats
    setSessionStats(prev => ({
      ...prev,
      wordsAttempted: prev.wordsAttempted + 1,
      wordsCorrect: prev.wordsCorrect + (correct ? 1 : 0),
      pointsEarned: prev.pointsEarned + points,
      totalTime: (Date.now() - sessionStartTime) / 1000
    }))
    
    // Update progress in backend
    if (user && currentWord) {
      updateProgress(currentWord.id, correct, responseTime)
    }
    
    // Auto-advance after feedback
    setTimeout(() => {
      if (correct) {
        handleNextWord()
      } else {
        setShowFeedback(false)
        setCurrentAnswer('')
      }
    }, 2000)
  }
  
  const handleNextWord = () => {
    if (currentWordIndex < sessionWords.length - 1) {
      setCurrentWordIndex(prev => prev + 1)
      const nextWord = sessionWords[currentWordIndex + 1]
      useVocabularyStore.getState().setCurrentWord(nextWord)
      resetWordState()
    } else {
      // Session complete
      setSessionComplete(true)
      setSessionActive(false)
      const totalTime = (Date.now() - sessionStartTime) / 1000
      setSessionStats(prev => ({
        ...prev,
        totalTime
      }))
      SpellingSessionManager.clearSession()
    }
  }

  const handlePreviousWord = () => {
    if (currentWordIndex > 0) {
      setCurrentWordIndex(prev => prev - 1)
      const prevWord = sessionWords[currentWordIndex - 1]
      useVocabularyStore.getState().setCurrentWord(prevWord)
      
      // Restore state for previous word if it was attempted
      const wordAttempt = wordAttempts[currentWordIndex - 1]
      if (wordAttempt && wordAttempt.attempts.length > 0) {
        const lastAttempt = wordAttempt.attempts[wordAttempt.attempts.length - 1]
        setCurrentAnswer(lastAttempt.answer)
        setHintLevel(lastAttempt.hintLevel)
        setIsCorrect(lastAttempt.isCorrect)
        setShowFeedback(true)
      } else {
        resetWordState()
      }
    }
  }
  
  const handleSkipWord = () => {
    if (hintLevel < 5) {
      setHintLevel(5) // Show the complete word
      setTimeout(() => {
        handleNextWord()
      }, 3000)
    } else {
      handleNextWord()
    }
  }
  
  const handleAbandonSession = () => {
    if (confirm(t('spelling.abandonConfirm'))) {
      SpellingSessionManager.clearSession()
      navigate('/dashboard')
    }
  }

  const restartSession = () => {
    SpellingSessionManager.clearSession()
    setSessionComplete(false)
    setSessionStats({
      wordsAttempted: 0,
      wordsCorrect: 0,
      totalHintsUsed: 0,
      totalTime: 0,
      pointsEarned: 0
    })
    startNewSpellingSession()
  }
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentAnswer(e.target.value)
    if (showFeedback) {
      setShowFeedback(false)
      setIsCorrect(null)
    }
  }
  
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !showFeedback) {
      checkSpelling()
    }
  }
  
  if (isResuming) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-teal-50">
        <div className="flex items-center justify-center h-screen">
          <div className="text-center max-w-md mx-auto px-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">{t('spelling.resuming')}</h2>
            <p className="text-gray-600">
              {t('spelling.resumingDesc')}
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (sessionComplete) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-teal-50">
        <div className="max-w-2xl mx-auto px-4 py-16">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-xl p-8 text-center"
          >
            <Trophy className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-gray-800 mb-4">{t('spelling.completeTitle')}</h2>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-green-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-green-600">{sessionStats.wordsCorrect}</div>
                <div className="text-sm text-gray-600">{t('spelling.wordsCorrect')}</div>
              </div>
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-blue-600">{sessionStats.pointsEarned}</div>
                <div className="text-sm text-gray-600">{t('spelling.pointsEarned')}</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-purple-600">{Math.round(sessionStats.totalTime)}s</div>
                <div className="text-sm text-gray-600">{t('spelling.totalTime')}</div>
              </div>
              <div className="bg-orange-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-orange-600">
                  {sessionStats.wordsAttempted > 0 ? Math.round((sessionStats.wordsCorrect / sessionStats.wordsAttempted) * 100) : 0}%
                </div>
                <div className="text-sm text-gray-600">{t('spelling.accuracy')}</div>
              </div>
            </div>
            
            <div className="space-y-3">
              <button
                onClick={restartSession}
                className="w-full bg-gradient-to-r from-green-600 to-teal-600 text-white px-6 py-3 rounded-xl font-medium hover:from-green-700 hover:to-teal-700 transition-all duration-200"
              >
                <RotateCcw className="w-5 h-5 inline mr-2" />
                {t('spelling.playAgain')}
              </button>
              <button
                onClick={() => navigate('/dashboard')}
                className="w-full bg-gray-100 text-gray-700 px-6 py-3 rounded-xl font-medium hover:bg-gray-200 transition-all duration-200"
              >
                {t('spelling.backToDashboard')}
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    )
  }
  
  if (initializationError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-teal-50">
        <div className="flex items-center justify-center h-screen">
          <div className="text-center max-w-md mx-auto px-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-red-800 mb-2">{t('spelling.errorTitle')}</h2>
              <p className="text-red-600 mb-4">
                {t('spelling.errorDesc')}
              </p>
              <div className="space-y-2">
                <button
                  onClick={() => window.location.reload()}
                  className="w-full bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
                >
                  {t('spelling.refreshPage')}
                </button>
                <button
                  onClick={() => navigate('/dashboard')}
                  className="w-full bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  {t('spelling.backToDashboard')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!sessionActive || !currentWord) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-teal-50">
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
            <p className="text-gray-600">{t('spelling.loading')}</p>
          </div>
        </div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-teal-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-white/20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="flex items-center space-x-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>{t('spelling.dashboard')}</span>
              </button>
              <button
                onClick={handleAbandonSession}
                className="text-red-600 hover:text-red-800 transition-colors text-sm"
              >
                {t('spelling.abandon')}
              </button>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <Target className="w-4 h-4" />
                <span>{sessionStats.wordsCorrect}/{sessionStats.wordsAttempted}</span>
              </div>
              <div className="flex items-center space-x-2 text-sm text-green-600 font-medium">
                <Trophy className="w-4 h-4" />
                <span>{t('spelling.pts', { points: sessionStats.pointsEarned })}</span>
              </div>
            </div>
            
            <button
              onClick={() => setAudioEnabled(!audioEnabled)}
              className={`p-2 rounded-lg transition-colors ${
                audioEnabled 
                  ? 'bg-green-100 text-green-600 hover:bg-green-200' 
                  : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
              }`}
            >
              {audioEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="bg-white/60 border-b border-white/20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                {t('spelling.wordOf', { current: currentWordIndex + 1, total: sessionWords.length })}
              </span>
              {wordAttempts[currentWordIndex]?.completed && (
                <span className="text-green-600 text-sm">{t('spelling.completed')}</span>
              )}
            </div>
            <div className="w-full max-w-xs bg-gray-200 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-green-500 to-teal-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${((currentWordIndex + 1) / sessionWords.length) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          key={currentWord.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-lg p-8"
        >
          {/* Audio Control */}
          <div className="text-center mb-8">
            <button
              onClick={playWordAudio}
              disabled={isPlaying || !audioEnabled}
              className={`inline-flex items-center justify-center w-20 h-20 rounded-full transition-all duration-200 ${
                isPlaying
                  ? 'bg-green-200 text-green-600 cursor-not-allowed'
                  : 'bg-gradient-to-r from-green-600 to-teal-600 text-white hover:from-green-700 hover:to-teal-700 hover:scale-105 shadow-lg'
              }`}
            >
              <Volume2 className={`w-8 h-8 ${isPlaying ? 'animate-pulse' : ''}`} />
            </button>
            <p className="text-gray-600 mt-3 text-lg">
              {isPlaying ? t('spelling.playingAudio') : t('spelling.clickToHear')}
            </p>
          </div>
          
          {/* Hint Display */}
          <div className="text-center mb-8">
            <AnimatePresence mode="wait">
              {hintLevel > 0 && (
                <motion.div
                  key={hintLevel}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4"
                >
                  <div className="flex items-center justify-center space-x-2 text-yellow-700">
                    <Lightbulb className="w-5 h-5" />
                    <span className="font-medium">{t('spelling.hintLabel', { level: hintLevel })}</span>
                  </div>
                  <div className="mt-2 text-lg font-mono tracking-wider">
                    {getWordHint(currentWord.word, hintLevel)}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          {/* Spelling Input */}
          <div className="mb-6">
            <input
              type="text"
              value={currentAnswer}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              placeholder={t('spelling.spellingPlaceholder')}
              disabled={showFeedback}
              className={`w-full text-2xl text-center p-4 border-2 rounded-xl focus:outline-none focus:ring-4 transition-all duration-200 ${
                showFeedback
                  ? isCorrect
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-red-500 bg-red-50 text-red-700'
                  : 'border-gray-300 focus:border-green-500 focus:ring-green-200'
              }`}
            />
          </div>
          
          {/* Feedback */}
          <AnimatePresence>
            {showFeedback && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className={`text-center mb-6 p-4 rounded-lg ${
                  isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}
              >
                <div className="flex items-center justify-center space-x-2 text-lg font-medium">
                  {isCorrect ? (
                    <>
                      <CheckCircle className="w-6 h-6" />
                      <span>{t('spelling.excellent')}</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-6 h-6" />
                      <span>{t('spelling.notQuite')}</span>
                    </>
                  )}
                </div>
                {isCorrect && (
                  <div className="mt-2 text-sm">
                    <strong>{currentWord.word}</strong> - {currentWord.definition}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
          
          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            {!showFeedback && (
              <>
                <button
                  onClick={checkSpelling}
                  disabled={!currentAnswer.trim()}
                  className="flex-1 bg-gradient-to-r from-green-600 to-teal-600 text-white px-6 py-3 rounded-xl font-medium hover:from-green-700 hover:to-teal-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('spelling.checkSpelling')}
                </button>
                
                <button
                  onClick={handleHintRequest}
                  disabled={hintLevel >= 5}
                  className="px-6 py-3 bg-yellow-100 text-yellow-700 rounded-xl font-medium hover:bg-yellow-200 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Lightbulb className="w-4 h-4 inline mr-2" />
                  {hintLevel >= 5 ? t('spelling.allHintsUsed') : t('spelling.getHint')}
                </button>
                
                <button
                  onClick={handleSkipWord}
                  className="px-6 py-3 bg-gray-100 text-gray-600 rounded-xl font-medium hover:bg-gray-200 transition-all duration-200"
                >
                  {t('spelling.skipWord')}
                </button>
              </>
            )}
          </div>
        </motion.div>
        

        {/* Navigation Controls */}
        <div className="flex items-center justify-between mt-8">
          <button
            onClick={handlePreviousWord}
            disabled={currentWordIndex === 0}
            className="flex items-center space-x-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>{t('spelling.previous')}</span>
          </button>

          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <span>{t('spelling.wordOf', { current: currentWordIndex + 1, total: sessionWords.length })}</span>
            {wordAttempts[currentWordIndex]?.completed && (
              <span className="text-green-600">{t('spelling.completed')}</span>
            )}
          </div>

          <button
            onClick={handleNextWord}
            disabled={currentWordIndex >= sessionWords.length - 1}
            className="flex items-center space-x-2 px-4 py-2 bg-green-100 hover:bg-green-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            <span>{t('spelling.next')}</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
