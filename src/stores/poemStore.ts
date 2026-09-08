import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Poem, PoemDraft, PoemImportMode, PoemProject } from '@/types/poem'
import { autoSplitPoemCards, cleanPoemLines } from '@/lib/poemSplit'

/** 生成唯一 id（优先原生 randomUUID） */
function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `poem-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

/** 把导入草稿转成入库诗词（分配 id、兜底标题、清理正文） */
function draftToPoem(draft: PoemDraft, order: number): Poem {
  return {
    id: makeId(),
    title: draft.title.trim() || `诗${order}`,
    author: draft.author?.trim() || undefined,
    lines: cleanPoemLines(draft.lines),
  }
}

export interface CreateProjectInput {
  name: string
  fileName: string
  format: PoemProject['format']
  poems: PoemDraft[]
}

interface PoemStoreState {
  projects: PoemProject[]
}

interface PoemStoreActions {
  /** 新建项目（导入新文件） */
  createProject: (input: CreateProjectInput) => PoemProject
  /** 重命名项目 */
  renameProject: (id: string, name: string) => void
  /** 删除项目 */
  deleteProject: (id: string) => void
  /** 再次导入：追加或覆盖一组诗词 */
  importPoems: (id: string, drafts: PoemDraft[], mode: PoemImportMode) => void
  /** 手动新增一首诗词，返回其 id */
  addPoem: (id: string, draft: PoemDraft) => string | undefined
  /** 修改诗词的题目 / 作者 */
  updatePoemMeta: (id: string, poemId: string, meta: { title?: string; author?: string }) => void
  /** 删除一首诗词 */
  deletePoem: (id: string, poemId: string) => void
  /** 上移 / 下移一首诗词（dir: -1 上移，1 下移） */
  movePoem: (id: string, poemId: string, dir: -1 | 1) => void
  /** 整组替换某首诗词的正文行 */
  setPoemLines: (id: string, poemId: string, lines: string[]) => void
  /** 修改某首诗词的某一行 */
  updatePoemLine: (id: string, poemId: string, lineIndex: number, text: string) => void
  /** 在某首诗词的第 lineIndex 行之后插入一行（传 -1 表示在开头插入） */
  insertPoemLine: (id: string, poemId: string, afterIndex: number, text: string) => void
  /** 删除某首诗词的某一行 */
  deletePoemLine: (id: string, poemId: string, lineIndex: number) => void
}

export type PoemStore = PoemStoreState & PoemStoreActions

export const usePoemStore = create<PoemStore>()(
  persist(
    (set) => ({
      projects: [],

      createProject: (input) => {
        const now = Date.now()
        const poems: Poem[] = input.poems.map((d, idx) => draftToPoem(d, idx + 1))
        const project: PoemProject = {
          id: makeId(),
          name: input.name.trim() || input.fileName.replace(/\.[^.]+$/, '') || 'Untitled Poem',
          fileName: input.fileName,
          format: input.format,
          poems,
          createdAt: now,
          updatedAt: now,
        }
        set((state) => ({ projects: [project, ...state.projects] }))
        return project
      },

      renameProject: (id, name) => {
        const trimmed = name.trim()
        if (!trimmed) return
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id ? { ...p, name: trimmed, updatedAt: Date.now() } : p,
          ),
        }))
      },

      deleteProject: (id) => {
        set((state) => ({ projects: state.projects.filter((p) => p.id !== id) }))
      },

      importPoems: (id, drafts, mode) => {
        set((state) => ({
          projects: state.projects.map((p) => {
            if (p.id !== id) return p
            const incoming = drafts.map((d, idx) => draftToPoem(d, idx + 1))
            const poems =
              mode === 'append'
                ? [...p.poems, ...incoming]
                : incoming
            return { ...p, poems, updatedAt: Date.now() }
          }),
        }))
      },

      addPoem: (id, draft) => {
        let createdId: string | undefined
        set((state) => ({
          projects: state.projects.map((p) => {
            if (p.id !== id) return p
            const poem = draftToPoem(draft, p.poems.length + 1)
            createdId = poem.id
            return { ...p, poems: [...p.poems, poem], updatedAt: Date.now() }
          }),
        }))
        return createdId
      },

      updatePoemMeta: (id, poemId, meta) => {
        set((state) => ({
          projects: state.projects.map((p) => {
            if (p.id !== id) return p
            const poems = p.poems.map((poem) => {
              if (poem.id !== poemId) return poem
              const next: Poem = { ...poem }
              if (meta.title !== undefined) next.title = meta.title.trim()
              if (meta.author !== undefined) next.author = meta.author.trim() || undefined
              return next
            })
            return { ...p, poems, updatedAt: Date.now() }
          }),
        }))
      },

      deletePoem: (id, poemId) => {
        set((state) => ({
          projects: state.projects.map((p) => {
            if (p.id !== id) return p
            return {
              ...p,
              poems: p.poems.filter((poem) => poem.id !== poemId),
              updatedAt: Date.now(),
            }
          }),
        }))
      },

      movePoem: (id, poemId, dir) => {
        set((state) => ({
          projects: state.projects.map((p) => {
            if (p.id !== id) return p
            const from = p.poems.findIndex((poem) => poem.id === poemId)
            const to = from + dir
            if (from < 0 || to < 0 || to >= p.poems.length) return p
            const poems = [...p.poems]
            const [item] = poems.splice(from, 1)
            poems.splice(to, 0, item)
            return { ...p, poems, updatedAt: Date.now() }
          }),
        }))
      },

      setPoemLines: (id, poemId, lines) => {
        set((state) => ({
          projects: state.projects.map((p) => {
            if (p.id !== id) return p
            return {
              ...p,
              poems: p.poems.map((poem) =>
                poem.id === poemId
                  ? { ...poem, lines: cleanPoemLines(lines) }
                  : poem,
              ),
              updatedAt: Date.now(),
            }
          }),
        }))
      },

      updatePoemLine: (id, poemId, lineIndex, text) => {
        set((state) => ({
          projects: state.projects.map((p) => {
            if (p.id !== id) return p
            const poems = p.poems.map((poem) => {
              if (poem.id !== poemId || lineIndex < 0 || lineIndex >= poem.lines.length) {
                return poem
              }
              const lines = [...poem.lines]
              lines[lineIndex] = text
              return { ...poem, lines }
            })
            return { ...p, poems, updatedAt: Date.now() }
          }),
        }))
      },

      insertPoemLine: (id, poemId, afterIndex, text) => {
        set((state) => ({
          projects: state.projects.map((p) => {
            if (p.id !== id) return p
            const poems = p.poems.map((poem) => {
              if (poem.id !== poemId) return poem
              const lines = [...poem.lines]
              const at = Math.max(0, Math.min(afterIndex + 1, lines.length))
              lines.splice(at, 0, text)
              return { ...poem, lines }
            })
            return { ...p, poems, updatedAt: Date.now() }
          }),
        }))
      },

      deletePoemLine: (id, poemId, lineIndex) => {
        set((state) => ({
          projects: state.projects.map((p) => {
            if (p.id !== id) return p
            const poems = p.poems.map((poem) => {
              if (poem.id !== poemId || lineIndex < 0 || lineIndex >= poem.lines.length) {
                return poem
              }
              const lines = [...poem.lines]
              lines.splice(lineIndex, 1)
              return { ...poem, lines }
            })
            return { ...p, poems, updatedAt: Date.now() }
          }),
        }))
      },
    }),
    {
      name: 'vocabquest:poem-projects',
      version: 3,
      // 旧版本迁移：
      //  v3 → 每首诗词 { title/author/lines }
      //  v2 及以下 → 项目里是扁平 lines，需按首拆分（同一 key 曾以 version 2 存过旧结构）
      migrate: (persistedState, version) => {
        if (version >= 3) return persistedState as PoemStore
        const legacy = persistedState as {
          state?: {
            projects?: Array<{ lines?: string[]; poems?: Poem[]; name?: unknown } & object>
          }
        }
        const oldProjects = legacy?.state?.projects ?? []
        const projects = oldProjects.map((p) => {
          if (Array.isArray(p.poems)) return p as PoemProject
          const rawLines = Array.isArray(p.lines) ? p.lines : []
          const fallback = typeof p.name === 'string' ? p.name : undefined
          const drafts = autoSplitPoemCards(rawLines, fallback)
          const poems = drafts.map((d, idx) => draftToPoem(d, idx + 1))
          const rest: Record<string, unknown> = { ...p }
          delete rest.lines
          return { ...rest, poems } as PoemProject
        })
        if (legacy?.state) legacy.state.projects = projects
        return persistedState as PoemStore
      },
    },
  ),
)
