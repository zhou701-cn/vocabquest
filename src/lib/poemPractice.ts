/**
 * 诗词背诵 / 默写练习的纯逻辑（与 UI 解耦，便于复用与将来落库/单测）。
 *
 * 提供：
 *  - 练习单元建模：题目 / 作者 / 正文每一非空行；
 *  - 遮盖渲染用的“显示 token”切分（CJK 逐字、拉丁字母/数字按词），
 *    让“逐字点亮”“提示档位露首字/前半”都在字符粒度上成立；
 *  - 判题：忽略标点、空白与大小写后逐字比对，输出逐字错误位置；
 *  - 诗词内容指纹：正文一旦编辑，旧练习进度即失效。
 */

/** 单元类型：题目 / 作者 / 正文行 */
export type PracticeUnitKind = 'title' | 'author' | 'line'

/** 一个练习单元（标题/作者有则必练；正文只收非空行） */
export interface PracticeUnit {
  /** 稳定 key：title / author / l<原行号> */
  key: string
  kind: PracticeUnitKind
  /** kind === 'line' 时对应 poem.lines 的原始下标（用于空行留白定位） */
  lineIndex: number | null
  text: string
}

export function practiceUnitKey(kind: PracticeUnitKind, lineIndex: number | null): string {
  if (kind === 'line' && lineIndex !== null) return `l${lineIndex}`
  return kind
}

export interface PoemLike {
  title: string
  author?: string
  lines: string[]
}

/** 建单元。正文中每个非空行 → 一个单元（空行被跳过，仅作段落留白）。 */
export function buildPracticeUnits(poem: PoemLike): PracticeUnit[] {
  const units: PracticeUnit[] = []
  const push = (kind: PracticeUnitKind, lineIndex: number | null, text: string) => {
    if (!text.trim()) return
    units.push({ key: practiceUnitKey(kind, lineIndex), kind, lineIndex, text })
  }
  if (poem.title.trim()) push('title', null, poem.title)
  if (poem.author?.trim()) push('author', null, poem.author)
  poem.lines.forEach((line, i) => push('line', i, line))
  return units
}

/** 自然朗读顺序 = 题目 → 作者 → 正文全部非空行（与 buildPracticeUnits 相同顺序）。 */
export function buildReadingSequence(poem: PoemLike): PracticeUnit[] {
  return buildPracticeUnits(poem)
}

/* ------------------------------ 提示档位 ------------------------------ */

export const PRACTICE_HINT_LEVELS = ['none', 'firstChar', 'half', 'full'] as const
export type PracticeHintLevel = (typeof PRACTICE_HINT_LEVELS)[number]

/** 档位展示名（英文 UI） */
export const PRACTICE_HINT_LABEL: Record<PracticeHintLevel, string> = {
  none: 'No hints',
  firstChar: 'First char',
  half: 'First half',
  full: 'Full text',
}

/** 全部“内容字”字符数（提示档位以此估算；标点不计） */
export function totalContentChars(tokens: DisplayToken[]): number {
  let n = 0
  for (const tk of tokens) {
    if (isRevealableToken(tk)) n += Array.from(tk.text).length
  }
  return n
}

/**
 * 露出“至少 minChars 个内容字符”所需的前缀 token 个数（作用于可点亮 token 计数域）。
 * minChars <= 0 → 0；文本非空但 minChars 过小时至少露 1 个。
 */
export function prefixTokenCountForChars(tokens: DisplayToken[], minChars: number): number {
  if (minChars <= 0) return 0
  let chars = 0
  let n = 0
  for (const tk of tokens) {
    if (!isRevealableToken(tk)) continue
    if (chars >= minChars) break
    n += 1
    chars += Array.from(tk.text).length
  }
  return n > 0 ? n : countRevealableTokens(tokens) > 0 ? 1 : 0
}

/**
 * 综合“提示档位 + 手动点亮数(extra)”得出应露出的非空白 token 个数。
 * 逐字点亮：在档位基础上再逐 token 点亮。
 */
export function visibleTokenCount(
  tokens: DisplayToken[],
  level: PracticeHintLevel,
  extra: number,
): number {
  const total = countRevealableTokens(tokens)
  if (level === 'full') return total
  if (total === 0) return 0
  let base = 0
  if (level === 'none') {
    base = 0
  } else if (level === 'firstChar') {
    base = prefixTokenCountForChars(tokens, 1)
  } else {
    // half：露出约一半内容字符
    const half = Math.max(1, Math.ceil(totalContentChars(tokens) / 2))
    base = prefixTokenCountForChars(tokens, half)
  }
  return Math.max(0, Math.min(total, base + Math.max(0, extra)))
}

/* ------------------------------ 显示 token ------------------------------ */

export interface DisplayToken {
  /** token 文本（CJK 单字 / 拉丁词 / 标点 / 空白） */
  text: string
  /** 是否空白（渲染为普通空格，不参与遮盖计分） */
  ws: boolean
  /** 是否标点/符号（始终明文显示，不参与遮盖计分） */
  punct?: boolean
}

/** 可遮盖 token：非空白且非标点符号的“内容字”（汉字 / 字母 / 数字等） */
export function isRevealableToken(tk: DisplayToken): boolean {
  return !tk.ws && !tk.punct
}

const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u
const CJK_OR_KANA = /[\u3400-\u9fff\u3040-\u30ff]/u
const SPACE = /\s/u

