import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  Check,
  Pencil,
  Play,
  Pause,
  Plus,
  Quote,
  Repeat1,
  Save,
  SkipBack,
  SkipForward,
  Square,
  Trash2,
  X,
} from 'lucide-react'
import type { Poem, PoemProject } from '@/types/poem'
import { usePoemStore } from '@/stores/poemStore'
import { POEM_RATE_STEPS, usePoemPlayerStore } from '@/stores/poemPlayerStore'
import { PoemRecitePanel } from './PoemRecitePanel'
import { PoemDictatePanel } from './PoemDictatePanel'
import { Segmented } from './PoemPracticeUI'

/** 单首内容页的展示模式 */
type ContentMode = 'read' | 'recite' | 'dictate'

interface PoemContentViewProps {
  project: PoemProject
  poem: Poem
  /** 返回项目（诗词列表页） */
  onBack: () => void
  /** 上一曲/下一曲：跳到项目内另一首诗词 */
  onSelectPoem?: (poemId: string) => void
  /**
   * 是否开启正文“单行行内编辑”（行号列、点击行编辑、悬停插入行/删除行等操作）。
   * 默认为 false：正文以纯净阅读排版展示，不显示单行操作；
   * 需要精细调整单行内容时置为 true（整首改写仍可随时使用顶部 “Edit poem”）。
   */
  lineEditingEnabled?: boolean
}

type EditingState =
  | { kind: 'edit'; index: number; draft: string }
  | { kind: 'insert'; afterIndex: number; draft: string }

