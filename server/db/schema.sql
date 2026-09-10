-- VocabQuest PostgreSQL Schema（自建 PostgreSQL 版）
-- 由 supabase/migrations 合并改造而来：
--   * users 表增加 password_hash（替代 Supabase auth.users）
--   * 移除所有 RLS / auth.uid() 依赖（鉴权由后端 API 层负责）
--   * 合并 learning_sessions.is_completed、user_progress.interval_days 精度修补
-- 初始化：psql -U postgres -d vocabquest -f schema.sql

-- ============ 枚举类型 ============
CREATE TYPE user_role AS ENUM ('student', 'teacher', 'parent', 'admin');
CREATE TYPE part_of_speech_type AS ENUM (
  'noun', 'verb', 'adjective', 'adverb', 'pronoun',
  'preposition', 'conjunction', 'interjection'
);
CREATE TYPE learning_mode AS ENUM ('flashcards', 'quiz', 'spelling', 'review');
CREATE TYPE quiz_type AS ENUM ('multiple_choice', 'fill_blank', 'matching');
CREATE TYPE challenge_type AS ENUM ('daily', 'weekly', 'monthly', 'special');

-- ============ 1. users ============
CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'student',
  grade_level INTEGER,
  date_of_birth DATE,
  parent_email TEXT,
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_active TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT TRUE
);

-- ============ 2. vocabulary_lists ============
CREATE TABLE vocabulary_lists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID,
  is_default BOOLEAN DEFAULT FALSE,
  is_public BOOLEAN DEFAULT FALSE,
  category TEXT NOT NULL,
  difficulty_level INTEGER CHECK (difficulty_level BETWEEN 1 AND 5),
  target_grade_level INTEGER,
  word_count INTEGER DEFAULT 0,
  tags TEXT[],
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);

-- ============ 3. vocabulary_words ============
CREATE TABLE vocabulary_words (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  list_id UUID NOT NULL,
  word TEXT NOT NULL,
  part_of_speech part_of_speech_type,
  definition TEXT NOT NULL,
  simple_definition TEXT,
  example_sentence TEXT NOT NULL,
  example_context TEXT,
  synonyms TEXT[],
  antonyms TEXT[],
  difficulty_level INTEGER CHECK (difficulty_level BETWEEN 1 AND 5),
  frequency_score INTEGER CHECK (frequency_score BETWEEN 1 AND 5),
  ssat_importance INTEGER CHECK (ssat_importance BETWEEN 1 AND 5),
  audio_url TEXT,
  image_url TEXT,
  pronunciation_guide TEXT,
  etymology TEXT,
  related_words TEXT[],
  usage_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sort_order INTEGER DEFAULT 0
);

-- ============ 4. user_progress ============
CREATE TABLE user_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  word_id UUID NOT NULL,
  current_level INTEGER DEFAULT 0,
  ease_factor DECIMAL(3,2) DEFAULT 2.50,
  interval_days DECIMAL(8,2) DEFAULT 1,
  last_reviewed TIMESTAMP WITH TIME ZONE,
  next_review TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  consecutive_correct INTEGER DEFAULT 0,
  total_attempts INTEGER DEFAULT 0,
  total_correct INTEGER DEFAULT 0,
  success_rate DECIMAL(5,2) DEFAULT 0.00,
  first_learned TIMESTAMP WITH TIME ZONE,
  is_learned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============ 5. user_gamification ============
