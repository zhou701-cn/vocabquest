import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  ListMusic,
  Pause,
  Play,
  Quote,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Square,
} from 'lucide-react'
import {
  POEM_MODE_LABEL,
  POEM_RATE_STEPS,
  usePoemPlayerStore,
  type PoemPlayMode,
} from '@/stores/poemPlayerStore'

const MODE_META: Record<PoemPlayMode, { label: string; Icon: typeof ListMusic }> = {
  list: { label: POEM_MODE_LABEL.list, Icon: ListMusic },
  shuffle: { label: POEM_MODE_LABEL.shuffle, Icon: Shuffle },
  single: { label: POEM_MODE_LABEL.single, Icon: Repeat1 },
}

/**
 * 诗词悬浮播放器：整项目诗词队列的迷你控制条。
 * - 默认出现在视口下方居中，可按住左侧把手段拖动到任意位置；
 * - 拖动只由拖把区域触发，不影响条上按钮点击与页面滚动；
 * - 可收起成更小的胶囊，减少对页面内容的遮挡；
 * - 未开始任何播放（无队列会话）时不渲染，默认不自动播放。
 */
export function PoemFloatingPlayer({ show = true }: { show?: boolean }) {
  const navigate = useNavigate()

  const queueProjectId = usePoemPlayerStore((s) => s.queueProjectId)
  const queue = usePoemPlayerStore((s) => s.queue)
  const queueIndex = usePoemPlayerStore((s) => s.queueIndex)
  const mode = usePoemPlayerStore((s) => s.mode)
  const status = usePoemPlayerStore((s) => s.status)
  const rate = usePoemPlayerStore((s) => s.rate)
  const support = usePoemPlayerStore((s) => s.support)
  const playingPoemId = usePoemPlayerStore((s) => s.playingPoemId)

  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  const panelRef = useRef<HTMLDivElement | null>(null)
  const dragState = useRef<{ dx: number; dy: number } | null>(null)

  const currentPoem = useMemo(() => {
    if (queueIndex >= 0 && queueIndex < queue.length) return queue[queueIndex]
    return queue.find((p) => p.id === playingPoemId) ?? queue[0] ?? null
  }, [queue, queueIndex, playingPoemId])

  // 无队列会话（还没开始播放任何东西）就不展示
  if (!show || !queueProjectId || queue.length === 0 || !currentPoem) return null

  const idx = queue.findIndex((p) => p.id === currentPoem.id)
  const shownIndex = idx >= 0 ? idx : Math.max(queueIndex, 0)
  const total = queue.length
  const { label: modeLabel, Icon: ModeIcon } = MODE_META[mode]

  const isPlaying = status === 'playing'
  const canSpeak = support !== 'no-api' && support !== 'no-voice'

  const playToggle = () => {
    const st = usePoemPlayerStore.getState()
    if (st.status === 'playing') {
      st.pause()
      return
    }
    if (st.status === 'paused') {
      st.resume()
      return
    }
    // idle（例如列表播完停住）：从当前这首重新开始
    if (st.queueProjectId && currentPoem) st.playPoem(st.queueProjectId, currentPoem)
  }

  const goCurrentPoem = () => {
    if (!queueProjectId || !currentPoem) return
    navigate(`/poem/${queueProjectId}/${currentPoem.id}`)
  }

  const cycleRate = () => {
    const st = usePoemPlayerStore.getState()
    const cur = st.rate as (typeof POEM_RATE_STEPS)[number]
    const i = Math.max(0, POEM_RATE_STEPS.indexOf(cur))
    st.setRate(POEM_RATE_STEPS[(i + 1) % POEM_RATE_STEPS.length])
  }

  /* ---------- 拖动逻辑（只有拖把区域参与） ---------- */
  const startDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    const el = panelRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    dragState.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top }
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragging(true)
  }
  const onDragMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState.current) return
    const el = panelRef.current
    if (!el) return
    const w = el.offsetWidth
    const h = el.offsetHeight
    const left = Math.min(Math.max(4, e.clientX - dragState.current.dx), window.innerWidth - w - 4)
    const top = Math.min(Math.max(4, e.clientY - dragState.current.dy), window.innerHeight - h - 4)
    setPos({ left: Math.max(4, left), top: Math.max(4, top) })
  }
  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState.current) return
    dragState.current = null
    setDragging(false)
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }

  const iconBtnCls =
    'w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-gray-500 hover:text-violet-700 hover:bg-violet-50 transition-colors disabled:opacity-30 disabled:pointer-events-none'

  return (
    <div
      ref={panelRef}
      style={pos ? { left: pos.left, top: pos.top } : undefined}
      className={`fixed z-40 select-none ${
        pos ? '' : 'left-1/2 bottom-4 -translate-x-1/2'
      } ${collapsed ? 'w-auto' : 'w-[min(440px,96vw)]'} ${
        dragging ? 'scale-[1.02] opacity-95 ring-2 ring-violet-400/60' : ''
      } transition-[box-shadow,opacity] duration-150`}
    >
      <div
        className={`rounded-2xl bg-white/95 backdrop-blur border border-gray-200/80 shadow-xl ${
          dragging ? 'shadow-2xl' : ''
        } ${collapsed ? 'px-2 py-1.5' : 'px-2.5 py-2'}`}
      >
        {collapsed ? (
          /* ---------- 收起形态：极小胶囊 ---------- */
          <div className="flex items-center gap-1.5">
            <DragHandle onDown={startDrag} onMove={onDragMove} onUp={endDrag} dragging={dragging} />
            <button
              onClick={goCurrentPoem}
              title={currentPoem.title}
              className="flex items-center gap-2 min-w-0 flex-1 text-left"
            >
              <span className="w-7 h-7 shrink-0 rounded-lg bg-gradient-to-br from-violet-600 to-purple-600 text-white flex items-center justify-center">
                <Quote className="w-3.5 h-3.5" />
              </span>
              <span className="text-sm font-medium text-gray-800 truncate min-w-0">
                {currentPoem.title || '未命名'}
              </span>
            </button>
            <button
              onClick={playToggle}
              disabled={!canSpeak}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              className="w-8 h-8 shrink-0 rounded-full bg-gradient-to-r from-violet-600 to-purple-600 text-white flex items-center justify-center hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
            </button>
            <button
              onClick={() => setCollapsed(false)}
              className={iconBtnCls}
              title="展开播放条"
              aria-label="展开播放条"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
          </div>
        ) : (
          /* ---------- 完整形态 ---------- */
          <div className="flex items-center gap-1.5">
            <DragHandle onDown={startDrag} onMove={onDragMove} onUp={endDrag} dragging={dragging} />

            <button
              onClick={goCurrentPoem}
              title="查看当前诗词"
              className="flex items-center gap-2 min-w-0 flex-1 text-left group px-0.5"
            >
              <span className="w-9 h-9 shrink-0 rounded-xl bg-gradient-to-br from-violet-600 to-purple-600 text-white flex items-center justify-center shadow-sm">
                <Quote className="w-4 h-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-gray-800 truncate group-hover:text-violet-700 transition-colors">
                  {currentPoem.title || '未命名'}
                </span>
                <span className="block text-[11px] text-gray-400 truncate leading-4">
                  {currentPoem.author ? `〔${currentPoem.author}〕 ` : ''}
                  {shownIndex + 1}/{total} · {modeLabel}
                  {status === 'paused' ? ' · 已暂停' : status === 'idle' ? ' · 待播放' : ''}
                </span>
              </span>
            </button>

            <div className="flex items-center gap-0.5 shrink-0">
              <button
                onClick={() => usePoemPlayerStore.getState().playPrev()}
                disabled={total < 2}
                className={iconBtnCls}
                aria-label="上一首"
                title="上一首"
              >
                <SkipBack className="w-4 h-4" />
              </button>
              <button
                onClick={playToggle}
                disabled={!canSpeak}
                aria-label={isPlaying ? 'Pause' : 'Play'}
                title={isPlaying ? '暂停' : status === 'paused' ? '继续' : '播放'}
                className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-white shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                  isPlaying
                    ? 'bg-violet-500 hover:bg-violet-600'
                    : 'bg-gradient-to-r from-violet-600 to-purple-600 hover:opacity-90'
                }`}
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
              </button>
              <button
                onClick={() => usePoemPlayerStore.getState().playNext()}
                disabled={total < 2}
                className={iconBtnCls}
                aria-label="下一首"
                title="下一首"
              >
                <SkipForward className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-0.5 shrink-0 border-l border-gray-100 pl-1.5 ml-0.5">
              <button
                onClick={() => usePoemPlayerStore.getState().cycleMode()}
                aria-label={`当前播放模式：${modeLabel}，点击切换`}
                title={`播放模式：${modeLabel}（点击切换）`}
                className={`px-1.5 py-1 rounded-lg flex flex-col items-center justify-center transition-colors ${
                  mode === 'single' || mode === 'shuffle'
                    ? 'text-violet-600 hover:bg-violet-50'
                    : 'text-gray-400 hover:text-violet-600 hover:bg-violet-50'
                }`}
              >
                <ModeIcon className="w-4 h-4" />
                <span className="text-[9px] leading-none mt-0.5">
                  {mode === 'single' ? '单曲' : mode === 'shuffle' ? '随机' : '列表'}
                </span>
              </button>
              <button
                onClick={cycleRate}
                title="语速"
                className={`px-1.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                  rate !== 1 ? 'text-violet-600 bg-violet-50' : 'text-gray-400 hover:text-violet-600'
                }`}
              >
                {rate}×
              </button>
              <button
                onClick={() => usePoemPlayerStore.getState().stop()}
                className={iconBtnCls}
                aria-label="停止并清空"
                title="停止并清空"
              >
                <Square className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setCollapsed(true)}
                className={iconBtnCls}
                aria-label="收起"
                title="收起（减少遮挡）"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ------------------------------ 拖把区域 ------------------------------ */

function DragHandle({
  onDown,
  onMove,
  onUp,
  dragging,
}: {
  onDown: (e: React.PointerEvent<HTMLDivElement>) => void
  onMove: (e: React.PointerEvent<HTMLDivElement>) => void
  onUp: (e: React.PointerEvent<HTMLDivElement>) => void
  dragging: boolean
}) {
  return (
    <div
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      title="按住拖动"
      aria-label="按住拖动播放器"
      className={`shrink-0 self-stretch flex items-center px-0.5 rounded-lg touch-none cursor-grab active:cursor-grabbing ${
        dragging ? 'bg-violet-100' : 'hover:bg-gray-100'
      } transition-colors`}
    >
      <GripVertical className={`w-4 h-4 ${dragging ? 'text-violet-600' : 'text-gray-300'}`} />
    </div>
  )
}
