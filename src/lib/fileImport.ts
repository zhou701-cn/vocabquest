import { unzipSync } from 'fflate'
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import type { ParsedFileResult, PoemFileFormat } from '@/types/poem'

/** pdfjs textContent 的最小结构（实际类型未从包根导出） */
interface PdfTextContentLike {
  items: ReadonlyArray<{
    str?: string
    transform?: number[]
    hasEOL?: boolean
  }>
}

// 通过 ?url 让 Vite 把 PDF worker 作为独立资源引用（dev / build 均可用）
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

/** 根据文件扩展名判断可导入的格式 */
export function detectFormat(fileName: string): PoemFileFormat {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
  switch (ext) {
    case 'pdf':
      return 'pdf'
    case 'docx':
      return 'docx'
    case 'txt':
      return 'txt'
    case 'md':
    case 'markdown':
      return 'md'
    default:
      return 'other'
  }
}

/** 支持的导入类型（accept 过滤） */
export const SUPPORTED_ACCEPT =
  '.pdf,.docx,.txt,.md,.markdown,application/pdf,text/plain,text/markdown'

export class UnsupportedFileError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UnsupportedFileError'
  }
}

/**
 * 解析导入文件为纯文本。
 * 支持的格式：PDF、Word(.docx)、TXT、Markdown。
 */
export async function parseFileToText(file: File): Promise<ParsedFileResult> {
  const format = detectFormat(file.name)
  const fileName = file.name

  let text: string
  switch (format) {
    case 'pdf':
      text = await extractPdfText(await file.arrayBuffer())
      break
    case 'docx':
      text = await extractDocxText(await file.arrayBuffer())
      break
    case 'txt':
    case 'md':
      text = await file.text()
      break
    default:
      throw new UnsupportedFileError(
        `Unsupported file type: ${file.name}. Please use PDF, Word (.docx), TXT or Markdown.`,
      )
  }

  // 空内容保护
  if (!text.trim()) {
    throw new UnsupportedFileError(`"${file.name}" contains no readable text.`)
  }

  return { text, format, fileName }
}

/* ------------------------------ PDF ------------------------------ */

/** 把 PDF 某一页的 textContent 近似还原成按视觉行分组的文本 */
function layoutPdfTextContent(content: PdfTextContentLike): string[] {
  type Placed = { str: string; x: number; y: number; h: number }
  const placed: Placed[] = []
  for (const item of content.items) {
    const str = item.str ?? ''
    if (!str.trim()) continue
    const t = item.transform ?? [1, 0, 0, 1, 0, 0]
    const h = Math.hypot(t[2] ?? 0, t[3] ?? 0) || Math.abs(t[3]) || 12
    placed.push({ str, x: t[4] ?? 0, y: t[5] ?? 0, h })
  }

  // 按 y 坐标分桶（同阈值视为同一行），保持首现顺序
  const buckets: Placed[][] = []
  for (const p of placed) {
    const bucket = buckets.find(
      (b) => Math.abs((b[0]?.y ?? 0) - p.y) <= Math.max(1.5, p.h * 0.45),
    )
    if (bucket) bucket.push(p)
    else buckets.push([p])
  }

  return buckets.map((bucket) => {
    const sorted = bucket.slice().sort((a, b) => a.x - b.x)
    let out = ''
    let lastEnd = Number.NEGATIVE_INFINITY
    for (const it of sorted) {
      const approxWidth = it.str.length * it.h * 0.5
      // 相邻片段间距过大时补一个空格（pdfjs 常把同行的词拆成多个片段）
      if (out && it.x - lastEnd > it.h * 0.35) out += ' '
      out += it.str
      lastEnd = it.x + approxWidth
    }
    return out
  })
}

async function extractPdfText(data: ArrayBuffer): Promise<string> {
  // 确保 worker 已配置（重复设置无副作用）
  if (!GlobalWorkerOptions.workerSrc) {
    GlobalWorkerOptions.workerSrc = pdfWorkerUrl
  }

  const loadingTask = getDocument({ data: new Uint8Array(data) })
  const pdf = await loadingTask.promise
  try {
    const pages: string[] = []
    for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
      const page = await pdf.getPage(pageNo)
      const content = await page.getTextContent()
      // pdfjs 实际类型未从包根导出，这里按最小结构收敛
      pages.push(
        layoutPdfTextContent(content as unknown as PdfTextContentLike).join('\n'),
      )
    }
    return pages.join('\n\n')
  } finally {
    try {
      await loadingTask.destroy()
    } catch {
      /* ignore destroy errors */
    }
  }
}

/* ----------------------------- DOCX ------------------------------ */

/** 递归序列化一个段落节点：取 w:t 内的文本，tab 与换行占位，忽略图片/域等 */
function serializeRunNode(node: Node, out: string[]): void {
  if (node.nodeType === Node.TEXT_NODE) {
    if (node.parentElement?.tagName === 'w:t') {
      out.push(node.textContent ?? '')
    }
    return
  }
  const el = node as Element
  if (el.tagName === 'w:tab') {
    out.push(' ')
    return
  }
  if (el.tagName === 'w:br') {
    out.push('\n')
    return
  }
  if (el.tagName === 'w:pict' || el.tagName === 'w:drawing' || el.tagName === 'w:object') {
    return // 忽略内嵌图片 / OLE 对象
  }
  for (const child of Array.from(el.childNodes)) {
    serializeRunNode(child, out)
  }
}

async function extractDocxText(data: ArrayBuffer): Promise<string> {
  const files = unzipSync(new Uint8Array(data))
  const entry = files['word/document.xml']
  if (!entry) {
    throw new UnsupportedFileError(
      'This file does not look like a valid Word document (.docx).',
    )
  }
  const xmlText = new TextDecoder().decode(entry)
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml')
  const paragraphs = Array.from(doc.getElementsByTagName('w:p'))
  if (paragraphs.length === 0) {
    throw new UnsupportedFileError('No paragraph content found in this .docx file.')
  }
  return paragraphs
    .map((p) => {
      const chunks: string[] = []
      for (const child of Array.from(p.childNodes)) {
        serializeRunNode(child, chunks)
      }
      return chunks.join('')
    })
    .join('\n')
}

/* --------------------------- preview util --------------------------- */

/** 统计文本概况，供导入预览使用 */
export function summarizeLines(lines: string[]): {
  totalLines: number
  nonEmptyLines: number
  charCount: number
} {
  const nonEmptyLines = lines.filter((l) => l.trim() !== '').length
  const charCount = lines.reduce((acc, l) => acc + l.length, 0)
  return { totalLines: lines.length, nonEmptyLines, charCount }
}
