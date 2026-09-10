import { create } from 'zustand'
import { apiFetch } from '@/lib/api'
import { VocabularyWord, VocabularyList, UserProgress, LearningMode } from '@/types'
import toast from 'react-hot-toast'

interface VocabularyStore {
  // State
  vocabularyLists: VocabularyList[]
  currentList: VocabularyList | null
  words: VocabularyWord[]
  currentWord: VocabularyWord | null
  userProgress: Record<string, UserProgress>
  loading: boolean
  currentSessionWords: VocabularyWord[]
  sessionMode: LearningMode | null
  reviewWords: VocabularyWord[]

  // Actions
  fetchVocabularyLists: () => Promise<void>
  setCurrentList: (list: VocabularyList) => Promise<void>
  fetchWordsForList: (listId: string) => Promise<void>
  fetchUserProgress: (userId: string) => Promise<void>
  setCurrentWord: (word: VocabularyWord | null) => void
  startLearningSession: (mode: LearningMode, words?: VocabularyWord[]) => void
  getNextWord: () => VocabularyWord | null
  updateProgress: (wordId: string, isCorrect: boolean, responseTime?: number) => Promise<void>
  getWordsForReview: (userId: string) => Promise<VocabularyWord[]>
  getRandomWords: (count: number, excludeIds?: string[]) => VocabularyWord[]
}