/** 把一个长文本切成展示 token：CJK 逐字、拉丁字母/数字按整词、标点单列、空白单列。 */
export function splitDisplayTokens(text: string): DisplayToken[] {
  const out: DisplayToken[] = []
  for (const raw of Array.from(text.normalize('NFKC'))) {
    if (SPACE.test(raw)) {
      out.push({ text: ' ', ws: true })
      continue
    }
    const last = out[out.length - 1]
    const latinLike = LETTER_OR_DIGIT.test(raw) && !CJK_OR_KANA.test(raw)
    if (latinLike && last && !last.ws && !last.punct && LETTER_OR_DIGIT.test(last.text[0] ?? '') && !CJK_OR_KANA.test(last.text[0] ?? '')) {
      // 连续拉丁/数字并成一词
      last.text += raw
      continue
    }
    if (LETTER_OR_DIGIT.test(raw)) {
      out.push({ text: raw, ws: false })
    } else {
      // 标点 / 符号：始终可见，不作为遮盖单元
      out.push({ text: raw, ws: false, punct: true })
    }
  }
  return out
}

/** 可点亮 token 数量（遮盖进度按它推进，标点不计入） */
export function countRevealableTokens(tokens: DisplayToken[]): number {
  return tokens.filter(isRevealableToken).length
}

/** 第 n 个“可点亮 token”在 token 数组中的下标（n 从 0 起；找不到返回 -1） */
export function revealableTokenIndex(tokens: DisplayToken[], n: number): number {
  let seen = 0
  for (let i = 0; i < tokens.length; i += 1) {
    if (!isRevealableToken(tokens[i]!)) continue
    if (seen === n) return i
    seen += 1
  }
  return -1
}

/** 某个“点亮/档位”数字对应的实际 token 下标上限（n = 已点亮的可点亮 token 个数） */
export function revealPrefixLength(tokens: DisplayToken[], n: number): number {
  let seen = 0
  let i = 0
  for (; i < tokens.length; i += 1) {
    if (!isRevealableToken(tokens[i]!)) continue
    if (seen >= n) break
    seen += 1
  }
  return i
}

/* ------------------------------ 判题（宽容比对） ------------------------------ */

export interface JudgeOutcome {
  pass: boolean
  /** 标准答案里被漏写/写错的字符（原始下标，用于高亮） */
  expectedMismatch: number[]
  /** 输入里多余/写错的字符（原始下标，用于高亮） */
  typedMismatch: number[]
  /** 去重后的“应写未写/写错的字”（标准侧，记入错字集） */
  missedChars: string[]
  /** 去重后的“实际打错的字”（输入侧，记入错字集） */
  typedBadChars: string[]
}

/** 是否属于“内容字”（字母/数字），标点与空白在判题时忽略 */
function isContentChar(c: string): boolean {
  return LETTER_OR_DIGIT.test(c)
}

/** 归一：NFKC + 只保留内容字 + 折叠大小写，同时记住每个字符在原文的下标 */
function normContent(s: string): { chars: string[]; orig: number[] } {
  const chars: string[] = []
  const orig: number[] = []
  Array.from(s.normalize('NFKC')).forEach((c, i) => {
    if (!isContentChar(c)) return
    chars.push(c.toLocaleLowerCase())
    orig.push(i)
  })
  return { chars, orig }
}

/**
 * 判题：期望串与输入串去除标点/空白/大小写后逐字比对。
 * 用 LCS 对齐避免“漏一个字导致后面全红”的连锁误标。
 */
export function judgeAgainstAnswer(expected: string, typed: string): JudgeOutcome {
  const e = normContent(expected)
  const t = normContent(typed)
  const n = e.chars.length
  const m = t.chars.length

  // LCS DP
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[i]![j] =
        e.chars[i] === t.chars[j]
          ? (dp[i + 1]![j + 1] ?? 0) + 1
          : Math.max(dp[i + 1]![j] ?? 0, dp[i]![j + 1] ?? 0)
    }
  }

  // 回溯收集“匹配上的”下标
  const eMatched = new Array<boolean>(n).fill(false)
  const tMatched = new Array<boolean>(m).fill(false)
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (e.chars[i] === t.chars[j]) {
      eMatched[i] = true
      tMatched[j] = true
      i += 1
      j += 1
    } else if ((dp[i + 1]![j] ?? 0) >= (dp[i]![j + 1] ?? 0)) {
      i += 1
    } else {
      j += 1
    }
  }

  const expectedMismatch: number[] = []
  const typedMismatch: number[] = []
  e.chars.forEach((_, idx) => {
    if (!eMatched[idx]) expectedMismatch.push(e.orig[idx]!)
  })
  t.chars.forEach((_, idx) => {
    if (!tMatched[idx]) typedMismatch.push(t.orig[idx]!)
  })

  const expectedSet = new Set<string>()
  const typedSet = new Set<string>()
  eMatched.forEach((matched, idx) => {
    if (!matched) expectedSet.add(e.chars[idx] ?? '')
  })
  tMatched.forEach((matched, idx) => {
    if (!matched) typedSet.add(t.chars[idx] ?? '')
  })
  expectedSet.delete('')
  typedSet.delete('')

  return {
    pass: expectedMismatch.length === 0 && typedMismatch.length === 0,
    expectedMismatch,
    typedMismatch,
    missedChars: [...expectedSet],
    typedBadChars: [...typedSet],
  }
}

/** 正文内容指纹：编辑后旧练习进度失效 */
export function poemPracticeFingerprint(poem: PoemLike): string {
  return [poem.title.trim(), (poem.author ?? '').trim(), ...poem.lines].join('\n')
}
