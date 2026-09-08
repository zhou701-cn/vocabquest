/**
 * 诗词朗读播放器：语音引擎 + 播放状态 + 整项目播放队列。
 *
 * 架构：
 *  - 状态放 zustand（不持久化），保证跨路由/组件重挂（上一曲/下一曲会重挂详情组件）音频状态不丢。
 *  - 语音引擎封装在本模块内部，只依赖 Web Speech API（speechSynthesis）。
 *  - 若将来要换云 TTS：把 “speakUnit / pauseNative / resumeNative / cancelNative” 的实现替换成
 *    云端流式播放即可，store 的对外行为（status / active / 模式 / 语速）保持不变。
 *
 * 朗读规则：
 *  - 依次读：标题 → 作者（若有）→ 正文每一非空行；空行跳过。
 *  - 一次只朗读一个短 utterance（规避 Chrome 长文本截断问题），由 end 事件驱动播下一句，
 *    这正是“逐行朗读 + 高亮当前行”所需的粒度。
 *  - 暂停 = 原生 pause；恢复 = cancel 后重读当前句（规避多种浏览器 resume 失效/卡死问题，
 *    逐行粒度下“当前句从头重读”是可接受的）。
 *
 * 队列 / 播放模式（用于“把整本项目的诗词连起来听”）：
 *  - mode = 'list'（列表播放）：当前首读完自动播下一首，播完最后一首后停止；
 *  - mode = 'shuffle'（随机播放）：当前首读完随机挑下一首；
 *  - mode = 'single'（单曲循环）：当前首读完整首自动从头再读（round 变化可做视觉提示）。
 *  - 队列数据在每次开始播放 / 切歌时从 poemStore 刷新，内容编辑后重播也拿得到最新文本。
 *  - 兼容旧入口 playPoem：播放一首诗时会自动把其所在项目登记为队列当前项。
 */

import { create } from 'zustand'
import type { Poem } from '@/types/poem'
import { usePoemStore } from '@/stores/poemStore'

/** 播放器支持状态（多设备降级用） */
export type PoemSpeechSupport = 'checking' | 'ok' | 'no-api' | 'no-voice'
export type PoemSpeechStatus = 'idle' | 'playing' | 'paused'
export type PoemReadingKind = 'title' | 'author' | 'line'

/** 播放模式 */
export type PoemPlayMode = 'list' | 'single' | 'shuffle'

/** 允许的语速档位（倍速） */
export const POEM_RATE_STEPS = [0.8, 0.95, 1.1, 1.3] as const

/** 模式切换的循环顺序（UI 上点击一次走一步） */
export const POEM_MODE_CYCLE: PoemPlayMode[] = ['list', 'shuffle', 'single']

/** 模式展示名 */
export const POEM_MODE_LABEL: Record<PoemPlayMode, string> = {
  list: '列表播放',
  shuffle: '随机播放',
  single: '单曲循环',
}

interface PoemPlayerState {
  /** 语音能力：api 存在与否 + 是否找到可用的中文语音 */
  support: PoemSpeechSupport
  status: PoemSpeechStatus
  rate: number
  /** 当前播放模式 */
  mode: PoemPlayMode
  /** 队列所属项目 id（null = 无队列会话） */
  queueProjectId: string | null
  /** 播放队列（项目内全部诗词快照，切歌时会按 poemStore 刷新） */
  queue: Poem[]
  /** 队列中当前诗词的下标（-1 = 无） */
  queueIndex: number
  playingProjectId: string | null
  playingPoemId: string | null
  /** 正在朗读的是哪一部分；正文行时为第几行（index 对应 poem.lines） */
  reading: { kind: PoemReadingKind; line: number | null } | null
  /** 单曲循环时整首重播计数（可用来刷新循环视觉提示） */
  round: number