export const useVocabularyStore = create<VocabularyStore>((set, get) => ({
  // Initial state
  vocabularyLists: [],
  currentList: null,
  words: [],
  currentWord: null,
  userProgress: {},
  loading: false,
  currentSessionWords: [],
  sessionMode: null,
  reviewWords: [],

  // Actions
  fetchVocabularyLists: async () => {
    set({ loading: true })
    try {
      const data = await apiFetch<VocabularyList[]>('/vocabulary/lists')

      set({ vocabularyLists: data || [] })

      // Set default list as current if none selected
      const defaultList = data?.find(list => list.is_default)
      if (defaultList && !get().currentList) {
        get().setCurrentList(defaultList)
      }
    } catch (error) {
      console.error('Error fetching vocabulary lists:', error)
      toast.error('Failed to load vocabulary lists')
    } finally {
      set({ loading: false })
    }
  },

  setCurrentList: async (list: VocabularyList) => {
    set({ currentList: list, words: [], currentWord: null })
    await get().fetchWordsForList(list.id)
  },

  fetchWordsForList: async (listId: string) => {
    set({ loading: true })
    try {
      const data = await apiFetch<VocabularyWord[]>(`/vocabulary/lists/${listId}/words`)
      set({ words: data || [] })
    } catch (error) {
      console.error('Error fetching words:', error)
      toast.error('Failed to load vocabulary words')
    } finally {
      set({ loading: false })
    }
  },

  fetchUserProgress: async (userId: string) => {
    try {
      const data = await apiFetch<UserProgress[]>('/progress')

      const progressMap = (data || []).reduce((acc, progress) => {
        acc[progress.word_id] = progress
        return acc
      }, {} as Record<string, UserProgress>)

      set({ userProgress: progressMap })
    } catch (error) {
      console.error('Error fetching user progress:', error)
    }
  },

  setCurrentWord: (word: VocabularyWord | null) => {
    set({ currentWord: word })
  },

  startLearningSession: (mode: LearningMode, words?: VocabularyWord[]) => {
    const { words: allWords, userProgress } = get()

    let sessionWords: VocabularyWord[]

    if (words) {
      sessionWords = words
    } else {
      // Select words based on mode
      switch (mode) {
        case 'review':
          // Words that need review (based on spaced repetition)
          const now = new Date()
          sessionWords = allWords.filter(word => {
            const progress = userProgress[word.id]
            if (!progress) return true // New words need review
            return new Date(progress.next_review) <= now
          }).slice(0, 20) // Limit to 20 words
          break
        case 'flashcards':
        case 'quiz':
        case 'spelling':
        default:
          // Random selection of words, prioritizing unlearned ones
          const unlearnedWords = allWords.filter(word => {
            const progress = userProgress[word.id]
            return !progress || !progress.is_learned
          })
          sessionWords = unlearnedWords.slice(0, 20)
          break
      }
    }

    set({
      sessionMode: mode,
      currentSessionWords: sessionWords,
      currentWord: sessionWords[0] || null
    })
  },

  getNextWord: () => {
    const { currentSessionWords, currentWord } = get()

    if (!currentWord || currentSessionWords.length === 0) {
      return null
    }

    const currentIndex = currentSessionWords.findIndex(w => w.id === currentWord.id)
    const nextIndex = currentIndex + 1

    if (nextIndex < currentSessionWords.length) {
      const nextWord = currentSessionWords[nextIndex]
      set({ currentWord: nextWord })
      return nextWord
    }

    // Session complete
    set({ currentWord: null, sessionMode: null, currentSessionWords: [] })
    return null
  },

  updateProgress: async (wordId: string, isCorrect: boolean, responseTime?: number) => {
    try {
      const { sessionMode } = get()

      const data = await apiFetch<{ data: { progress: any; points_earned: number } }>(
        '/progress/spaced-repetition',
        {
          method: 'POST',
          body: {
            word_id: wordId,
            is_correct: isCorrect,
            response_time_seconds: responseTime,
            learning_mode: sessionMode,
          },
        },
      )

      // Update local progress state
      if (data?.data?.progress) {
        const progress = data.data.progress
        set(state => ({
          userProgress: {
            ...state.userProgress,
            [wordId]: {
              ...state.userProgress[wordId],
              id: state.userProgress[wordId]?.id || wordId, // Use existing id or fallback
              user_id: state.userProgress[wordId]?.user_id || '', // Will be set properly
              word_id: wordId,
              current_level: progress.current_level,
              ease_factor: progress.ease_factor || 2.5,
              interval_days: progress.interval_hours || 1,
              next_review: progress.next_review,
              consecutive_correct: progress.consecutive_correct,
              total_attempts: state.userProgress[wordId]?.total_attempts || 1,
              total_correct: state.userProgress[wordId]?.total_correct || (isCorrect ? 1 : 0),
              success_rate: progress.success_rate,
              first_learned: state.userProgress[wordId]?.first_learned || new Date().toISOString(),
              is_learned: progress.is_learned,
              created_at: state.userProgress[wordId]?.created_at || new Date().toISOString()
            } as UserProgress
          }
        }))
      }

      // Show points earned
      if (data?.data?.points_earned > 0) {
        toast.success(`+${data.data.points_earned} points!`, {
          icon: '🎉',
          duration: 2000
        })
      }
    } catch (error) {
      console.error('Error updating progress:', error)
    }
  },

  getWordsForReview: async (userId: string) => {
    try {
      // Try to use the server-side review function first
      const data = await apiFetch<VocabularyWord[]>('/progress/review-words?limit=20')

      if (data && data.length > 0) {
        set({ reviewWords: data })
        return data
      }

      // Fallback: get words that haven't been reviewed recently
      const { words, userProgress } = get()
      const now = new Date()
      const allWords = words.filter(word => {
        const progress = userProgress[word.id]
        if (!progress) return true // New words need review
        return new Date(progress.next_review) <= now
      })

      // If no words need review, get some random words for practice
      if (allWords.length === 0) {
        const randomWords = words.slice(0, Math.min(10, words.length))
        set({ reviewWords: randomWords })
        return randomWords
      }

      const reviewWords = allWords.slice(0, 20)
      set({ reviewWords })
      return reviewWords
    } catch (error) {
      console.error('Error fetching words for review:', error)
      // Fallback to available words
      const { words } = get()
      const fallbackWords = words.slice(0, Math.min(10, words.length))
      set({ reviewWords: fallbackWords })
      return fallbackWords
    }
  },

  getRandomWords: (count: number, excludeIds: string[] = []) => {
    const { words } = get()
    const availableWords = words.filter(word => !excludeIds.includes(word.id))

    // Shuffle and take requested count
    const shuffled = [...availableWords].sort(() => Math.random() - 0.5)
    return shuffled.slice(0, count)
  }
}))
