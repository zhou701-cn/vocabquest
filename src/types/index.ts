// Auth Types（自建后端登录会话中的用户基本信息）
export interface AuthUser {
  id: string
  email: string
  full_name?: string
  role?: string
  created_at?: string
}

// Database Types
export interface User {
  id: string
  email: string
  full_name: string
  role: 'student' | 'admin'
  grade_level?: number
  date_of_birth?: string
  parent_email?: string
  preferences: Record<string, any>
  created_at: string
  updated_at: string
  last_active?: string
  is_active: boolean
}

export interface VocabularyList {
  id: string
  name: string
  description?: string
  created_by?: string
  is_default: boolean
  is_public: boolean
  category: string
  difficulty_level: number
  target_grade_level?: number
  word_count: number
  tags: string[]
  metadata: Record<string, any>
  created_at: string
  updated_at: string
  is_active: boolean
}

export interface VocabularyWord {
  id: string
  list_id: string
  word: string
  part_of_speech: 'noun' | 'verb' | 'adjective' | 'adverb' | 'pronoun' | 'preposition' | 'conjunction' | 'interjection'
  definition: string
  simple_definition?: string
  example_sentence: string
  example_context?: string
  synonyms: string[]
  antonyms: string[]
  difficulty_level: number
  frequency_score: number
  ssat_importance: number
  audio_url?: string
  image_url?: string
  pronunciation_guide?: string
  etymology?: string
  related_words: string[]
  usage_notes?: string
  created_at: string
  updated_at: string
  sort_order: number
}

export interface UserProgress {
  id: string
  user_id: string
  word_id: string
  current_level: number
  ease_factor: number
  interval_days: number
  last_reviewed?: string
  next_review: string
  consecutive_correct: number
  total_attempts: number
  total_correct: number
  success_rate: number
  first_learned?: string
  is_learned: boolean
  created_at: string
  updated_at: string
}

export interface UserGamification {
  id: string
  user_id: string
  total_points: number
  current_level: number
  current_xp: number
  xp_to_next_level: number
  current_streak: number
  longest_streak: number
  last_activity_date?: string
  words_learned: number
  total_time_minutes: number
  achievements_earned: number
  created_at: string
  updated_at: string
}

export interface Badge {
  id: string
  name: string
  description: string
  icon_url?: string
  category: string
  requirements: Record<string, any>
  points_reward: number
  is_active: boolean
  created_at: string
}

export interface UserBadge {
  id: string
  user_id: string
  badge_id: string
  earned_at: string
  progress_data: Record<string, any>
  badge?: Badge
}

export interface Challenge {
  id: string
  title: string
  description: string
  challenge_type: 'daily' | 'weekly' | 'monthly' | 'special'
  requirements: Record<string, any>
  rewards: Record<string, any>
  start_date?: string
  end_date?: string
  is_active: boolean
  created_at: string
}

export interface UserChallenge {
  id: string
  user_id: string
  challenge_id: string
  progress: Record<string, any>
  is_completed: boolean
  completed_at?: string
  started_at: string
  challenge?: Challenge
}

export interface LearningSession {
  id: string
  user_id: string
  session_start: string
  session_end?: string
  duration_minutes?: number
  mode: 'flashcards' | 'quiz' | 'spelling' | 'review'
  words_studied: number
  words_correct: number
  accuracy_percentage?: number
  points_earned: number
  metadata: Record<string, any>
  is_completed: boolean
  created_at: string
}

export interface DailyGoal {
  id: string
  user_id: string
  goal_date: string
  target_words: number
  target_minutes: number
  target_accuracy: number
  words_completed: number
  minutes_completed: number
  current_accuracy: number
  is_completed: boolean
  bonus_points: number
  created_at: string
}

// Learning Mode Types
export type LearningMode = 'flashcards' | 'quiz' | 'spelling' | 'review'
export type QuizType = 'multiple_choice' | 'fill_blank' | 'matching'
export type ReviewMode = 'definition-to-word' | 'word-to-definition' | 'audio-pronunciation'

export interface QuizQuestion {
  id: string
  word_id: string
  question_type: QuizType
  question_text: string
  options?: string[]
  correct_answer: string
  explanation?: string
  difficulty_level: number
}

// API Response Types
export interface ApiResponse<T> {
  data?: T
  error?: {
    code: string
    message: string
  }
}

export interface SpacedRepetitionUpdate {
  user_id: string
  word_id: string
  is_correct: boolean
  response_time_seconds?: number
  learning_mode?: LearningMode
}

export interface UserProfileData {
  full_name?: string
  role?: 'student' | 'admin'
  grade_level?: number
  date_of_birth?: string
  parent_email?: string
  preferences?: Record<string, any>
}

// Smart Review Types
export interface Achievement {
  id: string
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  color: string
  points: number
}

export interface ReviewSession {
  totalWords: number
  currentIndex: number
  correctAnswers: number
  startTime: Date
  wordsReviewed: Array<{
    word: VocabularyWord
    isCorrect: boolean
    responseTime: number
  }>
  currentStreak: number
  maxStreak: number
  pointsEarned: number
  quickAnswers: number
}

export interface DailyLearningStats {
  words_reviewed: number
  words_learned_today: number
  accuracy_today: number
  points_earned_today: number
  streak_count: number
}