  init: () => void
  refreshSupport: () => void
  /**
   * 播放一首诗（兼容旧入口）。会把所在项目的全部诗词登记为队列，
   * 并将该诗设为队列当前项（下一首/上一首即围绕整项目切换）。
   */
  playPoem: (projectId: string, poem: Poem) => void
  /**
   * 从某项目某下标开始建立队列并播放。
   * @param startIndex 0 起；传 -1 表示随机起点（配合 shuffle 用）
   * @param mode 显式设置播放模式（顺序 / 随机 / 单曲）
   */
  playProject: (projectId: string, startIndex: number, mode: PoemPlayMode) => void
  /** 队列上一首（自动按当前模式切：随机模式下为随机上一首） */
  playPrev: () => void
  /** 队列下一首 */
  playNext: () => void
  pause: () => void
  resume: () => void
  /** 完全停止并清空队列 */
  stop: () => void
  setRate: (rate: number) => void
  setMode: (mode: PoemPlayMode) => void
  cycleMode: () => void
}

export const usePoemPlayerStore = create<PoemPlayerState>((set) => ({
  support: 'checking',
  status: 'idle',
  rate: 1,
  mode: 'single',
  queueProjectId: null,
  queue: [],
  queueIndex: -1,
  playingProjectId: null,
  playingPoemId: null,
  reading: null,
  round: 0,

  init: () => {
    if (typeof window === 'undefined') return
    refreshVoiceList()
    if (!('speechSynthesis' in window)) {
      set({ support: 'no-api' })
      return
    }
    // 语音列表可能异步加载（尤其是首次访问），就绪后重新判定
    window.speechSynthesis.onvoiceschanged = () => refreshSupportState()
    refreshSupportState()
  },
  refreshSupport: () => {
    refreshVoiceList()
    refreshSupportState()
  },

  playPoem: (projectId, poem) => {
    const poems = fetchProjectPoems(projectId)
    if (poems.length === 0) {
      // 项目已不存在：以单首兜底登记为队列
      if (getSpeechSynthesis() && hasSpeakableText(poem)) {
        startPoemInternal(projectId, [poem], 0)
      }
      return
    }
    const idx = poems.findIndex((p) => p.id === poem.id)
    startPoemInternal(projectId, poems, idx >= 0 ? idx : 0)
  },

  playProject: (projectId, startIndex, mode) => {
    const poems = fetchProjectPoems(projectId)
    if (poems.length === 0) return
    applyMode(mode)
    let index = startIndex
    if (index < 0 || index >= poems.length) index = randomInt(poems.length)
    startPoemInternal(projectId, poems, index)
  },

  playPrev: () => {
    switchPoem(-1)
  },
  playNext: () => {
    switchPoem(1)
  },

  pause: () => {
    if (usePoemPlayerStore.getState().status !== 'playing') return
    const ss = getSpeechSynthesis()
    if (ss) ss.pause()
    set({ status: 'paused' })
  },

  resume: () => {
    if (usePoemPlayerStore.getState().status !== 'paused') return
    // 恢复 = 重读当前句，规避原生 resume() 的跨浏览器坑
    engineState.token += 1
    const ss = getSpeechSynthesis()
    if (ss) {
      try {
        ss.cancel()
      } catch {
        /* ignore */
      }
      try {
        ss.resume()
      } catch {
        /* ignore */
      }
    }
    set({ status: 'playing' })
    speakCurrentUnit()
  },

  stop: () => {
    stopAndClearQueue()
  },

  setRate: (rate) => {
    set({ rate })
    engineState.rate = rate
    // 播放中调速：重读当前句让新语速立刻生效（暂停时只存档，恢复后生效）
    const st = usePoemPlayerStore.getState()
    if (st.status === 'playing' && engineState.units.length > 0) {
      const ss = getSpeechSynthesis()
      engineState.token += 1
      if (ss) ss.cancel()
      speakCurrentUnit()
    }
  },

  setMode: (mode) => {
    applyMode(mode)
  },
  cycleMode: () => {
    const cur = usePoemPlayerStore.getState().mode
    const idx = POEM_MODE_CYCLE.indexOf(cur)
    applyMode(POEM_MODE_CYCLE[(idx + 1) % POEM_MODE_CYCLE.length])
  },
}))

/* ============================== 语音引擎内部 ============================== */

interface ReadingUnit {
  kind: PoemReadingKind
  /** 正文行号（kind === 'line' 时） */
  line: number | null
  text: string
}

