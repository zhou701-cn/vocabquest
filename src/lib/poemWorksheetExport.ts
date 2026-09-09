/**
 * 默写单（田字格练习纸）导出为 Word (.docx) 的生成逻辑。
 *
 * 设计目标：让用户拿到一份可自行编辑的 Word 文档，而非纯打印图片。
 *  - 标题：居中加粗大字；
 *  - 作者/朝代行：内容字替换为下划线空格（方便填空），标点与间隔原样保留；
 *  - 正文：每个“内容字”用一个带边框的田字格单元，标点 / 空白用无边框单元原样占位；
 *  - 每首诗词始终单独成页（后续诗词前插入分页符）。
 *
 * 自适应排版（不折行）：
 *  1. 先按「整句一行」计算格子边长：取所有正文行里占用格数最多的一行，
 *     用页面可用宽度反推出格子边长，保证最长的整句也能完整落在一行内；
 *  2. 若某一句即使缩到最小可读格也放不下，则按逗号/句号/分号等标点把这句
 *     拆成若干「单句」，每个单句单独一行（仍以整句一行为优先）；
 *  3. 每张表格显式给出 tblGrid（columnWidths）+ 固定布局 + 精确总宽，
 *     并在相邻表格之间插入间隔段落，杜绝 Word 重排导致的错行/合并。
 */

import {
  AlignmentType,
  BorderStyle,
  Document,
  HeightRule,
  LineRuleType,
  Packer,
  PageBreak,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  UnderlineType,
  VerticalAlign,
  WidthType,
  type FileChild,
} from 'docx'
import type { Poem } from '@/types/poem'
import { splitWorksheetTokens } from './poemWorksheet'

/* ------------------------------ 版面常量 ------------------------------ */

/** A4 尺寸（twips：1/20 磅；1 英寸 = 1440） */
const A4_W = 11906
const A4_H = 16838
/** 页边距，模拟网页打印的 14mm ≈ 794 twips */
const MARGIN = 794

/** 页面正文可用宽度（twips），留 1% 余量避免临界溢出 */
const USABLE = Math.floor((A4_W - MARGIN * 2) * 0.99)

/** 单格最大边长（twips），约 1.2cm */
const MAX_CELL = 700
/** 优先最小边长（twips）：尽量整句一行时的下限，约 0.67cm 仍可书写 */
const MIN_CELL = 380
/** 绝对下限（twips）：仅在极长无标点句时才会用到，避免溢出 */
const HARD_MIN_CELL = 260
/** 标点 / 空白单元宽度相对格子的比例 */
const PUNCT_RATIO = 0.42

/** 中文字体：优先宋体，Word 缺字时自动替换 */
const CJK_FONT = 'SimSun'

const TITLE_SIZE = 36 // 18pt
const BODY_SIZE = 24 // 12pt（基准，随格子缩放）

/** 可作为「单句」断点的标点（断在这些标点之后） */
const CLAUSE_BREAK = /[，。；、！？：,.!?;:]/u

/* ------------------------------ 边框常量 ------------------------------ */

const GRID_BORDER = { style: BorderStyle.SINGLE, size: 6, color: '111111', space: 0 }
const PUNCT_BORDER = { style: BorderStyle.NONE, size: 0, color: 'auto', space: 0 }
const ZERO_MARGINS = { marginUnitType: WidthType.DXA, top: 0, bottom: 0, left: 0, right: 0 }

/* ------------------------------ 尺寸计算 ------------------------------ */

interface CellSizes {
  cellW: number
  punctW: number
  bodySize: number
}

/** 一行按 token 拆分后的资源占用（以“格子”为单位） */
function lineUnits(line: string): number {
  let units = 0
  for (const tk of splitWorksheetTokens(line)) {
    units += tk.kind === 'content' ? 1 : PUNCT_RATIO
  }
  return units
}

