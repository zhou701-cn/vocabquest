/**
 * 默写单（田字格练习纸）的排版纯逻辑。
 *
 * 规则：
 *  - “内容字”（汉字 / 字母 / 数字等）在纸上留空：正文用田字格、作者/朝代行用下划线占位；
 *  - 标点符号与空白原样保留（不进格子）；
 *  - 一首诗始终单独成页，由打印预览页通过分页 CSS 保证。
 */

/** 内容字：汉字、拉丁字母、数字、注音/谚文字母等（\p{L}\p{N} 含 CJK） */
export function isWorksheetContentChar(c: string): boolean {
  return /[\p{L}\p{N}]/u.test(c)
}

export type WorksheetTokenKind = 'content' | 'punct' | 'space'

export interface WorksheetToken {
  text: string
  kind: WorksheetTokenKind
}

/** 空白（单个空格/制表等） */
const SPACE = /\s/u

/**
 * 把一段文字切成“排版 token”，每个 token 至多一个字符：
 *  - content：内容字（默写留空位置）
 *  - punct：标点 / 符号（原样显示）
 *  - space：空白（按空白宽度留空隙）
 * 不做 NFKC 归一，避免改动全角标点等原貌。
 */
export function splitWorksheetTokens(text: string): WorksheetToken[] {
  const out: WorksheetToken[] = []
  for (const raw of Array.from(text)) {
    if (SPACE.test(raw)) {
      out.push({ text: ' ', kind: 'space' })
    } else if (isWorksheetContentChar(raw)) {
      out.push({ text: raw, kind: 'content' })
    } else {
      out.push({ text: raw, kind: 'punct' })
    }
  }
  return out
}
