import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * 背诵 / 默写进度记忆（本地持久化第一版）。
 *
 * 设计：
 *  - 以 “项目id::诗词id” 为 key 记录，与诗词内容解耦（内容用指纹快照校验）；
 *  - 所有读写都收敛为 store action —— 将来做“落库持久化”（Supabase 等）时，
 *    只替换 actions 的实现即可，组件侧订阅方式不变；
 *  - 现版本只存“有没有完整练过一轮 / 用到的最高提示档 / 默写错字集”，
 *    不涉及分数、激励等展示数据（后续需求再扩展）。
 */

export interface ReciteProgress {
  /** 是否完整背过一轮（manual 全部揭开或 audio 整首跟读一遍） */
  completedOnce: boolean
  /** 本轮用到的最高提示档下标（越大提示越少，可辅助日后调档推荐） */
  bestHintLevelIndex: number
  lastCompletedAt: number | null
}

export interface DictateProgress {
  /** 完整默写完一轮的次数 */
  completedCount: number
  /** 曾漏写 / 写错的标准字（去重） */
  missedChars: string[]
  /** 实际打错的字（去重，复习时可优先给这些字出题） */
  wrongTypedChars: string[]
  lastCompletedAt: number | null
}

export interface PoemPracticeRecord {
  recite?: ReciteProgress
  dictate?: DictateProgress
  /** 记录写入时诗词内容的指纹；正文被编辑后此记录视为过期 */
  fingerprint: string
  updatedAt: number
}

export interface RecordReciteInput {
  completedOnce: boolean
  bestHintLevelIndex: number
  fingerprint: string
}

export interface RecordDictateInput {
  missedChars: string[]
  wrongTypedChars: string[]
  fingerprint: string
}

interface PoemPracticeStoreState {
  records: Record<string, PoemPracticeRecord>
}

interface PoemPracticeStoreActions {
  keyFor: (projectId: string, poemId: string) => string
  getRecord: (projectId: string, poemId: string) => PoemPracticeRecord | undefined
  recordReciteResult: (
    projectId: string,
    poemId: string,
    input: RecordReciteInput,
  ) => void
  recordDictateResult: (
    projectId: string,
    poemId: string,
    input: RecordDictateInput,
  ) => void
}

export type PoemPracticeStore = PoemPracticeStoreState & PoemPracticeStoreActions

export const usePoemPracticeStore = create<PoemPracticeStore>()(
  persist(
    (set, get) => ({
      records: {},

      keyFor: (projectId, poemId) => `${projectId}::${poemId}`,

      getRecord: (projectId, poemId) => {
        const key = get().keyFor(projectId, poemId)
        return get().records[key]
      },

      recordReciteResult: (projectId, poemId, input) => {
        const key = get().keyFor(projectId, poemId)
        set((state) => {
          const prev = state.records[key]
          const reciting = prev?.recite
          const merged: PoemPracticeRecord = {
            fingerprint: input.fingerprint,
            updatedAt: Date.now(),
            ...prev,
            recite: {
              completedOnce:
                (reciting?.completedOnce ?? false) || input.completedOnce,
              bestHintLevelIndex: Math.max(
                reciting?.bestHintLevelIndex ?? 0,
                input.bestHintLevelIndex,
              ),
              lastCompletedAt: input.completedOnce
                ? Date.now()
                : reciting?.lastCompletedAt ?? null,
            },
          }
          return { records: { ...state.records, [key]: merged } }
        })
      },

      recordDictateResult: (projectId, poemId, input) => {
        const key = get().keyFor(projectId, poemId)
        set((state) => {
          const prev = state.records[key]
          const dict = prev?.dictate
          const union = (a: string[] = [], b: string[]) => [
            ...new Set([...a, ...b]),
          ]
          const merged: PoemPracticeRecord = {
            fingerprint: input.fingerprint,
            updatedAt: Date.now(),
            ...prev,
            dictate: {
              completedCount: (dict?.completedCount ?? 0) + 1,
              missedChars: union(dict?.missedChars, input.missedChars),
              wrongTypedChars: union(dict?.wrongTypedChars, input.wrongTypedChars),
              lastCompletedAt: Date.now(),
            },
          }
          return { records: { ...state.records, [key]: merged } }
        })
      },
    }),
    {
      name: 'vocabquest:poem-practice',
      version: 1,
    },
  ),
)
