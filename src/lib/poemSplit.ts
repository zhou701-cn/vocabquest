import type { PoemDraft } from '@/types/poem'

/**
 * 诗词拆分引擎。
 *
 * 输入通常是某个文件全文的行（已按行切分），按下面的策略自动拆成一首首诗词：
 * 1. 空行分段 —— 相邻诗篇之间往往有空行，作为第一级切分；
 * 2. 块内标题 / 作者识别 —— 块首为标题行，次行若为疑似作者行则单独取出；
 * 3. 无空行粘连 —— 对没有空行的“大块”进一步按标题+作者相邻、或上一行句末
 *    标点 + 下一行无标点短行 等启发式在内部二次切分；
 * 4. 碎片合并 —— 只有标题的孤行并入下一首、无标题的正文块并入上一首。
 *
 * 结果不保证 100% 准确，导入对话框内可逐首核对修正。
 */

const SENT_PUNCT = /[，。！？；：、,，!?;:…—]/
const END_STOP = /[。！？!?]$/
/** 标题包裹符：『静夜思』式书名号/引号 等 */
const TITLE_WRAPS = /^[《「『【〔［（(〔]+|[》」』】〕］）)]+$/g

/** 规范化文本为“行”：统一换行、去行尾空白、压缩连续空行 */
export function normalizeToLines(rawText: string): string[] {
  const normalized = rawText.replace(/\r\n?/g, '\n').replace(/\u0000/g, '')
  const rawLines = normalized.split('\n').map((line) => line.replace(/\s+$/, ''))
  const result: string[] = []
  let pendingBlank = false
  for (const line of rawLines) {
    if (line.trim() === '') {
      // 连续空行只保留一个
      if (result.length > 0 && !pendingBlank) {
        result.push('')
        pendingBlank = true
      }
      continue
    }
    result.push(line)
    pendingBlank = false
  }
  // 去掉末尾多余空行
  while (result.length > 0 && result[result.length - 1] === '') {
    result.pop()
  }
  return result
}

/** 按空行把行数组切分成若干块（每块内无空行） */
function splitByBlank(lines: string[]): string[][] {
  const groups: string[][] = []
  let cur: string[] = []
  for (const line of lines) {
    if (line.trim() === '') {
      if (cur.length > 0) {
        groups.push(cur)
        cur = []
      }
      continue
    }
    cur.push(line)
  }
  if (cur.length > 0) groups.push(cur)
  return groups
}

/** 清理一行正文：两端空白剔除 */
function tidy(t: string): string {
  return t.trim().replace(/\u0000/g, '')
}

function charCount(t: string): number {
  return Array.from(t).length
}

/** 去除书名号/引号包裹等装饰 */
export function stripTitleDecor(text: string): string {
  return tidy(text)
    .replace(TITLE_WRAPS, '')
    .replace(/^[·\s]+|[·\s]+$/g, '')
    .trim()
}

/** 是否为疑似标题行：短、不含句读类标点 */
export function looksLikeTitleLine(text: string): boolean {
  const t = tidy(text)
  if (!t) return false
  if (SENT_PUNCT.test(t)) return false
  const n = charCount(t)
  return n >= 1 && n <= 28
}

/** 是否为疑似作者行：纯汉字姓名/朝代前缀（2-4 字，允许 · 连接） */
export function isAuthorLine(text: string): boolean {
  const t = tidy(text)
  const n = charCount(t)
  if (n < 2 || n > 4) return false
  if (!/^[\u3400-\u9fff·]+$/.test(t)) return false
  if (/^第[一二三四五六七八九十百\d零]/.test(t)) return false
  return true
}

/** 清理一首诗的正文行：去行尾/行首空白、压缩连续空行、去掉首尾空行 */
export function cleanPoemLines(lines: string[]): string[] {
  const result: string[] = []
  let pendingBlank = false
  for (const line of lines) {
    const t = tidy(line)
    if (!t) {
      // 连续空行只保留一个
      if (result.length > 0 && !pendingBlank) {
        result.push('')
        pendingBlank = true
      }
      continue
    }
    result.push(t)
    pendingBlank = false
  }
  while (result.length > 0 && result[result.length - 1] === '') {
    result.pop()
  }
  return result
}

