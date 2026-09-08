import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  Check,
  ChevronRight,
  Eye,
  EyeOff,
  Play,
  Pause,
  RotateCcw,
  Square,
  Volume2,
} from 'lucide-react'
import type { Poem } from '@/types/poem'
import { usePoemPlayerStore, speakPoemText, type PoemSpeakControl, POEM_RATE_STEPS } from '@/stores/poemPlayerStore'
import { usePoemPracticeStore } from '@/stores/poemPracticeStore'
import {
  buildPracticeUnits,
  countRevealableTokens,
  poemPracticeFingerprint,
  PRACTICE_HINT_LABEL,
  PRACTICE_HINT_LEVELS,
  splitDisplayTokens,
  visibleTokenCount,
  type PracticeHintLevel,
  type PracticeUnit,
} from '@/lib/poemPractice'
import { MaskedLine, Segmented } from './PoemPracticeUI'

type ReciteDriver = 'manual' | 'audio'

interface PoemRecitePanelProps {
  projectId: string
  poem: Poem
}

const TOGGLE_BTN =
  'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors'
const TOGGLE_ON = 'bg-violet-50 border-violet-200 text-violet-700'
const TOGGLE_OFF = 'border-gray-200 text-gray-400 hover:text-gray-600'

export function PoemRecitePanel({ projectId, poem }: PoemRecitePanelProps) {
  const support = usePoemPlayerStore((s) => s.support)
  const rate = usePoemPlayerStore((s) => s.rate)
  const setRate = usePoemPlayerStore((s) => s.setRate)
  const recordReciteResult = usePoemPracticeStore((s) => s.recordReciteResult)

  // ---------- 练习单元 ----------
  const unitsAll = useMemo(() => buildPracticeUnits(poem), [poem])
  const lineByRow = useMemo(() => {
    const m = new Map<number, PracticeUnit>()
    unitsAll.forEach((u) => {
      if (u.kind === 'line' && u.lineIndex !== null) m.set(u.lineIndex, u)
    })
    return m
  }, [unitsAll])

  // ---------- 外观设置 ----------
  const [driver, setDriver] = useState<ReciteDriver>('manual')
  const [hintLevel, setHintLevel] = useState<PracticeHintLevel>('none')
  const [showTitle, setShowTitle] = useState(false)
  const [showAuthor, setShowAuthor] = useState(false)

  // ---------- 状态 ----------
  const [revealed, setRevealed] = useState<ReadonlySet<string>>(() => new Set())
  const [audioDone, setAudioDone] = useState<ReadonlySet<string>>(() => new Set())
  /** 逐字/档位点亮的进度：key → 当前应露出的非空白 token 个数（0=全盖，total=全开） */
  const [lit, setLit] = useState<Record<string, number>>({})
  const [finishNote, setFinishNote] = useState<string | null>(null)

  // ---------- 朗读 ----------
  const speakRef = useRef<PoemSpeakControl | null>(null)
  const [audioIndex, setAudioIndex] = useState<number | null>(null)
  const [speaking, setSpeaking] = useState(false)

  const stopSpeech = useCallback(() => {
    speakRef.current?.cancel()
    speakRef.current = null
    setSpeaking(false)
    setAudioIndex(null)
  }, [])

  // 卸载时兜底停止朗读
  useEffect(() => stopSpeech, [stopSpeech])

  // 切到另一首诗（内容指纹变化）时清空本面板的背诵状态
  const poemKey = useMemo(() => poemPracticeFingerprint(poem), [poem])
  const seenPoemRef = useRef<string | null>(null)
  useEffect(() => {
    if (seenPoemRef.current === null) {
      seenPoemRef.current = poemKey
      return
    }
    if (seenPoemRef.current !== poemKey) {
      seenPoemRef.current = poemKey
      stopSpeech()
      setRevealed(new Set())
      setLit({})
      setAudioDone(new Set())
      setFinishNote(null)
      finishGuard.current = { manual: false, audio: false }
    }
  }, [poemKey, stopSpeech])

  /** 朗读序列（题目→作者→正文行，整首跟读用） */
  const seq = unitsAll
  const unitAt = useCallback(
    (key: string) => unitsAll.find((u) => u.key === key),
    [unitsAll],
  )

  const speakIndex = useCallback(
    (idx: number, registerDone: boolean) => {
      const unit = seq[idx]
      if (!unit) return
      stopSpeech()
      const row = document.getElementById(`recite-unit-${unit.key}`)
      row?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      const control = speakPoemText(unit.text, {
        onStart: () => {
          setSpeaking(true)
          setAudioIndex(idx)
        },
        onEnd: () => {
          setSpeaking(false)
          setAudioIndex(null)
          if (registerDone) {
            setAudioDone((prev) => (prev.has(unit.key) ? prev : new Set(prev).add(unit.key)))
          }
        },
        onError: () => {
          setSpeaking(false)
          setAudioIndex(null)
        },
      })
      speakRef.current = control
      if (!control) {
        // 环境不支持语音（如语音列表为空）时静默降级：不标记、不报错
        setAudioIndex(null)
      }
    },
    [seq, stopSpeech],
  )

  const scrollToUnit = useCallback((key: string) => {
    const row = document.getElementById(`recite-unit-${key}`)
    row?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [])

  // ---------- 派生状态 ----------
  const challenge = useMemo(() => {
    return unitsAll.filter((u) => {
      if (u.kind === 'title') return !showTitle
      if (u.kind === 'author') return !showAuthor
      return true
    })
  }, [unitsAll, showTitle, showAuthor])

  const currentIdx = challenge.findIndex((u) => !revealed.has(u.key))
  const currentUnit = currentIdx >= 0 ? challenge[currentIdx] : undefined
  const currentUnitIdx = currentUnit ? seq.findIndex((u) => u.key === currentUnit.key) : -1

  const manualDone = challenge.length > 0 && challenge.every((u) => revealed.has(u.key))
  const audioAllDone = seq.length > 0 && seq.every((u) => audioDone.has(u.key))

  const finishGuard = useRef({ manual: false, audio: false })
  useEffect(() => {
    if (!manualDone) {
      finishGuard.current.manual = false
      return
    }
    if (finishGuard.current.manual) return
    finishGuard.current.manual = true
    setFinishNote('You recited the whole poem — nice!')
    recordReciteResult(projectId, poem.id, {
      completedOnce: true,
      bestHintLevelIndex: PRACTICE_HINT_LEVELS.indexOf(hintLevel),
      fingerprint: poemPracticeFingerprint(poem),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manualDone])

  useEffect(() => {
    if (!audioAllDone) {
      finishGuard.current.audio = false
      return
    }
    if (finishGuard.current.audio) return
    finishGuard.current.audio = true
    setFinishNote('You listened through the whole poem.')
    recordReciteResult(projectId, poem.id, {
      completedOnce: true,
      bestHintLevelIndex: PRACTICE_HINT_LEVELS.indexOf(hintLevel),
      fingerprint: poemPracticeFingerprint(poem),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioAllDone])

  // ---------- 行为 ----------
  /** 一个单元「当前实际露出」的非空白 token 数：档位基线与逐字点亮取大，封顶 total */
  const exposeVisible = useCallback(
    (unit: PracticeUnit): number => {
      const tokens = splitDisplayTokens(unit.text)
      const total = countRevealableTokens(tokens)
      if (revealed.has(unit.key)) return total
      const base = visibleTokenCount(tokens, hintLevel, 0)
      return Math.min(total, Math.max(base, lit[unit.key] ?? 0))
    },
    [revealed, hintLevel, lit],
  )

  /** 点亮到目标个数（1..total）；点满最后一字 = 整行揭开 */
  const revealThrough = useCallback(
    (key: string, through: number) => {
      if (speaking) return
      const unit = unitAt(key)
      if (!unit) return
      if (revealed.has(key)) return
      const total = countRevealableTokens(splitDisplayTokens(unit.text))
      const target = Math.max(1, Math.min(total, through))
      if (target >= total) {
        setRevealed((prev) => (prev.has(key) ? prev : new Set(prev).add(key)))
        const idx = challenge.findIndex((u) => u.key === key)
        const next = challenge[idx + 1]
        if (next) scrollToUnit(next.key)
      } else {
        setLit((prev) => ({ ...prev, [key]: Math.max(prev[key] ?? 0, target) }))
      }
    },
    [speaking, unitAt, revealed, challenge, scrollToUnit],
  )

  const revealWhole = useCallback(
    (key: string) => {
      if (speaking) return
      stopSpeech()
      const unit = unitAt(key)
      const total = unit ? countRevealableTokens(splitDisplayTokens(unit.text)) : 0
      setRevealed((prev) => (prev.has(key) ? prev : new Set(prev).add(key)))
      if (total > 0) setLit((prev) => ({ ...prev, [key]: total }))
      // 揭开后滚动到下一行（若下一行仍存在）
      const idx = challenge.findIndex((u) => u.key === key)
      const next = challenge[idx + 1]
      if (next) scrollToUnit(next.key)
    },
    [speaking, stopSpeech, unitAt, challenge, scrollToUnit],
  )

  /** “Show one character”：在当前露出基础上多亮一个 */
  const revealNextChar = useCallback(
    (key: string) => {
      const unit = unitAt(key)
      if (!unit) return
      const exposed = exposeVisible(unit)
      const total = countRevealableTokens(splitDisplayTokens(unit.text))
      if (exposed >= total) revealWhole(key)
      else revealThrough(key, exposed + 1)
    },
    [unitAt, exposeVisible, revealWhole, revealThrough],
  )

  const playNext = useCallback(() => {
    if (speaking) return
    const start = audioIndex === null ? 0 : audioIndex + 1
    const next = seq.findIndex((u, i) => i >= start && !audioDone.has(u.key))
    if (next < 0) return
    speakIndex(next, true)
  }, [speaking, audioIndex, seq, audioDone, speakIndex])

  const listenCurrent = useCallback(() => {
    if (speaking || currentUnitIdx < 0) return
    speakIndex(currentUnitIdx, false)
  }, [speaking, currentUnitIdx, speakIndex])

  const resetAll = useCallback(() => {
    stopSpeech()
    setRevealed(new Set())
    setAudioDone(new Set())
    setLit({})
    setFinishNote(null)
    finishGuard.current = { manual: false, audio: false }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [stopSpeech])

  const nextRate = useCallback(() => {
    const idx = POEM_RATE_STEPS.indexOf(rate as (typeof POEM_RATE_STEPS)[number])
    setRate(POEM_RATE_STEPS[(idx + 1) % POEM_RATE_STEPS.length]!)
  }, [rate, setRate])

  // 键盘：Manual 下 Space/Enter 揭开整行；Audio 空闲时播下一句；Esc 停止朗读
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return
      if (e.key === 'Escape') {
        if (speaking) stopSpeech()
        return
      }
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        if (driver === 'manual') {
          if (currentUnit) revealWhole(currentUnit.key)
        } else if (!speaking) {
          playNext()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [driver, speaking, currentUnit, revealWhole, playNext, stopSpeech])

  const audioReady = support === 'ok'
  const hasContent = unitsAll.length > 0

  // ---------- 渲染 ----------
  const renderHeader = (kind: 'title' | 'author') => {
    const unit = unitsAll.find((u) => u.kind === kind)
    if (!unit) return null
    const shown = kind === 'title' ? showTitle : showAuthor
    if (shown) {
      return (
        <div id={`recite-unit-${unit.key}`} className="text-center px-3 py-2">
          {kind === 'title' ? (
            <span className="inline-block text-2xl sm:text-3xl font-bold tracking-wide text-gray-800 select-text">
              {unit.text}
            </span>
          ) : (
            <span className="inline-block text-sm text-gray-500 select-text">—— {unit.text} ——</span>
          )}
        </div>
      )
    }
    return (
      <div id={`recite-unit-${unit.key}`} className="text-center px-3 py-2">
        <MaskedLine
          text={unit.text}
          visibleTokens={exposeVisible(unit)}
          onReveal={(through) => revealThrough(unit.key, through)}
          tone={kind === 'title' ? 'strong' : 'soft'}
          textClass={kind === 'title' ? 'text-2xl sm:text-3xl font-bold tracking-wide' : 'text-sm leading-relaxed'}
        />
      </div>
    )
  }

  const currentIsKey = (key: string) =>
    driver === 'manual' && currentUnit?.key === key && !revealed.has(key)

  const renderPoem = () => {
    const rows: ReactNode[] = []
    poem.lines.forEach((line, rowIndex) => {
      if (line.trim() === '') {
        rows.push(<div key={`gap-${rowIndex}`} className="py-1" />)
        return
      }
      const unit = lineByRow.get(rowIndex)
      if (!unit) return
      const visible = exposeVisible(unit)
      const active = currentIsKey(unit.key)
      rows.push(
        <div
          key={unit.key}
          id={`recite-unit-${unit.key}`}
          className={`rounded-lg transition-colors ${
            active ? 'bg-violet-100/80 ring-1 ring-violet-300/60' : ''
          } ${driver === 'audio' && audioIndex !== null && audioIndex < seq.length && seq[audioIndex]?.key === unit.key ? 'bg-amber-50/80 ring-1 ring-amber-300/60' : ''}`}
        >
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="flex-1 text-center">
              <MaskedLine
                text={unit.text}
                visibleTokens={visible}
                onReveal={(through) => revealThrough(unit.key, through)}
                active={active}
                tone={active ? 'strong' : 'default'}
              />
            </div>
            <span
              className={`w-4 shrink-0 text-sm ${
                audioDone.has(unit.key) ? 'text-emerald-500' : 'text-transparent'
              }`}
              aria-hidden="true"
            >
              <Check className="w-4 h-4" />
            </span>
          </div>
        </div>,
      )
    })
    return rows
  }

  const progressText =
    driver === 'manual'
      ? challenge.length > 0
        ? `${revealed.size}/${challenge.length} lines`
        : `${revealed.size} revealed`
      : `${audioDone.size}/${seq.length} lines`

  if (!hasContent) {
    return (
      <div className="rounded-2xl bg-white/80 border border-gray-100 shadow-sm px-5 py-12 text-center text-gray-400 text-sm">
        This poem has no content yet — switch back to Read and add lines first.
      </div>
    )
  }

  return (
    <div className="rounded-2xl bg-white/80 border border-gray-100 shadow-sm px-4 sm:px-6 py-5 space-y-4">
      {/* 顶部工具行 */}
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <Segmented
          size="sm"
          value={driver}
          onChange={(v) => {
            if (v !== driver) {
              stopSpeech()
              setDriver(v)
            }
          }}
          options={[
            { value: 'manual' as const, label: 'Manual' },
            { value: 'audio' as const, label: 'Audio guided' },
          ]}
        />
        <div className="flex items-center gap-2 flex-wrap">
          {/* 语速（跟随全局朗读设置） */}
          <button
            type="button"
            onClick={nextRate}
            title="Speech rate"
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-600 hover:border-violet-300 hover:text-violet-700 transition-colors"
          >
            {rate}×
          </button>
        </div>
      </div>

      {/* 提示设置：档位 + 标题/作者独立显隐 */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 pb-3">
        <label className="text-xs text-gray-500 font-medium inline-flex items-center gap-1.5">
          Hint level
          <select
            value={hintLevel}
            onChange={(e) => setHintLevel(e.target.value as PracticeHintLevel)}
            className="px-2 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            {PRACTICE_HINT_LEVELS.map((l) => (
              <option key={l} value={l}>
                {PRACTICE_HINT_LABEL[l]}
              </option>
            ))}
          </select>
        </label>
        <span className="text-gray-200">|</span>
        <button
          type="button"
          onClick={() => setShowTitle((v) => !v)}
          className={`${TOGGLE_BTN} ${showTitle ? TOGGLE_ON : TOGGLE_OFF}`}
          title={showTitle ? 'Title visible (not part of the challenge)' : 'Title masked — recite it from memory'}
        >
          {showTitle ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          Show title
        </button>
        <button
          type="button"
          onClick={() => setShowAuthor((v) => !v)}
          className={`${TOGGLE_BTN} ${showAuthor ? TOGGLE_ON : TOGGLE_OFF}`}
          title={showAuthor ? 'Author visible (not part of the challenge)' : 'Author masked — recite it from memory'}
        >
          {showAuthor ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          Show author
        </button>
        <span className="text-gray-200">|</span>
        <span className="text-xs text-gray-400">Tap a hidden character to reveal it</span>
      </div>

      {/* 进度条 */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-purple-500 transition-all duration-300"
            style={{
              width: `${
                driver === 'manual'
                  ? challenge.length > 0
                    ? (revealed.size / challenge.length) * 100
                    : 0
                  : seq.length > 0
                    ? (audioDone.size / seq.length) * 100
                    : 0
              }%`,
            }}
          />
        </div>
        <span className="text-xs text-gray-500 tabular-nums whitespace-nowrap">{progressText}</span>
        <button
          type="button"
          onClick={resetAll}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Restart
        </button>
      </div>

      {/* 诗句主体 */}
      <div className="pt-1">
        {renderHeader('title')}
        {renderHeader('author')}
        <div className="mt-1">{renderPoem()}</div>
      </div>

      {/* 动作区 */}
      <div className="border-t border-gray-100 pt-4">
        {!audioReady && (
          <p className="mb-3 text-xs text-amber-600">
            Speech not available on this device — the “Listen / Audio guided” controls are disabled.
            Manual recitation still works.
          </p>
        )}
        {driver === 'manual' ? (
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={listenCurrent}
              disabled={!audioReady || currentUnitIdx < 0 || speaking}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:border-violet-300 hover:text-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Volume2 className="w-4 h-4" /> Listen
            </button>
            <button
              type="button"
              onClick={() => currentUnit && revealNextChar(currentUnit.key)}
              disabled={!currentUnit}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-violet-200 text-sm text-violet-700 hover:bg-violet-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Show one character
            </button>
            <button
              type="button"
              onClick={() => currentUnit && revealWhole(currentUnit.key)}
              disabled={!currentUnit}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 text-white text-sm font-medium shadow hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
            >
              <ChevronRight className="w-4 h-4" />
              {currentUnit
                ? `Reveal & next — ${challenge.indexOf(currentUnit) + 1}/${challenge.length}`
                : 'All revealed'}
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-center gap-2">
            {speaking ? (
              <>
                <button
                  type="button"
                  onClick={stopSpeech}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500 text-white text-sm font-medium shadow hover:bg-amber-600 transition-colors"
                >
                  <Square className="w-3.5 h-3.5" /> Stop listening
                </button>
                <span className="text-xs text-amber-600 inline-flex items-center gap-1.5 animate-pulse">
                  <Pause className="w-3.5 h-3.5" /> Now recite it aloud…
                </span>
              </>
            ) : audioAllDone ? (
              <>
                <span className="text-sm text-emerald-600 inline-flex items-center gap-1.5">
                  <Check className="w-4 h-4" /> Whole poem listened — tap Restart to go again.
                </span>
              </>
            ) : (
              <button
                type="button"
                onClick={playNext}
                disabled={!audioReady || audioAllDone}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 text-white text-sm font-medium shadow hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
              >
                <Play className="w-4 h-4" />
                {audioDone.size === 0 ? 'Start' : 'Read next line'}
              </button>
            )}
            <span className="text-xs text-gray-400">
              {speaking
                ? 'Listening…'
                : audioDone.size === 0
                  ? 'Each line is read aloud, then covered again — repeat it from memory.'
                  : 'Recited aloud yet? Read the next line when ready.'}
            </span>
          </div>
        )}
        {finishNote && (
          <p className="mt-3 text-center text-sm text-emerald-600 font-medium">{finishNote}</p>
        )}
      </div>
    </div>
  )
}