/** 按标点把一句拆成若干「单句」（保留结尾标点） */
function splitClauses(line: string): string[] {
  const clauses: string[] = []
  let cur = ''
  for (const tk of splitWorksheetTokens(line)) {
    cur += tk.text
    if (tk.kind === 'punct' && CLAUSE_BREAK.test(tk.text)) {
      clauses.push(cur)
      cur = ''
    }
  }
  if (cur.trim() !== '') clauses.push(cur)
  return clauses.filter((c) => c.trim() !== '')
}

/** 整句在给定格宽下能否一行放下 */
function fitsWhole(line: string, cellW: number): boolean {
  return lineUnits(line) * cellW <= USABLE
}

/** 该句需要被拆成的行（优先整句一行） */
function renderedRows(line: string, cellW: number): string[] {
  if (fitsWhole(line, cellW)) return [line]
  const clauses = splitClauses(line)
  return clauses.length > 0 ? clauses : [line]
}

/**
 * 计算自适应格子尺寸：
 *  - 能整句放下的行按整句计；
 *  - 连最小格都放不下的超长行按拆分后的最长单句计；
 *  取两者最大占用反推格宽，保证任何一行都不会折行。
 */
function computeCellSizes(poems: readonly Poem[]): CellSizes {
  let maxUnits = 0

  for (const poem of poems) {
    for (const line of poem.lines) {
      if (line.trim() === '') continue

      if (fitsWhole(line, MIN_CELL)) {
        // 整句一行即可放下
        maxUnits = Math.max(maxUnits, lineUnits(line))
      } else {
        // 超长句：需要按标点拆成单句，取最长单句
        for (const clause of splitClauses(line)) {
          maxUnits = Math.max(maxUnits, lineUnits(clause))
        }
      }
    }
  }

  const cellW =
    maxUnits <= 0
      ? MAX_CELL
      : Math.min(MAX_CELL, Math.max(HARD_MIN_CELL, Math.floor(USABLE / maxUnits)))

  return {
    cellW,
    punctW: Math.round(cellW * PUNCT_RATIO),
    bodySize: Math.max(12, Math.round((BODY_SIZE * cellW) / MAX_CELL)),
  }
}

/* ------------------------------ 单元构造 ------------------------------ */

/** 内容字：田字格（加边框、留空供书写） */
function gridCell(sizes: CellSizes): TableCell {
  return new TableCell({
    width: { size: sizes.cellW, type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    margins: ZERO_MARGINS,
    borders: {
      top: GRID_BORDER,
      bottom: GRID_BORDER,
      left: GRID_BORDER,
      right: GRID_BORDER,
    },
    children: [new Paragraph({ spacing: { before: 0, after: 0 }, children: [] })],
  })
}

/** 标点：原样显示（无边框） */
function punctCell(text: string, sizes: CellSizes): TableCell {
  return new TableCell({
    width: { size: sizes.punctW, type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    margins: ZERO_MARGINS,
    borders: {
      top: PUNCT_BORDER,
      bottom: PUNCT_BORDER,
      left: PUNCT_BORDER,
      right: PUNCT_BORDER,
    },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 0 },
        children: [new TextRun({ text, size: sizes.bodySize, font: CJK_FONT })],
      }),
    ],
  })
}

