import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, RotateCcw } from 'lucide-react'
import type { Poem } from '@/types/poem'
import { usePoemPracticeStore } from '@/stores/poemPracticeStore'
import {
  buildPracticeUnits,
  judgeAgainstAnswer,
  poemPracticeFingerprint,
  type PracticeUnit,
  type PracticeUnitKind,
} from '@/lib/poemPractice'

interface PoemDictatePanelProps {
  projectId: string
  poem: Poem
}

type DictStatus = 'pending' | 'failed' | 'passed'

interface DictPhase {
  status: DictStatus
  value: string
  /** 上次判题：标准侧错误字符（原文下标） */
  expectedMismatch: number[]
  /** 上次判题：输入侧错误字符（输入原文下标） */
  typedMismatch: number[]
}

/** 按“原文版式”区分各单元的字号与节奏 */
const KIND_TEXT: Record<PracticeUnitKind, string> = {
  title: 'text-2xl sm:text-3xl font-bold tracking-wide',
  author: 'text-sm leading-relaxed',
  line: 'text-[19px] leading-loose tracking-wide',
}

/** 非 ASCII 视为全宽（中/日/韩/全角标点均约 1em），ASCII/空白约半宽 */
function estInputWidthEm(text: string): number {
  let w = 0
  for (const c of Array.from(text)) {
    if (/\s/.test(c)) w += 0.3
    else if (c.charCodeAt(0) <= 127) w += 0.58
    else w += 1
  }
  return Math.max(7, w + 2.6)
}

/** 按 kind 展示文本（作者保持原文的 —— —— 装饰） */
function displayText(unit: PracticeUnit): string {
  return unit.kind === 'author' ? `—— ${unit.text} ——` : unit.text
}

