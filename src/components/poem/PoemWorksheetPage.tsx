import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, FileText, Printer, Download } from 'lucide-react'
import type { Poem, PoemProject } from '@/types/poem'
import {
  splitWorksheetTokens,
  type WorksheetToken,
} from '@/lib/poemWorksheet'
import { buildPoemWorksheetDocx, downloadBlob } from '@/lib/poemWorksheetExport'

interface PoemWorksheetPageProps {
  project: PoemProject
}

/** 导出格式：PDF 使用浏览器打印，Word 生成 .docx 下载 */
type ExportFormat = 'pdf' | 'word'

/**
 * 默写单导出页。
 *
 * 进入方式：/poem/:projectId/export
 *  - 不带 ?poems= → 导出项目全部诗词；
 *  - 带 ?poems=id1,id2… → 只导出勾选的诗词（保持项目内原始顺序）。
 * 每首诗词一个 <section>，依靠 CSS 分页保证“一页只放一首”；PDF 走浏览器打印窗口，Word 生成 .docx 下载。
 */
export function PoemWorksheetPage({ project }: PoemWorksheetPageProps) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const raw = params.get('poems')?.trim() ?? ''
  const [format, setFormat] = useState<ExportFormat>('pdf')
  const [exporting, setExporting] = useState(false)

  const poems = useMemo(() => {
    const all = project.poems ?? []
    if (!raw) return all
    const wanted = new Set(raw.split(',').map((s) => s.trim()).filter(Boolean))
    // 保持项目内原始顺序，跳过已删除/不存在的 id
    return all.filter((p) => wanted.has(p.id))
  }, [project.poems, raw])

  if (poems.length === 0) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-gray-500 mb-4">No poems selected to export.</p>
          <button
            onClick={() => navigate(`/poem/${project.id}`)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to project
          </button>
        </div>
      </div>
    )
  }

  const openProject = () => navigate(`/poem/${project.id}`)

  const sanitizeFileName = (name: string) =>
    name.replace(/[\\/:*?"<>|]+/g, '_').trim() || 'poem-worksheet'

  const handleExport = async () => {
    if (format === 'pdf') {
      window.print()
      return
    }
    if (poems.length === 0 || exporting) return
    setExporting(true)
    try {
      const blob = await buildPoemWorksheetDocx(poems)
      downloadBlob(blob, `${sanitizeFileName(project.name)}.docx`)
    } catch (err) {
      console.error('Failed to generate Word document:', err)
      window.alert('Word export failed. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 py-8 print:bg-white print:py-0">
      {/* 屏幕工具栏（打印时隐藏） */}
      <div className="mx-auto max-w-4xl px-4 sm:px-6 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white/90 border border-gray-200 shadow px-4 py-3">
          <button
            onClick={openProject}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back</span>
          </button>
          <div className="text-sm text-gray-700 flex items-center gap-2">
            <span className="font-semibold truncate max-w-[260px]">{project.name}</span>
            <span className="text-gray-400">·</span>
            <span>
              {poems.length} poem{poems.length === 1 ? '' : 's'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* 格式切换：PDF 默认 / Word */}
            <div className="flex items-center rounded-lg border border-gray-200 bg-white p-0.5 text-sm font-medium">
              <button
                type="button"
                onClick={() => setFormat('pdf')}
                aria-pressed={format === 'pdf'}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
                  format === 'pdf'
                    ? 'bg-violet-600 text-white shadow'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <FileText className="w-4 h-4" />
                PDF
              </button>
              <button
                type="button"
                onClick={() => setFormat('word')}
                aria-pressed={format === 'word'}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
                  format === 'word'
                    ? 'bg-violet-600 text-white shadow'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <FileText className="w-4 h-4" />
                Word
              </button>
            </div>

            <button
              onClick={handleExport}
              disabled={exporting}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 text-white text-sm font-semibold shadow hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {format === 'pdf' ? (
                <Printer className="w-4 h-4" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              {exporting ? 'Generating…' : format === 'pdf' ? 'Print / Save PDF' : 'Download Word'}
            </button>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-4xl px-2 sm:px-6 print:max-w-none print:p-0">
        {poems.map((poem, idx) => (
          <PoemSheet key={poem.id} poem={poem} first={idx === 0} />
        ))}
      </main>
    </div>
  )
}

/* ------------------------------ 单首诗词版式 ------------------------------ */

function PoemSheet({ poem, first }: { poem: Poem; first: boolean }) {
  return (
    <section
      aria-label={poem.title}
      className={`wz-sheet mx-auto mt-8 mb-8 w-[176mm] max-w-full shadow-md rounded-sm px-5 py-8 box-border sm:px-8 print:mt-0 print:mb-0 print:max-w-none print:w-auto print:rounded-none print:shadow-none ${
        first ? '' : 'wz-page-break'
      }`}
    >
      <h1 className="wz-title">{poem.title}</h1>

      {poem.author ? (
        <div className="wz-author mt-4">
          {splitWorksheetTokens(poem.author).map((tk, i) =>
            tk.kind === 'content' ? (
              // 作者/朝代内容字：逐个替换为下划线空格
              <span key={i} className="wz-blank" aria-hidden="true" />
            ) : tk.kind === 'space' ? (
              <span key={i} className="wz-gap" aria-hidden="true" />
            ) : (
              <span key={i} className="wz-punct">
                {tk.text}
              </span>
            ),
          )}
        </div>
      ) : null}

      <div className="mt-8">
        {poem.lines.map((line, li) => {
          if (line.trim() === '') {
            // 句间空行留白
            return <div key={li} className="wz-stanza" aria-hidden="true" />
          }
          return <WorksheetLine key={li} text={line} />
        })}
      </div>
    </section>
  )
}

/** 正文一行：内容字 → 田字格，标点/空白原样 */
function WorksheetLine({ text }: { text: string }) {
  const tokens = useMemo(() => splitWorksheetTokens(text), [text])
  return (
    <div className="wz-line">
      {tokens.map((tk: WorksheetToken, i) => {
        if (tk.kind === 'content') {
          return <span key={i} className="wz-cell" aria-hidden="true" />
        }
        if (tk.kind === 'space') {
          return <span key={i} className="wz-gap" aria-hidden="true" />
        }
        return (
          <span key={i} className="wz-punct">
            {tk.text}
          </span>
        )
      })}
    </div>
  )
}
