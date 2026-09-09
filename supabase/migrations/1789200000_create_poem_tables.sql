-- Migration: create_poem_tables
-- 诗词库 + 背诵/默写进度 持久化，按用户 RLS 隔离。
-- 与现有库一致：user_id 不加外键（兼容本地 demo 账号不存在于 users 表的情况）。

-- 1) 诗词项目（一次文件导入 / 手动创建）
CREATE TABLE poem_projects (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL,
  name        TEXT NOT NULL,
  file_name   TEXT DEFAULT '',
  format      TEXT DEFAULT 'other',        -- pdf / docx / txt / md / other
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2) 单首诗词
CREATE TABLE poems (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id  UUID NOT NULL REFERENCES poem_projects(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL,               -- 冗余属主，便于按用户直查 + RLS
  title       TEXT NOT NULL,
  author      TEXT,
  lines       TEXT[] DEFAULT '{}',         -- 正文行，对应前端 string[]
  sort_order  INTEGER DEFAULT 0,           -- 项目内排序（对应 movePoem）
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3) 背诵 / 默写进度（一首诗词一条，对应前端 projectId::poemId）
CREATE TABLE poem_practice_records (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL,
  poem_id     UUID NOT NULL REFERENCES poems(id) ON DELETE CASCADE,
  project_id  UUID REFERENCES poem_projects(id) ON DELETE CASCADE,
  fingerprint TEXT DEFAULT '',             -- 正文被编辑后旧进度失效（沿用现有逻辑）
  recite      JSONB,                       -- {completedOnce,bestHintLevelIndex,lastCompletedAt}
  dictate     JSONB,                       -- {completedCount,missedChars[],wrongTypedChars[],lastCompletedAt}
  updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, poem_id)
);

-- 索引
CREATE INDEX idx_poem_projects_user ON poem_projects(user_id);
CREATE INDEX idx_poems_project      ON poems(project_id);
CREATE INDEX idx_poems_user         ON poems(user_id);
CREATE INDEX idx_poem_practice_user ON poem_practice_records(user_id);
CREATE INDEX idx_poem_practice_poem ON poem_practice_records(poem_id);

-- 行级安全：每个用户只能读写自己的数据
ALTER TABLE poem_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE poems ENABLE ROW LEVEL SECURITY;
ALTER TABLE poem_practice_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "poem_projects_owner" ON poem_projects
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "poems_owner" ON poems
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "poem_practice_owner" ON poem_practice_records
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