interface EngineState {
  units: ReadingUnit[]
  current: number
  /** 每次取消/停止都会自增，用于丢弃迟到的浏览器回调 */
  token: number
  rate: number
  /** 单曲循环：整首读完自动从头再读 */
  repeat: boolean
}

const engineState: EngineState = {
  units: [],
  current: -1,
  token: 0,
  rate: 1,
  repeat: true,
}

let voiceCache: SpeechSynthesisVoice | null = null

function getSpeechSynthesis(): SpeechSynthesis | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null
  return window.speechSynthesis
}

function refreshVoiceList() {
  const ss = getSpeechSynthesis()
  if (!ss) return
  const voices = ss.getVoices()
  // 优先 zh-CN，其次任意 zh（含 zh-TW 等），保证多语言环境能读中文
  voiceCache =
    voices.find((v) => v.lang.replace(/_/g, '-').toLowerCase() === 'zh-cn') ??
    voices.find((v) => v.lang.replace(/_/g, '-').toLowerCase().startsWith('zh')) ??
    null
}

function refreshSupportState() {
  const ss = getSpeechSynthesis()
  if (!ss) {
    usePoemPlayerStore.setState({ support: 'no-api' })
    return
  }
  refreshVoiceList()
  usePoemPlayerStore.setState({ support: voiceCache ? 'ok' : 'no-voice' })
}

/** 从 poemStore 拉取某项目当前的诗词（每次切歌都取最新，保证内容编辑后生效） */
function fetchProjectPoems(projectId: string): Poem[] {
  const project = usePoemStore.getState().projects.find((p) => p.id === projectId)
  return project?.poems ?? []
}

function buildUnits(poem: Poem): ReadingUnit[] {
  const units: ReadingUnit[] = []
  const pushText = (kind: PoemReadingKind, line: number | null, text: string) => {
    const t = text.trim().replace(/\s+/g, ' ')
    if (t) units.push({ kind, line, text: t })
  }
  if (poem.title) pushText('title', null, poem.title)
  if (poem.author) pushText('author', null, poem.author)
  poem.lines.forEach((l, i) => {
    if (l.trim() !== '') pushText('line', i, l)
  })
  return units
}

function hasSpeakableText(poem: Poem): boolean {
  return buildUnits(poem).length > 0
}

function clampIndex(index: number, length: number): number {
  if (length <= 0) return -1
  return Math.max(0, Math.min(index, length - 1))
}

function randomInt(length: number): number {
  return Math.floor(Math.random() * length)
}

/** 应用播放模式：同步 store 字段与引擎的单曲循环开关 */
function applyMode(mode: PoemPlayMode) {
  engineState.repeat = mode === 'single'
  usePoemPlayerStore.setState({ mode })
}

/**
 * 播放队列中的某一首（内部统一入口）：
 * 真正开口前先把队列 / 当前项 / 播放状态落库，让 UI 立刻反映。
 */
function startPoemInternal(projectId: string, poems: Poem[], index: number) {
  if (poems.length === 0) return
  const idx = clampIndex(index, poems.length)
  const poem = poems[idx]
  const ss = getSpeechSynthesis()
  if (!ss || !hasSpeakableText(poem)) return

  usePoemPlayerStore.setState({
    queueProjectId: projectId,
    queue: poems,
    queueIndex: idx,
    playingProjectId: projectId,
    playingPoemId: poem.id,
    status: 'playing',
    reading: null,
    round: 0,
  })

  engineState.token += 1
  if (ss) {
    try {
      ss.cancel()
      // 若上一首处于“原生暂停”状态，cancel 后仍需 resume 解除引擎暂停锁
      ss.resume()
    } catch {
      /* ignore */
    }
  }
  engineState.units = buildUnits(poem)
  engineState.current = 0
  engineState.repeat = usePoemPlayerStore.getState().mode === 'single'
  speakCurrentUnit()
}