export function PoemDictatePanel({ projectId, poem }: PoemDictatePanelProps) {
  const recordDictateResult = usePoemPracticeStore((s) => s.recordDictateResult)

  const units = useMemo(() => buildPracticeUnits(poem), [poem])
  const lineByRow = useMemo(() => {
    const m = new Map<number, PracticeUnit>()
    units.forEach((u) => {
      if (u.kind === 'line' && u.lineIndex !== null) m.set(u.lineIndex, u)
    })
    return m
  }, [units])

  const [phases, setPhases] = useState<Record<string, DictPhase>>({})
  /** 本次会话里犯过的错（去重） */
  const wrongTypedRef = useRef<Set<string>>(new Set())
  const missedRef = useRef<Set<string>>(new Set())
  const [summary, setSummary] = useState<string | null>(null)

  // 切到另一首诗时清空上次的默写状态
  const poemKey = useMemo(() => poemPracticeFingerprint(poem), [poem])
  const seenPoemRef = useRef<string | null>(null)
  useEffect(() => {
    if (seenPoemRef.current === null) {
      seenPoemRef.current = poemKey
      return
    }
    if (seenPoemRef.current !== poemKey) {
      seenPoemRef.current = poemKey
      setPhases({})
      wrongTypedRef.current = new Set()
      missedRef.current = new Set()
      setSummary(null)
      finishGuard.current = false
    }
  }, [poemKey])

  const getPhase = useCallback(
    (key: string): DictPhase => phases[key] ?? { status: 'pending', value: '', expectedMismatch: [], typedMismatch: [] },
    [phases],
  )

  const patchPhase = useCallback((key: string, patch: Partial<DictPhase>) => {
    setPhases((prev) => ({
      ...prev,
      [key]: {
        status: 'pending',
        value: '',
        expectedMismatch: [],
        typedMismatch: [],
        ...prev[key],
        ...patch,
      },
    }))
  }, [])

  const allPassed =
    units.length > 0 && units.every((u) => (phases[u.key]?.status ?? 'pending') === 'passed')

  const finishGuard = useRef(false)
  useEffect(() => {
    if (!allPassed) {
      finishGuard.current = false
      return
    }
    if (finishGuard.current) return
    finishGuard.current = true
    const wrongTyped = [...wrongTypedRef.current]
    const missed = [...missedRef.current]
    setSummary(
      `Dictation complete${
        wrongTyped.length + missed.length > 0
          ? ` — ${wrongTyped.length} typo char${wrongTyped.length === 1 ? '' : 's'}, ${missed.length} missed`
          : ' — all correct!'
      }`,
    )
    recordDictateResult(projectId, poem.id, {
      wrongTypedChars: wrongTyped,
      missedChars: missed,
      fingerprint: poemPracticeFingerprint(poem),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allPassed])

  const focusKey = useCallback((key: string, delay = 30) => {
    window.setTimeout(() => {
      const el = document.getElementById(`dictate-input-${key}`)
      if (el) {
        ;(el as HTMLInputElement).focus()
        el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      }
    }, delay)
  }, [])

  // 挂载后聚焦第一个单元
  const firstKey = units[0]?.key
  useEffect(() => {
    if (firstKey) {
      const t = window.setTimeout(() => focusKey(firstKey, 120), 80)
      return () => window.clearTimeout(t)
    }
    return undefined
  }, [firstKey, focusKey])

  const checkUnit = useCallback(
    (unit: PracticeUnit) => {
      const phase = getPhase(unit.key)
      if (phase.status === 'passed') return
      if (phase.value.trim() === '') return
      const outcome = judgeAgainstAnswer(unit.text, phase.value)
      if (outcome.pass) {
        patchPhase(unit.key, { status: 'passed' })
        // 聚焦下一个未完成的单元
        const idx = units.findIndex((u) => u.key === unit.key)
        const next = units.slice(idx + 1).find((u) => (phases[u.key]?.status ?? 'pending') !== 'passed')
        if (next) focusKey(next.key)
        return
      }
      // 记录错误（重复错误不重复累积）
      outcome.typedBadChars.forEach((c) => wrongTypedRef.current.add(c))
      outcome.missedChars.forEach((c) => missedRef.current.add(c))
      patchPhase(unit.key, {
        status: 'failed',
        expectedMismatch: outcome.expectedMismatch,
        typedMismatch: outcome.typedMismatch,
      })
    },
    [getPhase, patchPhase, units, phases, focusKey],
  )

  const restart = useCallback(() => {
    setPhases({})
    wrongTypedRef.current = new Set()
    missedRef.current = new Set()
    setSummary(null)
    finishGuard.current = false
    const first = units[0]
    if (first) focusKey(first.key)
  }, [units, focusKey])

  // 渲染一行字符（按 NFKC 数组展示，下标与判题结果对齐）
  const renderChars = (
    text: string,
    mismatch: number[],
    tone: 'error' | 'ok',
    sizeClass: string,
  ) => {
    const chars = Array.from(text.normalize('NFKC'))
    const bad = new Set(mismatch)
    return (
      <span className={`${sizeClass} whitespace-pre-wrap select-text`}>
        {chars.map((c, i) =>
          bad.has(i) ? (
            <span
              key={i}
              className={`rounded px-0.5 ${
                tone === 'error'
                  ? 'bg-red-200/70 text-red-700'
                  : 'bg-red-100/80 text-red-600 line-through decoration-red-400'
              }`}
            >
              {c}
            </span>
          ) : tone === 'ok' ? (
            <span key={i} className="text-emerald-700">
              {c}
            </span>
          ) : (
            <span key={i} className="text-gray-600">
              {c}
            </span>
          ),
        )}
      </span>
    )
  }

  const renderEntry = (unit: PracticeUnit) => {
    const phase = getPhase(unit.key)
    const passed = phase.status === 'passed'
    const failed = phase.status === 'failed'
    const inputId = `dictate-input-${unit.key}`

    if (passed) {
      return (
        <div className={`text-center ${KIND_TEXT[unit.kind]}`}>
          <span className="inline-block text-gray-800 select-text whitespace-pre-wrap">
            {displayText(unit)}
          </span>
          <span className="ml-2 inline-flex items-center text-emerald-600">
            <Check className="w-4 h-4" aria-hidden="true" />
          </span>
        </div>
      )
    }

    return (
      <div className="flex flex-col items-center">
        <div className="flex flex-wrap items-center justify-center gap-2 max-w-full">
          <input
            id={inputId}
            value={phase.value}
            onChange={(e) => patchPhase(unit.key, { value: e.target.value })}
            onKeyDown={(e) => {
              // 中文输入法组词中按 Enter 不触发判题
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                e.preventDefault()
                checkUnit(unit)
              }
            }}
            aria-label={`Dictate: ${unit.text}`}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            className={`bg-transparent text-center focus:outline-none border-b-2 transition-colors ${KIND_TEXT[unit.kind]} ${
              failed ? 'border-red-400' : 'border-gray-300 focus:border-violet-500 hover:border-gray-400'
            }`}
            style={{ width: `min(${estInputWidthEm(unit.text).toFixed(2)}em, 100%)`, maxWidth: '100%' }}
          />
          <button
            type="button"
            onClick={() => checkUnit(unit)}
            disabled={phase.value.trim() === ''}
            className="shrink-0 px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-medium hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Check
          </button>
        </div>

        {failed && (
          <div className="mt-1.5 w-full space-y-0.5 px-3">
            <div className="text-center">
              {renderChars(phase.value, phase.typedMismatch, 'error', 'text-[15px] leading-relaxed tracking-wide')}
            </div>
            <div className="text-center">
              {renderChars(unit.text, phase.expectedMismatch, 'ok', 'text-[15px] leading-relaxed tracking-wide')}
            </div>
          </div>
        )}
      </div>
    )
  }

  const renderPoemSheet = () => {
    const rows: React.ReactNode[] = []
    // 标题 / 作者，按原文版式先排
    const header = units.filter((u) => u.kind === 'title' || u.kind === 'author')
    header.forEach((unit, i) => {
      rows.push(
        <div key={unit.key} className={`w-full px-3 ${i === header.length - 1 ? 'pb-1' : 'pb-3'}`}>
          {renderEntry(unit)}
        </div>,
      )
    })
    // 正文：按 poem.lines 走，保留空行留白
    poem.lines.forEach((text, rowIndex) => {
      if (text.trim() === '') {
        rows.push(<div key={`gap-${rowIndex}`} className="py-2.5" />)
        return
      }
      const unit = lineByRow.get(rowIndex)
      if (!unit) return
      rows.push(
        <div key={unit.key} className="w-full px-3 py-2.5">
          {renderEntry(unit)}
        </div>,
      )
    })
    return rows
  }

  if (units.length === 0) {
    return (
      <div className="rounded-2xl bg-white/80 border border-gray-100 shadow-sm px-5 py-12 text-center text-gray-400 text-sm">
        Nothing to dictate yet — switch back to Read and add lines first.
      </div>
    )
  }

  return (
    <div className="rounded-2xl bg-white/80 border border-gray-100 shadow-sm px-4 sm:px-8 py-5 sm:py-8">
      <div className="flex items-start justify-between gap-3 flex-wrap px-1">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Dictation</h2>
          <p className="mt-1 text-xs text-gray-500 max-w-md">
            Write the poem from memory — title and author included. Punctuation, spacing and letter
            case are ignored.
          </p>
        </div>
        <button
          type="button"
          onClick={restart}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Restart
        </button>
      </div>

      {/* 复刻原文版式：标题/作者/正文空行与阅读页一致，待默写的行是居中的“填空线” */}
      <div className="mt-5 sm:mt-6 flex flex-col items-center">{renderPoemSheet()}</div>

      {summary && (
        <div className="mt-6 flex items-center justify-between gap-3 flex-wrap rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3">
          <span className="text-sm font-medium text-emerald-700 inline-flex items-center gap-2">
            <Check className="w-4 h-4" /> {summary}
          </span>
          <button
            type="button"
            onClick={restart}
            className="inline-flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-900 transition-colors"
          >
            <ChevronDown className="w-3.5 h-3.5 rotate-180" /> Write it again
          </button>
        </div>
      )}
    </div>
  )
}
