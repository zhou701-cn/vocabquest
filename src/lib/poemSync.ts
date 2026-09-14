/**
 * 诗词数据的「登录水合」编排层。
 *
 * 单独成模块是为了避免循环依赖：
 *   store → poemDb（写库）        —— 单向
 *   poemSync → store + poemDb     —— 只在登录时做顶层编排
 *   poemDb 不 import 任何 store   —— 因此无环
 */

import { usePoemStore } from '@/stores/poemStore'
import { usePoemPracticeStore, type PoemPracticeRecord } from '@/stores/poemPracticeStore'
import type { PoemProject } from '@/types/poem'
import { dbFetchLibrary, dbFetchPractice, dbMigrateLocal, dbSyncProject } from './poemDb'

/** 本次页面会话内已为哪个用户水合过（避免 auth 状态反复触发导致的重复拉取） */
let hydratedForUserId: string | null = null

/**
 * 真实用户登录后调用：
 *  1) 先做"本地 → 库"的一次性迁移（老本地数据不丢）；
 *  2) 再从库拉取诗词库与练习进度，按 id/键 与本地合并（服务端有就同步，本地独有不丢）。
 * demo / 未登录时底层会自动 no-op。
 */
export async function hydratePoemStoresFromDb(userId: string): Promise<void> {
  if (!userId || hydratedForUserId === userId) return
  hydratedForUserId = userId

  await dbMigrateLocal()

  const [serverProjects, serverRecords] = await Promise.all([dbFetchLibrary(), dbFetchPractice()])

  if (serverProjects) {
    const localProjects = usePoemStore.getState().projects
    usePoemStore.setState({ projects: mergeProjects(localProjects, serverProjects) })
  }

  if (serverRecords) {
    const localRecords = usePoemPracticeStore.getState().records
    usePoemPracticeStore.setState({ records: mergeRecords(localRecords, serverRecords) })
  }
}

/**
 * 合并本地项目与服务端项目。
 *  - 服务端独有的项目 → 追加到本地（跨设备同步）。
 *  - 本地独有的项目 → 保留，并尝试补同步到服务端（防止"刷新后消失"）。
 *  - 两边都有的项目 → 按 updatedAt 取较新的；本地较新时补同步。
 */
function mergeProjects(local: PoemProject[], server: PoemProject[]): PoemProject[] {
  const serverById = new Map(server.map((p) => [p.id, p]))
  const merged: PoemProject[] = []

  for (const localP of local) {
    const serverP = serverById.get(localP.id)
    if (!serverP) {
      // 本地有、服务端没有：大概率是上次 PUT 失败/尚未完成，保留并补同步
      merged.push(localP)
      dbSyncProject(localP).catch(() => {})
      continue
    }

    // 两边都有：取 updatedAt 更新的为准
    if (localP.updatedAt > serverP.updatedAt) {
      merged.push(localP)
      dbSyncProject(localP).catch(() => {})
    } else {
      merged.push(serverP)
    }
    serverById.delete(localP.id)
  }

  // 追加服务端独有的项目
  for (const serverP of serverById.values()) {
    merged.push(serverP)
  }

  return merged
}

/**
 * 合并本地练习进度与服务端练习进度。
 *  - 服务端独有的记录 → 追加。
 *  - 本地独有的记录 → 保留（避免未同步进度被刷掉）。
 *  - 两边都有的记录 → 按 updatedAt 取较新的。
 */
function mergeRecords(
  local: Record<string, PoemPracticeRecord>,
  server: Record<string, PoemPracticeRecord>,
): Record<string, PoemPracticeRecord> {
  const merged: Record<string, PoemPracticeRecord> = { ...local }

  for (const [key, serverRec] of Object.entries(server)) {
    const localRec = merged[key]
    if (!localRec || serverRec.updatedAt >= localRec.updatedAt) {
      merged[key] = serverRec
    }
  }

  return merged
}

/** 登出时调用：重置水合标记，下次登录重新拉取。 */
export function resetPoemHydration(): void {
  hydratedForUserId = null
}
