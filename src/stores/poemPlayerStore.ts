/**
 * 诗词朗读播放器：语音引擎 + 播放状态。
 *
 * 架构：
 *  - 状态放 zustand（不持久化），保证跨路由/组件重挂（上一曲/下一曲会重挂详情组件）音频状态不丢。
 *  - 语音引擎封装在本模块内部，只依赖 Web Speech API（speechSynthesis）。
 *  - 若将来要换云 TTS：把 “speakUnit / pauseNative / resumeNative / cancelNative” 的实现替换成
 *    云端流式播放即可，store 的对外行为（status / active / 循环 / 语速）保持不变。
 *
 * 朗读规则：
 *  - 依次读：标题 → 作者（若有）→ 正文每一非空行；空行跳过。
 *  - 一次只朗读一个短 utterance（规避 Chrome 长文本截断问题），由 end 事件驱动播下一句，
 *    这正是“逐行朗读 + 高亮当前行”所需的粒度。
 *  - 暂停 = 原生 pause；恢复 = cancel 后重读当前句（规避多种浏览器 resume 失效/卡死问题，
 *    逐行粒度下“当前句从头重读”是可接受的）。
 *  - 单曲循环：整首读完自动从头开始（round 变化由 onrepeat 感知，可做视觉提示）。
 */

import { create } from 'zustand'
import type { Poem } from '@/types/poem'

/** 播放器支持状态（多设备降级用） */
export type PoemSpeechSupport = 'checking' | 'ok' | 'no-api' | 'no-voice'
export type PoemSpeechStatus = 'idle' | 'playing' | 'paused'
export type PoemReadingKind = 'title' | 'author' | 'line'

/** 允许的语速档位（倍速） */
export const POEM_RATE_STEPS = [0.8, 0.95, 1.1, 1.3] as const

interface PoemPlayerState {
  /** 语音能力：api 存在与否 + 是否找到可用的中文语音 */
  support: PoemSpeechSupport
  status: PoemSpeechStatus
  rate: number
  /** 单曲循环开关（默认开） */
  repeat: boolean
  playingProjectId: string | null
  playingPoemId: string | null
  /** 正在朗读的是哪一部分；正文行时为第几行（index 对应 poem.lines） */
  reading: { kind: PoemReadingKind; line: number | null } | null
  /** 整首读完自动重播计数（可用来刷新循环视觉提示） */
  round: number

  init: () => void
  refreshSupport: () => void
  /** 从第一句开始朗读整首（会停掉正在播的其它诗） */
  playPoem: (projectId: string, poem: Poem) => void
  pause: () => void
  resume: () => void
  stop: () => void
  setRate: (rate: number) => void
  setRepeat: (repeat: boolean) => void
}

export const usePoemPlayerStore = create<PoemPlayerState>((set) => ({
  support: 'checking',
  status: 'idle',
  rate: 1,
  repeat: true,
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
    playUnits(projectId, poem)
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
    stopAll()
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

  setRepeat: (repeat) => {
    set({ repeat })
    engineState.repeat = repeat
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

/** 只重读当前句（暂停恢复 / 播放中调速 / 单曲循环重播共用） */
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
      setIdle()
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
    setIdle()
    return
  }
  engineState.current += 1
  speakCurrentUnit()
}

function playUnits(projectId: string, poem: Poem) {
  const ss = getSpeechSynthesis()
  const emptyPoem = !poem.title && !poem.author && poem.lines.every((l) => l.trim() === '')
  if (!ss || emptyPoem) return
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
  engineState.repeat = usePoemPlayerStore.getState().repeat
  usePoemPlayerStore.setState({
    status: 'playing',
    playingProjectId: projectId,
    playingPoemId: poem.id,
    round: 0,
  })
  speakCurrentUnit()
}

function stopAll() {
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
    playingProjectId: null,
    playingPoemId: null,
    reading: null,
    round: 0,
  })
}

function setIdle() {
  usePoemPlayerStore.setState({
    status: 'idle',
    playingProjectId: null,
    playingPoemId: null,
    reading: null,
    round: 0,
  })
}