/** 手动切歌：单曲/列表模式按列表顺序（可回绕），随机模式随机挑一首 */
function switchPoem(dir: -1 | 1) {
  const st = usePoemPlayerStore.getState()
  if (!st.queueProjectId) return
  const poems = fetchProjectPoems(st.queueProjectId)
  if (poems.length === 0) return

  let cur = poems.findIndex((p) => p.id === st.playingPoemId)
  if (cur < 0) cur = clampIndex(st.queueIndex, poems.length)
  if (cur < 0) cur = 0

  let target = -1
  if (st.mode === 'shuffle' && poems.length > 1) {
    // 随机挑一个与当前不同的目标（最多尝试若干次兜底）
    for (let i = 0; i < 12; i++) {
      const t = randomInt(poems.length)
      if (t !== cur) {
        target = t
        break
      }
    }
    if (target < 0) target = cur
  } else {
    target = pickListTarget(poems, cur, dir)
  }
  if (target < 0) return
  startPoemInternal(st.queueProjectId, poems, target)
}

/** 按顺序（含回绕）挑下一个可朗读的下标；找不到返回 -1 */
function pickListTarget(poems: Poem[], cur: number, dir: -1 | 1): number {
  const len = poems.length
  for (let step = 1; step <= len; step++) {
    const t = (cur + dir * step + len) % len
    if (hasSpeakableText(poems[t])) return t
  }
  return -1
}

/** 挑一个与当前不同的随机可朗读下标 */
function pickRandomTarget(poems: Poem[], cur: number): number {
  const speakable = poems
    .map((p, i) => (hasSpeakableText(p) ? i : -1))
    .filter((i) => i >= 0)
  if (speakable.length === 0) return -1
  if (speakable.length === 1) return speakable[0] === cur ? -1 : speakable[0]
  let t = speakable[randomInt(speakable.length)]
  let guard = 0
  while (t === cur && guard++ < 12) t = speakable[randomInt(speakable.length)]
  return t === cur ? -1 : t
}

/** 只重读当前句（暂停恢复 / 播放中调速共用） */
function speakCurrentUnit() {
  const myToken = engineState.token
  const units = engineState.units
  const current = engineState.current
  if (myToken !== engineState.token || units.length === 0 || current < 0 || current >= units.length) {
    return
  }
  const unit = units[current]
  const ss = getSpeechSynthesis()
  if (!ss || !unit.text) return

  // 每次朗读前刷新语音列表：iOS 等首次可能异步返回空列表，避免一直错过中文语音
  refreshVoiceList()

  usePoemPlayerStore.setState({ reading: { kind: unit.kind, line: unit.line } })

  const utter = new SpeechSynthesisUtterance(unit.text)
  utter.lang = 'zh-CN'
  if (voiceCache) utter.voice = voiceCache
  utter.rate = engineState.rate
  utter.pitch = 1
  utter.volume = 1

  utter.onend = () => {
    if (myToken !== engineState.token) return
    advanceToNext()
  }
  utter.onerror = (e) => {
    if (myToken !== engineState.token) return
    const err = (e as SpeechSynthesisErrorEvent).error
    // 自己 cancel 触发的错误直接忽略（token 已变）
    if (err === 'canceled' || err === 'interrupted') return
    if (err === 'not-allowed' || err === 'synthesis-unavailable') {
      setQueueIdle(false)
      return
    }
    // 其它错误：跳过本句继续，避免卡死
    advanceToNext()
  }
  ss.speak(utter)
}

function advanceToNext() {
  if (engineState.current + 1 >= engineState.units.length) {
    if (engineState.repeat) {
      const nextRound = usePoemPlayerStore.getState().round + 1
      engineState.current = -1
      usePoemPlayerStore.setState({ round: nextRound })
      // 下一句的 onstart 会再更新 reading
      advanceToNext()
      return
    }
    handlePoemFinished()
    return
  }
  engineState.current += 1
  speakCurrentUnit()
}

