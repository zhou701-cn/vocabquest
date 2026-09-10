/**
 * 诗词数据 → 自建后端 API 的数据访问层（纯函数，不依赖任何 store，避免循环依赖）。
 *
 * 规则：
 *  - 所有读写都先解析「真实登录用户 id」；本地 demo 账号 / 未登录时一律 no-op
 *    （返回 null 或直接返回），只有真实登录用户才落库；
 *  - 服务端通过 JWT 鉴权，用户只能读写自己的数据。
 */

import { apiFetch, readAuthSession } from '@/lib/api'
import type { Poem, PoemProject } from '@/types/poem'
import type { PoemPracticeRecord } from '@/stores/poemPracticeStore'

/** 与 AuthContext 中的本地一键登录会话 key 保持一致 */
const DEMO_SESSION_KEY = 'vocabquest:demo-session'
/** localStorage 中两个 zustand persist 的 key（与 store 定义一致） */
const PROJECTS_PERSIST_KEY = 'vocabquest:poem-projects'
const PRACTICE_PERSIST_KEY = 'vocabquest:poem-practice'
/** 记录某用户是否已做过"本地 → 库"的一次性迁移 */
const MIGRATED_KEY = 'vocabquest:poem-db-migrated'

function isDemoActive(): boolean {
  try {
    return !!localStorage.getItem(DEMO_SESSION_KEY)
  } catch {
    return false
  }
}

/** 真实登录用户 id；demo / 未登录返回 null */
export async function getRealUserId(): Promise<string | null> {
  if (isDemoActive()) return null
  return readAuthSession()?.user?.id ?? null
}

/* ------------------------------ 类型转换 ------------------------------ */

const toIso = (ms: number): string => new Date(ms).toISOString()
const toMs = (iso: string): number => new Date(iso).getTime()

/* ------------------------------ 项目 + 诗词 ------------------------------ */

/**
 * 上传整个项目：upsert 项目行 → 逐首 upsert（保留原 id）→ 删除本地已移除的诗词。
 * demo / 未登录时 no-op。
 */
export async function dbSyncProject(project: PoemProject): Promise<void> {
  const userId = await getRealUserId()
  if (!userId) return
  try {
    await apiFetch(`/poems/projects/${project.id}`, {
      method: 'PUT',
      body: {
        name: project.name,
        file_name: project.fileName,
        format: project.format,
        created_at: toIso(project.createdAt),
        updated_at: toIso(project.updatedAt),
        poems: project.poems.map((poem) => ({
          id: poem.id,
          title: poem.title,
          author: poem.author ?? null,
          lines: poem.lines,
        })),
      },
    })
  } catch (e) {
    console.warn('[poemDb] syncProject failed:', e)
  }
}

/** 删除项目（级联删除其诗词与练习进度）。demo / 未登录时 no-op。 */
export async function dbDeleteProject(projectId: string): Promise<void> {
  const userId = await getRealUserId()
  if (!userId) return
  try {
    await apiFetch(`/poems/projects/${projectId}`, { method: 'DELETE' })
  } catch (e) {
    console.warn('[poemDb] deleteProject failed:', e)
  }
}

/** 拉取该用户的诗词库（按创建时间倒序，项目内诗词按 sort_order 升序）。demo 返回 null。 */
export async function dbFetchLibrary(): Promise<PoemProject[] | null> {
  const userId = await getRealUserId()
  if (!userId) return null
  try {
    const { projects, poems } = await apiFetch<{ projects: any[]; poems: any[] }>(
      '/poems/library',
    )

    const byProject = new Map<string, Poem[]>()
    for (const row of poems ?? []) {
      const poem: Poem = {
        id: row.id,
        title: row.title,
        author: row.author ?? undefined,
        lines: row.lines ?? [],
      }
      const arr = byProject.get(row.project_id) ?? []
      arr.push(poem)
      byProject.set(row.project_id, arr)
    }

    return (projects ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      fileName: row.file_name ?? '',
      format: (row.format ?? 'other') as PoemProject['format'],
      poems: byProject.get(row.id) ?? [],
      createdAt: toMs(row.created_at),
      updatedAt: toMs(row.updated_at),
    }))
  } catch (e) {
    console.warn('[poemDb] fetchLibrary failed:', e)
    return null
  }
}

/* ------------------------------ 练习进度 ------------------------------ */

/** 上传单条练习进度（一诗一条，按 (user_id, poem_id) upsert）。demo / 未登录时 no-op。 */
export async function dbSyncPracticeRecord(
  projectId: string,
  poemId: string,
  record: PoemPracticeRecord,
): Promise<void> {
  const userId = await getRealUserId()
  if (!userId) return
  try {
    await apiFetch(`/poems/practice/${poemId}`, {
      method: 'PUT',
      body: {
        project_id: projectId,
        fingerprint: record.fingerprint,
        recite: record.recite ?? null,
        dictate: record.dictate ?? null,
        updated_at: toIso(record.updatedAt),
      },
    })
  } catch (e) {
    console.warn('[poemDb] syncPracticeRecord failed:', e)
  }
}

/** 拉取该用户的全部练习进度，重建 projectId::poemId → record 的映射。demo 返回 null。 */
export async function dbFetchPractice(): Promise<Record<string, PoemPracticeRecord> | null> {
  const userId = await getRealUserId()
  if (!userId) return null
  try {
    const data = await apiFetch<any[]>('/poems/practice')

    const map: Record<string, PoemPracticeRecord> = {}
    for (const row of data ?? []) {
      map[`${row.project_id}::${row.poem_id}`] = {
        fingerprint: row.fingerprint ?? '',
        updatedAt: toMs(row.updated_at),
        recite: (row.recite ?? undefined) as PoemPracticeRecord['recite'],
        dictate: (row.dictate ?? undefined) as PoemPracticeRecord['dictate'],
      }
    }
    return map
  } catch (e) {
    console.warn('[poemDb] fetchPractice failed:', e)
    return null
  }
}

/* ------------------------------ 一次性迁移 ------------------------------ */

/**
 * 把 localStorage 里的诗词库与练习进度一次性迁移到服务端。
 * 按用户标记，避免重复导入；单条失败不中断整体。demo / 未登录时 no-op。
 */
export async function dbMigrateLocal(): Promise<void> {
  const userId = await getRealUserId()
  if (!userId) return
  try {
    if (localStorage.getItem(MIGRATED_KEY) === userId) return

    const rawProjects = localStorage.getItem(PROJECTS_PERSIST_KEY)
    if (rawProjects) {
      const projects = (JSON.parse(rawProjects)?.state?.projects ?? []) as PoemProject[]
      for (const p of projects) {
        await dbSyncProject(p)
      }
    }

    const rawPractice = localStorage.getItem(PRACTICE_PERSIST_KEY)
    if (rawPractice) {
      const records = (JSON.parse(rawPractice)?.state?.records ?? {}) as Record<
        string,
        PoemPracticeRecord
      >
      for (const [key, rec] of Object.entries(records)) {
        const sep = key.indexOf('::')
        if (sep < 0) continue
        await dbSyncPracticeRecord(key.slice(0, sep), key.slice(sep + 2), rec)
      }
    }

    localStorage.setItem(MIGRATED_KEY, userId)
  } catch (e) {
    console.warn('[poemDb] migrateLocal failed:', e)
  }
}