export function PoemContentView({
  project,
  poem,
  onBack,
  onSelectPoem,
  lineEditingEnabled = false,
}: PoemContentViewProps) {
  const updatePoemMeta = usePoemStore((s) => s.updatePoemMeta)
  const setPoemLines = usePoemStore((s) => s.setPoemLines)
  const updatePoemLine = usePoemStore((s) => s.updatePoemLine)
  const insertPoemLine = usePoemStore((s) => s.insertPoemLine)
  const deletePoemLine = usePoemStore((s) => s.deletePoemLine)
  const deletePoem = usePoemStore((s) => s.deletePoem)

  // ---------- 朗读播放器 ----------
  const support = usePoemPlayerStore((s) => s.support)
  const playStatus = usePoemPlayerStore((s) => s.status)
  const rate = usePoemPlayerStore((s) => s.rate)
  const playMode = usePoemPlayerStore((s) => s.mode)
  const reading = usePoemPlayerStore((s) => s.reading)
  const playingProjectId = usePoemPlayerStore((s) => s.playingProjectId)
  const playingPoemId = usePoemPlayerStore((s) => s.playingPoemId)
  const playerInit = usePoemPlayerStore((s) => s.init)
  const playerPlay = usePoemPlayerStore((s) => s.playPoem)
  const playerPause = usePoemPlayerStore((s) => s.pause)
  const playerResume = usePoemPlayerStore((s) => s.resume)
  const playerStop = usePoemPlayerStore((s) => s.stop)
  const playerSetRate = usePoemPlayerStore((s) => s.setRate)
  const playerSetMode = usePoemPlayerStore((s) => s.setMode)

  const [editing, setEditing] = useState<EditingState | null>(null)
  const [deleteConfirmIndex, setDeleteConfirmIndex] = useState<number | null>(null)
  const [confirmDeletePoem, setConfirmDeletePoem] = useState(false)
  const [fullEditOpen, setFullEditOpen] = useState(false)
  const [contentMode, setContentMode] = useState<ContentMode>('read')

  const lines = poem.lines
  const nonEmpty = lines.filter((l) => l.trim() !== '').length

  // 项目内全部诗词（供上一曲/下一曲定位）
  const allPoems = project.poems ?? []
  const poemIndex = allPoems.findIndex((p) => p.id === poem.id)

  // 初始化语音能力检测（含中文语音列表异步加载）
  useEffect(() => {
    playerInit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 进入练习模式：若正在播放（含其它诗词/整本后台续播）一律停掉，保证练习语境无外部发声
  useEffect(() => {
    if (contentMode === 'read') {
      setEditing(null)
      setConfirmDeletePoem(false)
      return
    }
    const st = usePoemPlayerStore.getState()
    if (st.status !== 'idle') playerStop()
    setEditing(null)
    setConfirmDeletePoem(false)
    window.scrollTo({ top: 0 })
  }, [contentMode, playerStop])

  // 注：本页不再“进入后自动停掉旧音频”——全局悬浮播放器可能正在整本续播，
  // 切页/浏览不应打断播放；需要停止时由播放器上的停止按钮显式控制。
  const isThisPoemActive =
    playingProjectId === project.id && playingPoemId === poem.id && playStatus !== 'idle'

  // 同项目后台正在播放别的诗词时的提示（便于在详情页切回本首）
  const otherPlayingTitle =
    playStatus !== 'idle' &&
    playingProjectId === project.id &&
    !!playingPoemId &&
    playingPoemId !== poem.id
      ? allPoems.find((p) => p.id === playingPoemId)?.title ?? null
      : null

  // 当前正在朗读的位置（仅本诗有效）
  const readingKind = isThisPoemActive ? reading?.kind ?? null : null
  const readingLine = isThisPoemActive && reading?.kind === 'line' ? (reading.line ?? null) : null
  const readingTitleActive = readingKind === 'title'
  const readingAuthorActive = readingKind === 'author'

  // 自动滚动到正在朗读的行
  const activeRowRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (readingLine !== null && isThisPoemActive && activeRowRef.current) {
      activeRowRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
  }, [readingLine, isThisPoemActive])

  const handleMainButton = () => {
    if (isThisPoemActive && playStatus === 'playing') {
      playerPause()
    } else if (isThisPoemActive && playStatus === 'paused') {
      playerResume()
    } else {
      playerPlay(project.id, poem)
    }
  }

  const jumpToPoem = (target: Poem | undefined) => {
    if (!target) return
    playerPlay(project.id, target)
    onSelectPoem?.(target.id)
  }

  const goPrev = () => jumpToPoem(poemIndex > 0 ? allPoems[poemIndex - 1] : undefined)
  const goNext = () =>
    jumpToPoem(poemIndex >= 0 && poemIndex < allPoems.length - 1 ? allPoems[poemIndex + 1] : undefined)
  const canPrev = poemIndex > 0
  const canNext = poemIndex >= 0 && poemIndex < allPoems.length - 1

  const nextRate = () => {
    const idx = POEM_RATE_STEPS.indexOf(rate as (typeof POEM_RATE_STEPS)[number])
    const next = POEM_RATE_STEPS[(idx + 1) % POEM_RATE_STEPS.length]
    playerSetRate(next)
  }

  const nowReadingLabel = isThisPoemActive
    ? readingKind === 'title'
      ? '朗读：题目'
      : readingKind === 'author'
        ? '朗读：作者'
        : readingLine !== null
          ? `朗读：第 ${readingLine + 1} 行`
          : ''
    : ''

  const stopAndGoBack = () => {
    playerStop()
    onBack()
  }

  const handleDeletePoem = () => {
    playerStop()
    deletePoem(project.id, poem.id)
    onBack()
  }

  const isEditingRow = (rowIndex: number) =>
    !!editing &&
    ((editing.kind === 'edit' && editing.index === rowIndex) ||
      (editing.kind === 'insert' && editing.afterIndex === rowIndex))

  const startEdit = (index: number) => setEditing({ kind: 'edit', index, draft: lines[index] })

  const startInsertAfter = (afterIndex: number) =>
    setEditing({ kind: 'insert', afterIndex, draft: '' })

  const saveEditing = () => {
    if (!editing) return
    const value = editing.draft.replace(/\s+$/, '')
    if (editing.kind === 'edit') {
      updatePoemLine(project.id, poem.id, editing.index, value)
    } else {
      insertPoemLine(project.id, poem.id, editing.afterIndex, value)
    }
    setEditing(null)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-purple-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        {/* 导航 */}
        <div className="flex items-center gap-3">
          <button
            onClick={stopAndGoBack}
            className="inline-flex items-center gap-1.5 text-gray-600 hover:text-gray-900 transition-colors font-medium text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            {project.name}
          </button>
          <span className="text-gray-300">/</span>
          <span className="text-sm text-gray-500 truncate">{poem.title || 'Untitled'}</span>
          <div className="flex-1" />
          {contentMode === 'read' && (
            <>
          <button
            onClick={() => setFullEditOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 hover:text-violet-700 hover:bg-white border border-transparent hover:border-violet-200 transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" /> Edit poem
          </button>
          {confirmDeletePoem ? (
            <span className="inline-flex items-center gap-1 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-2 py-1.5">
              Delete poem?
              <button
                onClick={handleDeletePoem}
                className="px-1.5 py-0.5 rounded bg-red-600 text-white hover:bg-red-700"
              >
                Yes
              </button>
              <button
                onClick={() => setConfirmDeletePoem(false)}
                className="px-1.5 py-0.5 rounded text-red-700 hover:bg-red-100"
              >
                No
              </button>
            </span>
          ) : (
            <button
              onClick={() => setConfirmDeletePoem(true)}
              className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              aria-label="Delete poem"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
            </>
          )}
        </div>

        {/* Read / Recite / Dictate 切换 */}
        <div className="mt-5">
          <Segmented<ContentMode>
            value={contentMode}
            onChange={(v) => setContentMode(v)}
            options={[
              { value: 'read', label: 'Read' },
              { value: 'recite', label: 'Recite' },
              { value: 'dictate', label: 'Dictate' },
            ]}
          />
        </div>

        {contentMode === 'read' ? (
        <>
        {/* 朗读播放器条 */}
        <div className="mt-5 rounded-2xl bg-white/85 border border-gray-100 shadow-sm px-4 py-3">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={goPrev}
                disabled={!canPrev}
                aria-label="Previous poem"
                title="Previous poem"
                className="w-9 h-9 rounded-full border border-gray-200 text-gray-600 hover:bg-violet-50 hover:text-violet-700 disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center transition-colors"
              >
                <SkipBack className="w-4 h-4" />
              </button>
              <button
                onClick={handleMainButton}
                disabled={support === 'no-api'}
                aria-label={isThisPoemActive && playStatus === 'playing' ? 'Pause' : 'Play'}
                title={
                  isThisPoemActive && playStatus === 'paused'
                    ? 'Resume reading'
                    : isThisPoemActive && playStatus === 'playing'
                      ? 'Pause'
                      : 'Read aloud'
                }
                className={`w-11 h-11 rounded-full flex items-center justify-center text-white shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                  isThisPoemActive && playStatus === 'playing'
                    ? 'bg-violet-500 hover:bg-violet-600'
                    : 'bg-gradient-to-r from-violet-600 to-purple-600 hover:opacity-90'
                }`}
              >
                {isThisPoemActive && playStatus === 'playing' ? (
                  <Pause className="w-5 h-5" />
                ) : (
                  <Play className="w-5 h-5 ml-0.5" />
                )}
              </button>
              <button
                onClick={goNext}
                disabled={!canNext}
                aria-label="Next poem"
                title="Next poem"
                className="w-9 h-9 rounded-full border border-gray-200 text-gray-600 hover:bg-violet-50 hover:text-violet-700 disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center transition-colors"
              >
                <SkipForward className="w-4 h-4" />
              </button>
              {isThisPoemActive && (
                <button
                  onClick={playerStop}
                  aria-label="Stop reading"
                  title="Stop"
                  className="w-9 h-9 rounded-full border border-gray-200 text-gray-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center transition-colors"
                >
                  <Square className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* 播放状态 */}
            <div className="flex-1 min-w-0 text-center sm:text-left text-sm">
              {support === 'checking' ? (
                <span className="text-gray-400">Checking speech support…</span>
              ) : support === 'no-api' ? (
                <span className="text-amber-600">当前浏览器不支持语音朗读</span>
              ) : support === 'no-voice' ? (
                <span className="text-amber-600">未找到可用的中文语音，请在系统里安装中文语音后再试</span>
              ) : nowReadingLabel ? (
                <span className="text-gray-600 truncate inline-flex items-center gap-1.5 max-w-full">
                  <span
                    className={`inline-block w-2 h-2 rounded-full ${
                      playStatus === 'playing'
                        ? 'bg-violet-500 animate-pulse'
                        : 'bg-amber-400'
                    }`}
                  />
                  <span className="truncate">{nowReadingLabel}</span>
                </span>
              ) : otherPlayingTitle ? (
                <span className="text-gray-400 truncate inline-flex items-center gap-1.5 max-w-full">
                  <span className="inline-block w-2 h-2 rounded-full bg-violet-500 animate-pulse shrink-0" />
                  <span className="truncate">正在播放「{otherPlayingTitle}」· 点击 ▶ 可切回本首</span>
                </span>
              ) : (
                <span className="text-gray-400 truncate">
                  {poem.title || 'Untitled'} · 点击 ▶ 逐行朗读
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => playerSetMode(playMode === 'single' ? 'list' : 'single')}
                aria-pressed={playMode === 'single'}
                title={playMode === 'single' ? '单曲循环：开' : '单曲循环：关'}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition-colors ${
                  playMode === 'single'
                    ? 'bg-violet-50 border-violet-200 text-violet-700'
                    : 'border-gray-200 text-gray-400 hover:text-gray-600'
                }`}
              >
                <Repeat1 className="w-3.5 h-3.5" /> 单曲循环
              </button>
              <button
                onClick={nextRate}
                title="Speech rate"
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-600 hover:border-violet-300 hover:text-violet-700 transition-colors"
              >
                {rate}×
              </button>
            </div>
          </div>
        </div>

        {/* 标题区 */}
        <div className="mt-8 text-center">
          <h1
            className={`text-3xl font-bold tracking-wide transition-colors ${
              readingTitleActive ? 'text-violet-700' : 'text-gray-800'
            }`}
          >
            {poem.title}
          </h1>
          {poem.author && (
            <p
              className={`mt-2 text-sm transition-colors ${
                readingAuthorActive ? 'text-violet-600 font-medium' : 'text-gray-500'
              }`}
            >
              —— {poem.author} ——
            </p>
          )}
        </div>

        {/* 内容区 */}
        <div className="mt-8 rounded-2xl bg-white/80 border border-gray-100 shadow-sm px-5 sm:px-8 py-8">
          {lines.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">
              <Quote className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              {lineEditingEnabled
                ? 'No body lines yet. Add the first line below.'
                : '本首暂无正文，可点击右上角 “Edit poem” 补充。'}
            </div>
          ) : (
            <div className="space-y-1">
              {lines.map((text, rowIndex) => {
                const isEmpty = text.trim() === ''
                const rowReading = readingLine === rowIndex && !isEditingRow(rowIndex)
                return (
                  <div
                    key={rowIndex}
                    ref={rowReading ? (el) => { activeRowRef.current = el } : undefined}
                    className={`group flex items-stretch gap-2 rounded-lg transition-colors ${
                      rowReading ? 'bg-violet-100/80 ring-1 ring-violet-300/70' : ''
                    }`}
                  >
                    {lineEditingEnabled ? (
                      <>
                        <span className="w-8 shrink-0 pt-3 text-right text-xs text-gray-300 select-none">
                          {rowIndex + 1}
                        </span>
                        {isEditingRow(rowIndex) ? (
                          <div className="flex-1 flex flex-col gap-2 py-1">
                            <textarea
                              autoFocus
                              rows={Math.max(1, Math.ceil((editing!.draft.length || 8) / 40))}
                              value={editing!.draft}
                              onChange={(e) => setEditing({ ...editing!, draft: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === 'Escape') setEditing(null)
                                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') saveEditing()
                              }}
                              className="w-full px-3 py-2 rounded-lg border border-violet-300 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500 text-[17px] resize-y leading-relaxed"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={saveEditing}
                                className="inline-flex items-center gap-1 px-3 py-1 rounded-md bg-violet-600 text-white text-xs font-medium hover:bg-violet-700 transition-colors"
                              >
                                <Save className="w-3.5 h-3.5" /> Save
                              </button>
                              <button
                                onClick={() => setEditing(null)}
                                className="inline-flex items-center gap-1 px-3 py-1 rounded-md text-gray-600 hover:bg-gray-100 text-xs font-medium transition-colors"
                              >
                                <X className="w-3.5 h-3.5" /> Cancel
                              </button>
                            </div>
                          </div>
                        ) : isEmpty ? (
                          <div className="flex-1 relative py-3">
                            <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-gray-200" />
                            <div className="relative flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => startInsertAfter(rowIndex)}
                                className="p-1 rounded-md bg-white shadow border border-gray-200 text-gray-400 hover:text-violet-600 hover:border-violet-300"
                                title="Insert line below"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => startEdit(rowIndex)}
                                className="p-1 rounded-md bg-white shadow border border-gray-200 text-gray-400 hover:text-violet-600 hover:border-violet-300"
                                title="Fill this blank line"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex-1 flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-violet-50/60 transition-colors">
                            <div className="flex-1 text-center">
                              <span
                                className="inline-block text-[19px] leading-loose text-gray-800 tracking-wide cursor-text select-text"
                                onClick={() => startEdit(rowIndex)}
                              >
                                {text}
                              </span>
                            </div>
                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => startInsertAfter(rowIndex)}
                                className="p-1.5 rounded-md text-gray-400 hover:text-violet-600 hover:bg-white"
                                title="Insert line below"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => startEdit(rowIndex)}
                                className="p-1.5 rounded-md text-gray-400 hover:text-violet-600 hover:bg-white"
                                title="Edit line"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              {deleteConfirmIndex === rowIndex ? (
                                <span className="flex items-center gap-1 text-xs text-red-700 px-1.5">
                                  Delete?
                                  <button
                                    onClick={() => {
                                      deletePoemLine(project.id, poem.id, rowIndex)
                                      setDeleteConfirmIndex(null)
                                    }}
                                    className="px-1.5 py-0.5 rounded bg-red-600 text-white text-[11px] hover:bg-red-700"
                                  >
                                    Yes
                                  </button>
                                  <button
                                    onClick={() => setDeleteConfirmIndex(null)}
                                    className="px-1.5 py-0.5 rounded text-red-700 text-[11px] hover:bg-red-100"
                                  >
                                    No
                                  </button>
                                </span>
                              ) : (
                                <button
                                  onClick={() => setDeleteConfirmIndex(rowIndex)}
                                  className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-white"
                                  title="Delete line"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      /* 纯净阅读模式：不显示行号与任何单行编辑操作 */
                      isEmpty ? (
                        <div className="flex-1 py-3" />
                      ) : (
                        <div className="flex-1 px-3 py-2.5">
                          <div className="text-center">
                            <span className="inline-block text-[19px] leading-loose text-gray-800 tracking-wide select-text">
                              {text}
                            </span>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {lineEditingEnabled && (
          <p className="mt-4 text-xs text-gray-400 text-center">
            Click any line to edit, or use “Edit poem” to rewrite the whole poem at once.
          </p>
        )}
        </>
        ) : contentMode === 'recite' ? (
          <div className="mt-5">
            <PoemRecitePanel projectId={project.id} poem={poem} />
          </div>
        ) : (
          <div className="mt-5">
            <PoemDictatePanel projectId={project.id} poem={poem} />
          </div>
        )}
      </div>

      {fullEditOpen && (
        <FullPoemEditor
          poem={poem}
          onClose={() => setFullEditOpen(false)}
          onSave={(meta, contentLines) => {
            updatePoemMeta(project.id, poem.id, meta)
            if (contentLines !== null) setPoemLines(project.id, poem.id, contentLines)
            setFullEditOpen(false)
          }}
        />
      )}
    </div>
  )
}

/* ------------------------------ 整首编辑弹窗 ------------------------------ */

interface FullPoemEditorProps {
  poem: Poem
  onClose: () => void
  onSave: (
    meta: { title: string; author?: string },
    lines: string[] | null,
  ) => void
}

function FullPoemEditor({ poem, onClose, onSave }: FullPoemEditorProps) {
  const [title, setTitle] = useState(poem.title)
  const [author, setAuthor] = useState(poem.author ?? '')
  const [content, setContent] = useState(poem.lines.join('\n'))

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-violet-600 to-purple-600 text-white">
          <h2 className="font-semibold flex items-center gap-2">
            <Pencil className="w-5 h-5" /> Edit poem
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-white/20 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. 静夜思"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Author <span className="text-gray-400">(optional)</span>
              </label>
              <input
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="e.g. 李白"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Body <span className="text-gray-400">(one line per row)</span>
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={12}
              placeholder={'床前明月光，\n疑是地上霜。\n举头望明月，\n低头思故乡。'}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-500 font-mono text-sm leading-relaxed resize-y"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() =>
              onSave(
                { title: title.trim() || '未命名', author: author.trim() || undefined },
                content.split('\n'),
              )
            }
            className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 text-white text-sm font-medium shadow hover:opacity-90 transition-opacity"
          >
            <Check className="w-4 h-4" /> Save changes
          </button>
        </div>
      </div>
    </div>
  )
}
