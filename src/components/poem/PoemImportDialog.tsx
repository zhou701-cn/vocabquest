import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  Check,
  FileText,
  FileUp,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import type { PoemDraft, PoemFileFormat, PoemImportMode } from '@/types/poem'
import { autoSplitPoemCards, normalizeToLines } from '@/lib/poemSplit'

const FORMAT_LABEL: Record<PoemFileFormat, string> = {
  pdf: 'PDF',
  docx: 'Word',
  txt: 'Text',
  md: 'Markdown',
  other: 'File',
}

export interface PoemImportConfirmData {
  name: string
  fileName: string
  format: PoemFileFormat
  /** 核对修正后的一首首诗词 */
  poems: PoemDraft[]
  mode: PoemImportMode
}

interface PoemImportDialogProps {
  open: boolean
  /** create: 新建项目；importMore: 向已有项目再次导入 */
  variant: 'create' | 'importMore'
  currentPoemCount?: number
  onClose: () => void
  onConfirm: (data: PoemImportConfirmData) => void
}

type Phase = 'idle' | 'parsing' | 'preview'

export function PoemImportDialog({
  open,
  variant,
  currentPoemCount = 0,
  onClose,
  onConfirm,
}: PoemImportDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const [phase, setPhase] = useState<Phase>('idle')
  const [fileName, setFileName] = useState('')
  const [format, setFormat] = useState<PoemFileFormat>('other')
  /** 解析出的全文行（用于一键“重新自动识别”） */
  const [parsedRaw, setParsedRaw] = useState<string[]>([])
  /** 核对修正中的诗词卡片 */
  const [cards, setCards] = useState<PoemDraft[]>([])
  const [name, setName] = useState('')
  const [nameTouched, setNameTouched] = useState(false)
  const [mode, setMode] = useState<PoemImportMode>('append')
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const reset = useCallback(() => {
    setPhase('idle')
    setFileName('')
    setFormat('other')
    setParsedRaw([])
    setCards([])
    setName('')
    setNameTouched(false)
    setMode('append')
    setError(null)
    setDragOver(false)
    if (inputRef.current) inputRef.current.value = ''
  }, [])

  // 每次打开时重置
  useEffect(() => {
    if (open) reset()
  }, [open, reset])

  if (!open) return null

  /* ------------------------------ 卡片操作 ------------------------------ */

  const patchCard = (i: number, patch: Partial<PoemDraft>) => {
    setCards((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)))
  }

  const cardContent = (i: number) => cards[i].lines.join('\n')
  const setCardContent = (i: number, value: string) => {
    patchCard(i, { lines: value.split('\n') })
  }

  /** 在本卡片内部按空行 / 标题规则再次切分成多首 */
  const splitCard = (i: number) => {
    const card = cards[i]
    const subs = autoSplitPoemCards(card.lines, card.title || '诗')
    if (subs.length < 2) return false
    setCards((prev) => {
      const next = [...prev]
      next.splice(i, 1, ...subs)
      return next
    })
    return true
  }

  /** 把本首并入上一首（保留上一首题目/作者，正文相接） */
  const mergeIntoPrev = (i: number) => {
    if (i <= 0) return
    const cur = cards[i]
    const prevCard = cards[i - 1]
    if (cur.title.trim() && cur.title.trim() !== prevCard.title.trim()) {
      if (
        !window.confirm(
          `"${cur.title.trim()}" has its own title. Merging will discard it. Continue?`,
        )
      ) {
        return
      }
    }
    setCards((prev) => {
      const next = [...prev]
      const item = next[i]
      const head = next[i - 1]
      next[i - 1] = {
        ...head,
        lines: [...head.lines, ...(head.lines.length ? [''] : []), ...item.lines],
      }
      next.splice(i, 1)
      return next
    })
  }

  const deleteCard = (i: number) => {
    if (!window.confirm('Delete this poem card from the import preview?')) return
    setCards((prev) => prev.filter((_, idx) => idx !== i))
  }

  const moveCard = (i: number, dir: -1 | 1) => {
    const to = i + dir
    if (to < 0 || to >= cards.length) return
    setCards((prev) => {
      const next = [...prev]
      const [item] = next.splice(i, 1)
      next.splice(to, 0, item)
      return next
    })
  }

  const reRecognize = () => {
    if (!window.confirm('Re-run automatic splitting? Your manual tweaks on the cards will be lost.')) {
      return
    }
    const base = fileName.replace(/\.[^.]+$/, '') || '诗'
    setCards(autoSplitPoemCards(parsedRaw, base))
  }

  /* ------------------------------ 文件解析 ------------------------------ */

  const handleFile = async (file: File) => {
    setError(null)
    setPhase('parsing')
    try {
      const { parseFileToText } = await import('@/lib/fileImport')
      const result = await parseFileToText(file)
      const lines = normalizeToLines(result.text)
      if (lines.length === 0) {
        throw new Error('No content extracted from this file.')
      }
      const base = result.fileName.replace(/\.[^.]+$/, '')
      const drafts = autoSplitPoemCards(lines, base)
      if (drafts.length === 0) {
        throw new Error('Could not recognize any poem in this file. Please check the content.')
      }
      setFileName(result.fileName)
      setFormat(result.format)
      setParsedRaw(lines)
      setCards(drafts)
      if (!nameTouched) {
        setName(base)
      }
      setPhase('preview')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse this file.')
      setPhase('idle')
    }
  }

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) void handleFile(file)
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) void handleFile(file)
  }

  /* ------------------------------ 确认 ------------------------------ */

  const handleConfirm = () => {
    const finalName = (name.trim() || fileName.replace(/\.[^.]+$/, '') || 'Untitled Poem').trim()
    const poems = cards.map((c, i) => ({
      title: c.title.trim() || `诗${i + 1}`,
      author: c.author?.trim() || undefined,
      lines: c.lines,
    }))
    if (poems.length === 0) return
    onConfirm({
      name: finalName,
      fileName,
      format,
      poems,
      mode: variant === 'importMore' ? mode : 'overwrite',
    })
    onClose()
  }

  const totalChars = cards.reduce(
    (acc, c) => acc + c.lines.reduce((n, l) => n + l.length, 0) + (c.title ? c.title.length : 0),
    0,
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[92vh] flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-violet-600 to-purple-600 text-white">
          <h2 className="font-semibold flex items-center gap-2">
            <FileUp className="w-5 h-5" />
            {variant === 'create' ? 'Import New Poem' : 'Import More Content'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-white/20 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* 选择文件区域 */}
          {(phase === 'idle' || phase === 'parsing') && (
            <>
              <div
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragOver(true)
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => inputRef.current?.click()}
                className={`cursor-pointer border-2 border-dashed rounded-xl p-10 text-center transition-colors ${
                  dragOver
                    ? 'border-violet-500 bg-violet-50'
                    : 'border-gray-300 bg-gray-50 hover:border-violet-400 hover:bg-violet-50/40'
                }`}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept=".pdf,.docx,.txt,.md,.markdown,application/pdf,text/plain,text/markdown"
                  className="hidden"
                  onChange={onPickFile}
                />
                {phase === 'parsing' ? (
                  <>
                    <Loader2 className="w-10 h-10 mx-auto animate-spin text-violet-500" />
                    <p className="mt-3 text-gray-600 font-medium">Parsing file…</p>
                    <p className="text-sm text-gray-400 mt-1">Reading text from the document</p>
                  </>
                ) : (
                  <>
                    <FileText className="w-10 h-10 mx-auto text-violet-400" />
                    <p className="mt-3 text-gray-700 font-medium">
                      Click to choose or drag &amp; drop a file here
                    </p>
                    <p className="text-sm text-gray-400 mt-1">
                      Supports PDF · Word (.docx) · TXT · Markdown
                    </p>
                    <p className="text-xs text-violet-400/80 mt-2">
                      Poems will be split automatically by blank lines &amp; titles — you can review
                      every card before saving.
                    </p>
                  </>
                )}
              </div>
              {error && (
                <p className="mt-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3">
                  {error}
                </p>
              )}
            </>
          )}

          {/* 拆分结果核对 */}
          {phase === 'preview' && (
            <div className="space-y-5">
              {/* 文件信息 */}
              <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
                <FileText className="w-4 h-4" />
                <span className="truncate font-medium text-gray-700 max-w-[180px]">{fileName}</span>
                <span className="px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 text-xs font-medium">
                  {FORMAT_LABEL[format]}
                </span>
                <span className="text-gray-300">|</span>
                <span>
                  <strong className="text-gray-700">{cards.length}</strong> poems recognized
                </span>
                <span className="text-gray-300">|</span>
                <span>{totalChars.toLocaleString()} chars</span>
              </div>

              {/* 项目名 */}
              {variant === 'create' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Project name
                  </label>
                  <input
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value)
                      setNameTouched(true)
                    }}
                    placeholder="Name this poem project"
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
              )}

              {/* 再次导入时的写入方式 */}
              {variant === 'importMore' && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Import mode</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setMode('append')}
                      className={`flex flex-col items-start gap-1 px-4 py-3 rounded-xl border-2 text-left transition-colors ${
                        mode === 'append'
                          ? 'border-violet-500 bg-violet-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <span className="flex items-center gap-1.5 font-medium text-gray-800">
                        <Sparkles className="w-4 h-4 text-violet-500" />
                        Append
                      </span>
                      <span className="text-xs text-gray-500 leading-snug">
                        Add {cards.length} poem(s) after the existing {currentPoemCount}
                      </span>
                    </button>
                    <button
                      onClick={() => setMode('overwrite')}
                      className={`flex flex-col items-start gap-1 px-4 py-3 rounded-xl border-2 text-left transition-colors ${
                        mode === 'overwrite'
                          ? 'border-violet-500 bg-violet-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <span className="flex items-center gap-1.5 font-medium text-gray-800">
                        <RefreshCw className="w-4 h-4 text-orange-500" />
                        Overwrite
                      </span>
                      <span className="text-xs text-gray-500 leading-snug">
                        Replace the entire project with these {cards.length} poem(s)
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {/* 拆分修正区 */}
              <div className="rounded-xl border border-gray-200 bg-gray-50/60">
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b border-gray-200">
                  <p className="text-sm font-medium text-gray-700">
                    Review split poems — each card is one poem
                  </p>
                  <button
                    onClick={reRecognize}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-violet-700 hover:bg-violet-100 transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Re-run auto split
                  </button>
                </div>

                <div className="space-y-3 p-4">
                  {cards.map((card, i) => (
                    <div key={i} className="rounded-xl bg-white border border-gray-200 shadow-sm">
                      {/* 卡头 */}
                      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-gray-100">
                        <span className="w-6 h-6 shrink-0 rounded-md bg-violet-100 text-violet-700 text-xs font-bold inline-flex items-center justify-center">
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0 flex items-center gap-1.5">
                          <input
                            value={card.title}
                            onChange={(e) => patchCard(i, { title: e.target.value })}
                            placeholder="Title"
                            className="w-full min-w-0 flex-1 px-2 py-1 rounded-md bg-gray-50 hover:bg-white border border-transparent hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm font-medium text-gray-800 transition-colors"
                          />
                          <input
                            value={card.author ?? ''}
                            onChange={(e) => patchCard(i, { author: e.target.value })}
                            placeholder="Author"
                            className="w-28 px-2 py-1 rounded-md bg-gray-50 hover:bg-white border border-transparent hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-500 text-xs text-gray-600 transition-colors"
                          />
                        </div>
                        <button
                          onClick={() => moveCard(i, -1)}
                          disabled={i === 0}
                          className="p-1 rounded-md text-gray-400 hover:text-violet-600 hover:bg-violet-50 disabled:opacity-30"
                          title="Move up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => moveCard(i, 1)}
                          disabled={i === cards.length - 1}
                          className="p-1 rounded-md text-gray-400 hover:text-violet-600 hover:bg-violet-50 disabled:opacity-30"
                          title="Move down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => mergeIntoPrev(i)}
                          disabled={i === 0}
                          className="px-2 py-1 rounded-md text-xs text-gray-500 hover:text-violet-700 hover:bg-violet-50 disabled:opacity-30"
                          title="Merge this poem into the previous one"
                        >
                          Merge up
                        </button>
                        <button
                          onClick={() => {
                            if (splitCard(i)) {
                              return
                            }
                            window.alert(
                              'No further split found. Add blank lines between poems inside the text, or split manually.',
                            )
                          }}
                          className="px-2 py-1 rounded-md text-xs text-gray-500 hover:text-violet-700 hover:bg-violet-50"
                          title="Try to split this card into multiple poems"
                        >
                          Re-split
                        </button>
                        <button
                          onClick={() => deleteCard(i)}
                          className="p-1 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50"
                          title="Delete this poem"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {/* 正文 */}
                      <div className="px-3 py-2.5">
                        <textarea
                          value={cardContent(i)}
                          onChange={(e) => setCardContent(i, e.target.value)}
                          placeholder={'Body lines — one line per row, e.g.\n床前明月光，\n疑是地上霜。'}
                          rows={Math.min(8, Math.max(2, card.lines.length + 1))}
                          className="w-full px-2.5 py-2 rounded-lg bg-gray-50 border border-transparent hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-500 font-mono text-sm text-gray-700 leading-relaxed resize-y transition-colors"
                        />
                        <p className="mt-1 text-[11px] text-gray-400">
                          {card.lines.filter((l) => l.trim() !== '').length} lines · each line
                          editable
                        </p>
                      </div>
                    </div>
                  ))}

                  {/* 添加一首 */}
                  <button
                    onClick={() =>
                      setCards((prev) => [...prev, { title: '', author: '', lines: [] }])
                    }
                    className="w-full py-2.5 rounded-xl border-2 border-dashed border-violet-200 text-violet-500 hover:border-violet-400 hover:bg-violet-50/50 transition-colors inline-flex items-center justify-center gap-2 font-medium text-sm"
                  >
                    <Plus className="w-4 h-4" /> Add a poem manually
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => reset()}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  Choose another file
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={cards.length === 0}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 text-white text-sm font-medium shadow hover:opacity-90 transition-opacity disabled:opacity-40"
                >
                  <Check className="w-4 h-4" />
                  {variant === 'create'
                    ? `Create project (${cards.length} poems)`
                    : mode === 'append'
                      ? `Append ${cards.length} poems`
                      : `Overwrite with ${cards.length} poems`}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