CREATE TABLE user_gamification (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  total_points INTEGER DEFAULT 0,
  current_level INTEGER DEFAULT 1,
  current_xp INTEGER DEFAULT 0,
  xp_to_next_level INTEGER DEFAULT 100,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_activity_date DATE,
  words_learned INTEGER DEFAULT 0,
  total_time_minutes INTEGER DEFAULT 0,
  achievements_earned INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============ 6. badges ============
CREATE TABLE badges (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  icon_url TEXT,
  category TEXT NOT NULL,
  requirements JSONB NOT NULL,
  points_reward INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============ 7. user_badges ============
CREATE TABLE user_badges (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  badge_id UUID NOT NULL,
  earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  progress_data JSONB DEFAULT '{}'
);

-- ============ 8. challenges ============
CREATE TABLE challenges (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  challenge_type challenge_type NOT NULL,
  requirements JSONB NOT NULL,
  rewards JSONB NOT NULL,
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============ 9. user_challenges ============
CREATE TABLE user_challenges (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  challenge_id UUID NOT NULL,
  progress JSONB DEFAULT '{}',
  is_completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============ 10. learning_sessions ============
CREATE TABLE learning_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  session_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  session_end TIMESTAMP WITH TIME ZONE,
  duration_minutes INTEGER,
  mode learning_mode NOT NULL,
  words_studied INTEGER DEFAULT 0,
  words_correct INTEGER DEFAULT 0,
  accuracy_percentage DECIMAL(5,2),
  points_earned INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  is_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============ 11. quiz_attempts ============
CREATE TABLE quiz_attempts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  session_id UUID,
  word_id UUID NOT NULL,
  quiz_type quiz_type NOT NULL,
  question TEXT NOT NULL,
  user_answer TEXT,
  correct_answer TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  time_taken_seconds INTEGER,
  hint_used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============ 12. spelling_attempts ============
CREATE TABLE spelling_attempts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  session_id UUID,
  word_id UUID NOT NULL,
  user_spelling TEXT NOT NULL,
  correct_spelling TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  attempts_count INTEGER DEFAULT 1,
  hints_used INTEGER DEFAULT 0,
  time_taken_seconds INTEGER,
  mistake_analysis JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============ 13. user_word_lists ============
CREATE TABLE user_word_lists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  list_id UUID NOT NULL,
  assigned_by UUID,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,
  progress_percentage DECIMAL(5,2) DEFAULT 0.00,
  words_mastered INTEGER DEFAULT 0,
  last_studied TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============ 14. daily_goals ============
CREATE TABLE daily_goals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  goal_date DATE NOT NULL,
  target_words INTEGER DEFAULT 10,
  target_minutes INTEGER DEFAULT 20,
  target_accuracy DECIMAL(5,2) DEFAULT 80.00,
  words_completed INTEGER DEFAULT 0,
  minutes_completed INTEGER DEFAULT 0,
  current_accuracy DECIMAL(5,2) DEFAULT 0.00,
  is_completed BOOLEAN DEFAULT FALSE,
  bonus_points INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============ 15. activity_log ============
CREATE TABLE activity_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  activity_type TEXT NOT NULL,
  activity_data JSONB DEFAULT '{}',
  points_earned INTEGER DEFAULT 0,
  session_id UUID,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============ 16. poem_projects ============
CREATE TABLE poem_projects (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL,
  name        TEXT NOT NULL,
  file_name   TEXT DEFAULT '',
  format      TEXT DEFAULT 'other',
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============ 17. poems ============
CREATE TABLE poems (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id  UUID NOT NULL REFERENCES poem_projects(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL,
  title       TEXT NOT NULL,
  author      TEXT,
  lines       TEXT[] DEFAULT '{}',
  sort_order  INTEGER DEFAULT 0,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============ 18. poem_practice_records ============
CREATE TABLE poem_practice_records (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL,
  poem_id     UUID NOT NULL REFERENCES poems(id) ON DELETE CASCADE,
  project_id  UUID REFERENCES poem_projects(id) ON DELETE CASCADE,
  fingerprint TEXT DEFAULT '',
  recite      JSONB,
  dictate     JSONB,
  updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, poem_id)
);

-- ============ 索引 ============
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_active ON users(is_active, last_active);

CREATE INDEX idx_vocabulary_lists_created_by ON vocabulary_lists(created_by);
CREATE INDEX idx_vocabulary_lists_category ON vocabulary_lists(category);
CREATE INDEX idx_vocabulary_lists_difficulty ON vocabulary_lists(difficulty_level);
CREATE INDEX idx_vocabulary_lists_public ON vocabulary_lists(is_public, is_active);
CREATE INDEX idx_vocabulary_lists_tags ON vocabulary_lists USING GIN(tags);

CREATE INDEX idx_vocabulary_words_list_id ON vocabulary_words(list_id);
CREATE INDEX idx_vocabulary_words_word ON vocabulary_words(word);
CREATE INDEX idx_vocabulary_words_difficulty ON vocabulary_words(difficulty_level);
CREATE UNIQUE INDEX idx_vocabulary_words_unique ON vocabulary_words(list_id, word);

CREATE INDEX idx_user_progress_user_id ON user_progress(user_id);
CREATE INDEX idx_user_progress_word_id ON user_progress(word_id);
CREATE INDEX idx_user_progress_user_word ON user_progress(user_id, word_id);
CREATE INDEX idx_user_progress_next_review ON user_progress(user_id, next_review);

CREATE INDEX idx_user_gamification_user_id ON user_gamification(user_id);
CREATE INDEX idx_user_gamification_level ON user_gamification(current_level);
CREATE INDEX idx_user_gamification_points ON user_gamification(total_points);

CREATE INDEX idx_badges_category ON badges(category);
CREATE INDEX idx_badges_active ON badges(is_active);
CREATE INDEX idx_user_badges_user_id ON user_badges(user_id);
CREATE INDEX idx_user_badges_badge_id ON user_badges(badge_id);
CREATE UNIQUE INDEX idx_user_badges_unique ON user_badges(user_id, badge_id);

CREATE INDEX idx_challenges_type ON challenges(challenge_type);
CREATE INDEX idx_challenges_active ON challenges(is_active);
CREATE INDEX idx_challenges_dates ON challenges(start_date, end_date);
CREATE INDEX idx_user_challenges_user_id ON user_challenges(user_id);
CREATE INDEX idx_user_challenges_challenge_id ON user_challenges(challenge_id);
CREATE INDEX idx_user_challenges_completed ON user_challenges(is_completed);

CREATE INDEX idx_learning_sessions_user_id ON learning_sessions(user_id);
CREATE INDEX idx_learning_sessions_start ON learning_sessions(session_start);
CREATE INDEX idx_learning_sessions_mode ON learning_sessions(mode);
CREATE INDEX idx_learning_sessions_user_date ON learning_sessions(user_id, session_start);
CREATE INDEX idx_learning_sessions_completed ON learning_sessions(user_id, is_completed, session_start);

CREATE INDEX idx_quiz_attempts_user_id ON quiz_attempts(user_id);
CREATE INDEX idx_quiz_attempts_word_id ON quiz_attempts(word_id);
CREATE INDEX idx_quiz_attempts_session_id ON quiz_attempts(session_id);
CREATE INDEX idx_quiz_attempts_created_at ON quiz_attempts(created_at);

CREATE INDEX idx_spelling_attempts_user_id ON spelling_attempts(user_id);
CREATE INDEX idx_spelling_attempts_word_id ON spelling_attempts(word_id);
CREATE INDEX idx_spelling_attempts_session_id ON spelling_attempts(session_id);
CREATE INDEX idx_spelling_attempts_created_at ON spelling_attempts(created_at);

CREATE INDEX idx_user_word_lists_user_id ON user_word_lists(user_id);
CREATE INDEX idx_user_word_lists_list_id ON user_word_lists(list_id);
CREATE INDEX idx_user_word_lists_active ON user_word_lists(is_active);
CREATE UNIQUE INDEX idx_user_word_lists_unique ON user_word_lists(user_id, list_id);

CREATE INDEX idx_daily_goals_user_id ON daily_goals(user_id);
CREATE INDEX idx_daily_goals_date ON daily_goals(goal_date);
CREATE INDEX idx_daily_goals_user_date ON daily_goals(user_id, goal_date);

CREATE INDEX idx_activity_log_user_id ON activity_log(user_id);
CREATE INDEX idx_activity_log_type ON activity_log(activity_type);
CREATE INDEX idx_activity_log_created_at ON activity_log(created_at);
CREATE INDEX idx_activity_log_user_date ON activity_log(user_id, created_at);

CREATE INDEX idx_poem_projects_user ON poem_projects(user_id);
CREATE INDEX idx_poems_project ON poems(project_id);
CREATE INDEX idx_poems_user ON poems(user_id);
CREATE INDEX idx_poem_practice_user ON poem_practice_records(user_id);
CREATE INDEX idx_poem_practice_poem ON poem_practice_records(poem_id);

-- ============ SQL 函数（原样保留，纯 SQL 无 Supabase 依赖） ============
CREATE OR REPLACE FUNCTION get_words_for_review(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
    id UUID,
    list_id UUID,
    word TEXT,
    part_of_speech TEXT,
    definition TEXT,
    simple_definition TEXT,
    example_sentence TEXT,
    example_context TEXT,
    synonyms TEXT[],
    antonyms TEXT[],
    difficulty_level INTEGER,
    frequency_score INTEGER,
    ssat_importance INTEGER,
    audio_url TEXT,
    image_url TEXT,
    pronunciation_guide TEXT,
    etymology TEXT,
    related_words TEXT[],
    usage_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    sort_order INTEGER,
    current_level INTEGER,
    next_review TIMESTAMP WITH TIME ZONE,
    success_rate DECIMAL(5,2),
    is_learned BOOLEAN
)
LANGUAGE SQL
AS $$
SELECT
    vw.id,
    vw.list_id,
    vw.word,
    vw.part_of_speech::TEXT,
    vw.definition,
    vw.simple_definition,
    vw.example_sentence,
    vw.example_context,
    vw.synonyms,
    vw.antonyms,
    vw.difficulty_level,
    vw.frequency_score,
    vw.ssat_importance,
    vw.audio_url,
    vw.image_url,
    vw.pronunciation_guide,
    vw.etymology,
    vw.related_words,
    vw.usage_notes,
    vw.created_at,
    vw.updated_at,
    vw.sort_order,
    COALESCE(up.current_level, 0) as current_level,
    COALESCE(up.next_review, NOW()) as next_review,
    COALESCE(up.success_rate, 0.0) as success_rate,
    COALESCE(up.is_learned, FALSE) as is_learned
FROM vocabulary_words vw
LEFT JOIN user_progress up ON vw.id = up.word_id AND up.user_id = p_user_id
WHERE
    (up.next_review IS NULL OR up.next_review <= NOW())
ORDER BY
    (up.id IS NULL) DESC,
    COALESCE(up.success_rate, 0) ASC,
    COALESCE(up.current_level, 0) ASC,
    vw.difficulty_level ASC,
    vw.ssat_importance DESC,
    RANDOM()
LIMIT p_limit;
$$;

CREATE OR REPLACE FUNCTION get_daily_learning_stats(
    p_user_id UUID,
    p_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSON
LANGUAGE SQL
AS $$
SELECT json_build_object(
    'words_reviewed', (
        SELECT COUNT(*)
        FROM activity_log
        WHERE user_id = p_user_id
        AND DATE(created_at) = p_date
        AND activity_type LIKE '%_attempt'
    ),
    'words_learned_today', (
        SELECT COUNT(*)
        FROM user_progress
        WHERE user_id = p_user_id
        AND DATE(first_learned) = p_date
        AND is_learned = true
    ),
    'accuracy_today', (
        SELECT COALESCE(
            ROUND(
                (SUM(CASE WHEN (activity_data->>'is_correct')::boolean THEN 1 ELSE 0 END) * 100.0) /
                NULLIF(COUNT(*), 0),
                2
            ),
            0
        )
        FROM activity_log
        WHERE user_id = p_user_id
        AND DATE(created_at) = p_date
        AND activity_type LIKE '%_attempt'
        AND activity_data->>'is_correct' IS NOT NULL
    ),
    'points_earned_today', (
        SELECT COALESCE(SUM(points_earned), 0)
        FROM activity_log
        WHERE user_id = p_user_id
        AND DATE(created_at) = p_date
    ),
    'streak_count', (
        SELECT current_streak
        FROM user_gamification
        WHERE user_id = p_user_id
    )
);
$$;

-- ============ 种子：默认词库列表 ============
INSERT INTO vocabulary_lists (name, description, is_default, is_public, category, difficulty_level, target_grade_level, word_count, tags)
VALUES ('SSAT Core Vocabulary', 'Default SSAT core vocabulary list', TRUE, TRUE, 'SSAT', 3, 4, 0, ARRAY['ssat', 'core']);
