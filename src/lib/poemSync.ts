/**
 * 诗词数据的「登录水合」编排层。
 *
 * 单独成模块是为了避免循环依赖：
 *   store → poemDb（写库）        —— 单向
 *   poemSync → store + poemDb     —— 只在登录时做顶层编排
 *   poemDb 不 import 任何 store   —— 因此无环
 */

import { usePoemStore } from '@/stores/poemStore'
import { usePoemPracticeStore } from '@/stores/poemPracticeStore'
import { dbFetchLibrary, dbFetchPractice, dbMigrateLocal } from './poemDb'

/** 本次页面会话内已为哪个用户水合过（避免 auth 状态反复触发导致的重复拉取） */
let hydratedForUserId: string | null = null

/**
 * 真实用户登录后调用：
 *  1) 先做"本地 → 库"的一次性迁移（老本地数据不丢）；
 *  2) 再从库拉取诗词库与练习进度，覆盖本地（以库为准，实现跨设备同步）。
 * demo / 未登录时底层会自动 no-op。
 */
export async function hydratePoemStoresFromDb(userId: string): Promise<void> {
  if (!userId || hydratedForUserId === userId) return
  hydratedForUserId = userId

  await dbMigrateLocal()

  const [projects, records] = await Promise.all([dbFetchLibrary(), dbFetchPractice()])
  if (projects) {
    usePoemStore.setState({ projects })
  }
  if (records) {
    usePoemPracticeStore.setState({ records })
  }
}

/** 登出时调用：重置水合标记，下次登录重新拉取。 */
export function resetPoemHydration(): void {
  hydratedForUserId = null
}