/** 空白：无边框、无内容（仅占位） */
function spaceCell(sizes: CellSizes): TableCell {
  return new TableCell({
    width: { size: sizes.punctW, type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    margins: ZERO_MARGINS,
    borders: {
      top: PUNCT_BORDER,
      bottom: PUNCT_BORDER,
      left: PUNCT_BORDER,
      right: PUNCT_BORDER,
    },
    children: [new Paragraph({ spacing: { before: 0, after: 0 }, children: [] })],
  })
}

/* ------------------------------ 行 / 段构造 ------------------------------ */

/**
 * 一行（整句或单句）渲染为一张单行表格。
 * 显式给出 columnWidths（tblGrid）+ 固定布局 + 精确总宽，杜绝重排折行。
 */
function rowTable(row: string, sizes: CellSizes): Table {
  const cells: TableCell[] = []
  const columnWidths: number[] = []

  for (const tk of splitWorksheetTokens(row)) {
    if (tk.kind === 'content') {
      cells.push(gridCell(sizes))
      columnWidths.push(sizes.cellW)
    } else if (tk.kind === 'space') {
      cells.push(spaceCell(sizes))
      columnWidths.push(sizes.punctW)
    } else {
      cells.push(punctCell(tk.text, sizes))
      columnWidths.push(sizes.punctW)
    }
  }

  if (cells.length === 0) {
    cells.push(spaceCell(sizes))
    columnWidths.push(sizes.punctW)
  }

  const totalW = columnWidths.reduce((a, b) => a + b, 0)

  return new Table({
    width: { size: totalW, type: WidthType.DXA },
    columnWidths,
    layout: TableLayoutType.FIXED,
    alignment: AlignmentType.CENTER,
    margins: ZERO_MARGINS,
    rows: [
      new TableRow({
        // 行高与格子边长一致，让田字格近似正方形
        height: { value: sizes.cellW, rule: HeightRule.ATLEAST },
        children: cells,
      }),
    ],
  })
}

/** 间隔段落：用于分隔相邻表格（防止表格被合并），并制造行距 */
function spacer(gapTwips: number): Paragraph {
  return new Paragraph({
    spacing: { before: 0, after: gapTwips, line: 40, lineRule: LineRuleType.EXACT },
    children: [],
  })
}

/** 标题行 */
function titleParagraph(title: string): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 240 },
    children: [new TextRun({ text: title, bold: true, size: TITLE_SIZE, font: CJK_FONT })],
  })
}

/** 作者/朝代行：内容字 → 下划线空格；标点/间隔原样 */
function authorParagraph(author: string): Paragraph {
  const runs = splitWorksheetTokens(author).map((tk) => {
    if (tk.kind === 'content') {
      return new TextRun({
        text: '\u3000\u3000', // 两个全角空格，宽度约为一个字
        size: BODY_SIZE,
        font: CJK_FONT,
        underline: { type: UnderlineType.SINGLE },
      })
    }
    if (tk.kind === 'space') {
      return new TextRun({ text: ' ', size: BODY_SIZE, font: CJK_FONT })
    }
    return new TextRun({ text: tk.text, size: BODY_SIZE, font: CJK_FONT })
  })

  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 120, after: 300 },
    children: runs,
  })
}

/** 一首诗词的全部子元素 */
function poemChildren(poem: Poem, sizes: CellSizes): FileChild[] {
  const out: FileChild[] = [titleParagraph(poem.title)]

  if (poem.author) {
    out.push(authorParagraph(poem.author))
  }

  const rowGap = Math.round(sizes.cellW * 0.35)
  const stanzaGap = Math.round(sizes.cellW * 0.7)

  for (const line of poem.lines) {
    if (line.trim() === '') {
      // 句间空行留白
      out.push(spacer(stanzaGap))
      continue
    }
    for (const row of renderedRows(line, sizes.cellW)) {
      out.push(rowTable(row, sizes))
      // 表格后必须跟一个段落，否则相邻表格会被 Word 合并
      out.push(spacer(rowGap))
    }
  }

  return out
}

/* ------------------------------ 组装文档 ------------------------------ */

/**
 * 生成默写单 Word 文档，返回 .docx 的 Blob。
 * @param poems 要导出的诗词列表（保持顺序）
 */
export async function buildPoemWorksheetDocx(poems: Poem[]): Promise<Blob> {
  const sizes = computeCellSizes(poems)
  const children: FileChild[] = []

  poems.forEach((poem, idx) => {
    if (idx > 0) {
      children.push(new Paragraph({ children: [new PageBreak()] }))
    }
    children.push(...poemChildren(poem, sizes))
  })

  const doc = new Document({
    creator: 'VocabQuest',
    sections: [
      {
        properties: {
          page: {
            size: { width: A4_W, height: A4_H },
            margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
          },
        },
        children,
      },
    ],
  })

  return Packer.toBlob(doc)
}

/** 触发浏览器下载给定的 Blob */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