/** 一首诗自然读完：按模式决定续播 / 停止 */
function handlePoemFinished() {
  const st = usePoemPlayerStore.getState()
  // 无队列的旧场景：读完即停止
  if (!st.queueProjectId) {
    setQueueIdle(false)
    return
  }
  const poems = fetchProjectPoems(st.queueProjectId)
  if (poems.length === 0) {
    stopAndClearQueue()
    return
  }
  let cur = poems.findIndex((p) => p.id === st.playingPoemId)
  if (cur < 0) cur = clampIndex(st.queueIndex, poems.length)

  if (st.mode === 'shuffle') {
    const target = pickRandomTarget(poems, cur)
    if (target >= 0) {
      startPoemInternal(st.queueProjectId, poems, target)
    } else {
      setQueueIdle(true)
    }
    return
  }

  // 列表播放：播下一首，播完最后一首后停住（队列保留，可手动重播/切歌）
  const next = pickListTarget(poems, cur, 1)
  if (next >= 0) {
    startPoemInternal(st.queueProjectId, poems, next)
    return
  }
  // 到末尾：停留在当前首，转为 idle
  usePoemPlayerStore.setState({
    queue: poems,
    queueIndex: cur >= 0 ? cur : st.queueIndex,
    status: 'idle',
    playingProjectId: null,
    playingPoemId: null,
    reading: null,
    round: 0,
  })
}

/** 保持队列但停止发声（列表自然播完 / 无声源错误时） */
function setQueueIdle(keepQueue: boolean) {
  const patch: Partial<PoemPlayerState> = {
    status: 'idle',
    playingProjectId: null,
    playingPoemId: null,
    reading: null,
    round: 0,
  }
  if (!keepQueue) {
    patch.queueProjectId = null
    patch.queue = []
    patch.queueIndex = -1
  }
  usePoemPlayerStore.setState(patch as PoemPlayerState)
}

function stopAndClearQueue() {
  const ss = getSpeechSynthesis()
  engineState.token += 1
  engineState.units = []
  engineState.current = -1
  if (ss) {
    try {
      ss.cancel()
    } catch {
      /* ignore */
    }
  }
  usePoemPlayerStore.setState({
    status: 'idle',
    queueProjectId: null,
    queue: [],
    queueIndex: -1,
    playingProjectId: null,
    playingPoemId: null,
    reading: null,
    round: 0,
  })
}

/* ============================ 独立单句朗读（背诵/跟读用） ============================ */

export interface PoemSpeakOptions {
  rate?: number
  onStart?: () => void
  onEnd?: () => void
  /** 不可恢复的错误（如权限/合成不可用）；canceled/interrupted 不触发 */
  onError?: (err: string) => void
}

export interface PoemSpeakControl {
  /** 立即取消本次朗读（迟到回调一并丢弃） */
  cancel: () => void
}

let speakSeq = 0

/**
 * 朗读一段独立文本（背诵“跟读遮罩 / 偷听一句”使用）。
 * - 会先 cancel 当前一切发声（含列表播放引擎），因此仅应在“练习独占”语境下调用，
 *   调用方进入练习时需先停掉正常播放器；
 * - 复用与列表播放一致的中文语音选择与语速语义；
 * - 将来换云端 TTS，替换此函数即可，两个练习面板无需改动。
 * 返回 null 表示环境不支持或无可用中文语音。
 */
export function speakPoemText(text: string, opts: PoemSpeakOptions = {}): PoemSpeakControl | null {
  const ss = getSpeechSynthesis()
  if (!ss || !text.trim()) return null
  refreshVoiceList()
  if (!voiceCache) return null

  const seq = ++speakSeq
  const utter = new SpeechSynthesisUtterance(text)
  utter.lang = 'zh-CN'
  utter.voice = voiceCache
  utter.rate = opts.rate ?? usePoemPlayerStore.getState().rate
  utter.pitch = 1
  utter.volume = 1

  // 练习场景独占发声：先清掉正在播的一切（含引擎队列）
  try {
    ss.cancel()
  } catch {
    /* ignore */
  }

  utter.onstart = () => {
    if (speakSeq === seq) opts.onStart?.()
  }
  utter.onend = () => {
    if (speakSeq !== seq) return
    opts.onEnd?.()
  }
  utter.onerror = (ev) => {
    if (speakSeq !== seq) return
    const err = (ev as SpeechSynthesisErrorEvent).error
    if (err === 'canceled' || err === 'interrupted') return
    opts.onError?.(err)
  }

  ss.speak(utter)
  return {
    cancel: () => {
      if (speakSeq === seq) {
        speakSeq += 1
        try {
          ss.cancel()
        } catch {
          /* ignore */
        }
      }
    },
  }
}