interface Unit {
  title: string
  author?: string
  content: string[]
}

/** 解析一个块（内部不含空行）：首位取标题，次位疑似作者行单独摘出 */
function parseUnit(groupLines: string[]): Unit {
  const ls = groupLines.map(tidy).filter((l) => l !== '')
  if (ls.length === 0) return { title: '', content: [] }
  const first = ls[0]
  if (!looksLikeTitleLine(first)) {
    // 首行不像标题（有标点/过长）→ 视为某个块的无标题正文
    return { title: '', content: ls }
  }
  const title = stripTitleDecor(first)
  let author: string | undefined
  let start = 1
  // 次行是作者：同时要求“再下一行不是作者”（避免四言诗连排被误判）
  if (
    ls.length >= 2 &&
    isAuthorLine(ls[1]) &&
    (ls.length < 3 || !isAuthorLine(ls[2]))
  ) {
    author = ls[1]
    start = 2
  }
  return { title, author, content: ls.slice(start) }
}

/**
 * 对已提取标题的块在“正文内部”做二次切分：
 * 常见于排版没有空行分隔的合集，下一首紧跟上一首正文。
 */
function refineUnit(unit: Unit): Unit[] {
  if (!unit.title || unit.content.length < 2) return [unit]
  const result: Unit[] = []
  let curTitle = unit.title
  let curAuthor = unit.author
  let buf: string[] = []
  const push = () => {
    result.push({ title: curTitle, author: curAuthor, content: buf })
  }
  let i = 0
  const content = unit.content
  while (i < content.length) {
    const line = content[i]
    const prev = i > 0 ? content[i - 1] : undefined
    const next = i + 1 < content.length ? content[i + 1] : undefined
    const boundary =
      i > 0 &&
      looksLikeTitleLine(line) &&
      ((next !== undefined && isAuthorLine(next)) || (prev !== undefined && END_STOP.test(prev)))
    if (boundary) {
      push()
      curTitle = stripTitleDecor(line)
      curAuthor = next !== undefined && isAuthorLine(next) ? next : undefined
      buf = []
      if (curAuthor !== undefined) i += 1
    } else {
      buf.push(line)
    }
    i += 1
  }
  push()
  return result
}

/**
 * 把整篇（文件）的行自动拆分为一首首诗词。
 * @param rawLines 行数组（可为原始文本行，内部会再折叠空行）
 * @param fallbackPrefix 完全识别不出标题时使用的兜底前缀（默认为“诗”）
 */
export function autoSplitPoemCards(rawLines: string[], fallbackPrefix = '诗'): PoemDraft[] {
  const lines = normalizeToLines(rawLines.join('\n'))
  const units: Unit[] = []
  for (const group of splitByBlank(lines)) {
    const u = parseUnit(group)
    if (!u.title) {
      units.push(u)
      continue
    }
    units.push(...refineUnit(u))
  }

  // ① 孤立的标题行（无正文）：若下一首块首行像作者，则吸收为下一首的标题/作者
  const step1: Unit[] = []
  let i = 0
  while (i < units.length) {
    const u = units[i]
    if (u.title && u.content.length === 0 && !u.author) {
      const next = units[i + 1]
      if (next && next.title && !next.author && isAuthorLine(next.title)) {
        const authorName = next.title
        next.title = u.title
        next.author = authorName
        i += 1
        continue
      }
    }
    step1.push(u)
    i += 1
  }

  // ② 无标题的正文块并入上一首（视为误空行导致的断裂）
  const step2: Unit[] = []
  for (const u of step1) {
    if (!u.title) {
      const last = step2[step2.length - 1]
      if (last && last.title) {
        if (last.content.length > 0 && last.content[last.content.length - 1] !== '') {
          last.content.push('')
        }
        last.content.push(...u.content)
        continue
      }
    }
    step2.push({ ...u })
  }

  // ③ 丢弃无正文的残块（孤立的章节标题/封面名/页码），并兜底标题编号
  let counter = 0
  return step2
    .filter((u) => u.content.length > 0)
    .map((u) => {
      counter += 1
      const title = tidy(u.title) || `${fallbackPrefix}${counter}`
      return {
        title,
        author: u.author ? tidy(u.author) : undefined,
        lines: cleanPoemLines(u.content),
      }
    })
}
