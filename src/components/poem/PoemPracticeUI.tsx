import { useMemo } from 'react'
import {
  countRevealableTokens,
  isRevealableToken,
  revealPrefixLength,
  splitDisplayTokens,
  type DisplayToken,
} from '@/lib/poemPractice'

/**
 * 背诵面板共享的“可遮盖文本行”。
 *
 * 渲染规则：
 *  - visibleTokens = 应露出的可点亮 token 数（0 = 全盖，n = 露前 n 个）；
 *  - 只遮盖“内容字”（汉字 / 字母 / 数字）；标点与空白始终明文显示、不计入遮盖；
 *  - 未露出的内容 token 渲染为等宽圆角色块（内容不可选中、屏幕阅读器忽略），
 *    点击任意隐藏块 = 点亮一个 token（逐字点亮入口，行为由上层 onReveal 决定）；
 *  - 全部露出时退化为普通正文（保持原文排版）。
 */

export interface MaskedLineProps {
  text: string
  /** 露出的可点亮 token 个数 */
  visibleTokens: number
  /**
   * 点按某个隐藏 token 时回调，参数 = 点亮到该字为止应露出的
   * 可点亮 token 个数（即“露到点击处”）。
   */
  onReveal?: (revealThrough: number) => void
  /** 当前单元高亮（跟读/正在背这行） */
  active?: boolean
  /** 隐藏色块配色主题 */
  tone?: 'default' | 'soft' | 'strong'
  /** 行内基础类（含字号，默认 19px 正文） */
  className?: string
  /** 覆盖默认字号/行高类 */
  textClass?: string
}

/** 已露出的“内容字”以何种前景色展示（active 时同高亮色，否则正文色） */
function visibleCls(active: boolean): string {
  return active ? 'text-violet-700' : 'text-gray-800'
}

export function MaskedLine({
  text,
  visibleTokens,
  onReveal,
  active = false,
  tone = 'default',
  className = '',
  textClass = 'text-[19px] leading-loose tracking-wide',
}: MaskedLineProps) {
  const tokens = useMemo(() => splitDisplayTokens(text), [text])
  const revealableTotal = useMemo(() => countRevealableTokens(tokens), [tokens])
  // 露到第 visibleTokens 个内容字时，token 数组的“内容字前缀”边界
  const prefix = revealPrefixLength(tokens, Math.max(0, visibleTokens))
  const hasHidden = visibleTokens < revealableTotal
  const pillCls =
    tone === 'strong'
      ? 'bg-violet-200/80 hover:bg-violet-300/80'
      : tone === 'soft'
        ? 'bg-slate-200/70 hover:bg-slate-300/70'
        : 'bg-gray-200/70 hover:bg-gray-300/70'

  if (!hasHidden) {
    // 内容字全部可见：按普通正文排版（标点本就始终可见）
    return (
      <span
        className={`inline-block ${textClass} select-text whitespace-pre-wrap ${
          active ? 'text-violet-700' : 'text-gray-800'
        } ${className}`}
      >
        {text}
      </span>
    )
  }

  const renderVisibleToken = (tk: DisplayToken, key: number) => (
    <span key={key} className={`inline-block ${visibleCls(active)}`}>
      {tk.text}
    </span>
  )

  return (
    <span
      className={`inline-flex flex-wrap items-center justify-center gap-x-[3px] gap-y-1 ${textClass} select-none whitespace-pre-wrap ${className}`}
      aria-label={text}
    >
      {tokens.map((tk, i) => {
        if (tk.ws) {
          return (
            <span key={i} aria-hidden="true" className="inline-block">
              {' '}
            </span>
          )
        }
        // 标点/符号：始终明文显示
        if (!isRevealableToken(tk)) return renderVisibleToken(tk, i)
        if (i < prefix) return renderVisibleToken(tk, i)
        return (
          <button
            key={i}
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            onClick={() => {
              if (!onReveal) return
              // 露到点击处所需的可点亮 token 数
              let through = 0
              for (let k = 0; k <= i; k += 1) {
                if (isRevealableToken(tokens[k]!)) through += 1
              }
              onReveal(through)
            }}
            className={`inline-flex items-center justify-center rounded px-[2px] py-[1px] text-transparent transition-colors ${pillCls} ${
              onReveal ? 'cursor-pointer' : 'cursor-default'
            }`}
          >
            {tk.text}
          </button>
        )
      })}
    </span>
  )
}

/** 分段切换（Read / Recite / Dictate） */
export interface SegmentedOption<T extends string> {
  value: T
  label: string
  disabled?: boolean
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
}: {
  options: SegmentedOption<T>[]
  value: T
  onChange: (v: T) => void
  size?: 'sm' | 'md'
}) {
  const base =
    size === 'sm'
      ? 'px-3 py-1.5 text-xs'
      : 'px-5 py-2 text-sm'
  return (
    <div
      role="tablist"
      className="inline-flex items-center rounded-xl bg-white/90 border border-gray-200 shadow-sm p-1 gap-1"
    >
      {options.map((opt) => {
        const selected = opt.value === value
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={selected}
            type="button"
            disabled={opt.disabled}
            onClick={() => onChange(opt.value)}
            className={`${base} rounded-lg font-medium transition-all ${
              selected
                ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow'
                : 'text-gray-500 hover:text-violet-700 hover:bg-violet-50'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
