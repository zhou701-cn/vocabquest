import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowRight,
  BookOpen,
  Check,
  FileText,
  FileUp,
  Home,
  Pause,
  Pencil,
  Play,
  Quote,
  Trash2,
  X,
} from 'lucide-react'
import type { PoemProject } from '@/types/poem'
import { usePoemStore } from '@/stores/poemStore'
import { usePoemPlayerStore } from '@/stores/poemPlayerStore'
import {
  PoemImportDialog,
  PoemImportConfirmData,
} from '@/components/poem/PoemImportDialog'
import { PoemProjectDetail } from '@/components/poem/PoemProjectDetail'
import { PoemContentView } from '@/components/poem/PoemContentView'
import { PoemFloatingPlayer } from '@/components/poem/PoemFloatingPlayer'

const FORMAT_STYLE: Record<PoemProject['format'], string> = {
  pdf: 'bg-red-100 text-red-700',
  docx: 'bg-blue-100 text-blue-700',
  txt: 'bg-gray-200 text-gray-600',
  md: 'bg-teal-100 text-teal-700',
  other: 'bg-gray-200 text-gray-600',
}

const FORMAT_LABEL: Record<PoemProject['format'], string> = {
  pdf: 'PDF',
  docx: 'Word',
  txt: 'Text',
  md: 'Markdown',
  other: 'File',
}

export function PoemPage() {
  const { projectId, poemId } = useParams()
  const navigate = useNavigate()
  const project = usePoemStore((s) => s.projects.find((p) => p.id === projectId))
  const projectPoems = project?.poems ?? []

  let view: ReactNode

  // 三级：单首诗词内容页（自带顶部朗读条，悬浮播放器此处隐藏避免重复）
  if (projectId && poemId) {
    if (!project) {
      view = <MissingBack title="This project does not exist or was deleted." to="/poem" />
    } else {
      const poem = projectPoems.find((p) => p.id === poemId)
      if (!poem) {
        view = (
          <MissingBack
            title="This poem does not exist or was deleted."
            to={`/poem/${project.id}`}
          />
        )
      } else {
        view = (
          <PoemContentView
            key={poem.id}
            project={project}
            poem={poem}
            onBack={() => navigate(`/poem/${project.id}`)}
            onSelectPoem={(pid) => navigate(`/poem/${project.id}/${pid}`)}
          />
        )
      }
    }
  } else if (projectId) {
    // 二级：项目内诗词列表
    if (!project) {
      view = <MissingBack title="This project does not exist or was deleted." to="/poem" />
    } else {
      view = <PoemProjectDetail key={project.id} project={project} onBack={() => navigate('/poem')} />
    }
  } else {
    view = <PoemProjectList />
  }

  return (
    <>
      {view}
      {/* 悬浮可拖动播放器：单首详情页不重复展示 */}
      <PoemFloatingPlayer show={!(projectId && poemId)} />
    </>
  )
}

/* ------------------------------ 缺失提示 ------------------------------ */

function MissingBack({ title, to }: { title: string; to: string }) {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-purple-50 flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-500 mb-4">{title}</p>
        <button
          onClick={() => navigate(to)}
          className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 transition-colors"
        >
          Go back
        </button>
      </div>
    </div>
  )
}

/* ------------------------------ 项目列表视图 ------------------------------ */

function PoemProjectList() {
  const navigate = useNavigate()
  const projects = usePoemStore((s) => s.projects)
  const createProject = usePoemStore((s) => s.createProject)
  const renameProject = usePoemStore((s) => s.renameProject)
  const deleteProject = usePoemStore((s) => s.deleteProject)

  const queueProjectId = usePoemPlayerStore((s) => s.queueProjectId)
  const playingProjectId = usePoemPlayerStore((s) => s.playingProjectId)
  const playerStatus = usePoemPlayerStore((s) => s.status)
  const playerPlayProject = usePoemPlayerStore((s) => s.playProject)
  const playerPause = usePoemPlayerStore((s) => s.pause)
  const playerResume = usePoemPlayerStore((s) => s.resume)

  const [importOpen, setImportOpen] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  const sorted = useMemo(
    () =>
      [...projects].sort((a, b) => {
        if (a.updatedAt !== b.updatedAt) return b.updatedAt - a.updatedAt
        return b.createdAt - a.createdAt
      }),
    [projects],
  )

  const handleCreate = (data: PoemImportConfirmData) => {
    const project = createProject({
      name: data.name,
      fileName: data.fileName,
      format: data.format,
      poems: data.poems,
    })
    navigate(`/poem/${project.id}`)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-purple-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* 顶栏 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-800 leading-tight">Poem Projects</h1>
              <p className="text-xs text-gray-500">Import poems from PDF / Word / text files</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/index')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-white transition-colors text-sm font-medium"
            >
              <Home className="w-4 h-4" />
              Home
            </button>
            <button
              onClick={() => setImportOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 text-white text-sm font-semibold shadow hover:opacity-90 transition-opacity"
            >
              <FileUp className="w-4 h-4" />
              Import New Poem
            </button>
          </div>
        </div>

        {/* 项目列表 */}
        {sorted.length === 0 ? (
          <div className="mt-16 text-center">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-violet-100 flex items-center justify-center">
              <Quote className="w-8 h-8 text-violet-500" />
            </div>
            <h2 className="mt-4 text-xl font-semibold text-gray-700">No poem projects yet</h2>
            <p className="mt-1 text-gray-500 text-sm max-w-md mx-auto">
              Import a PDF / Word file to create a project. Every poem in the file is split into its
              own entry with title — tap an entry to view &amp; edit its content.
            </p>
            <button
              onClick={() => setImportOpen(true)}
              className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-medium shadow hover:opacity-90 transition-opacity"
            >
              <FileUp className="w-4 h-4" />
              Import your first poem
            </button>
          </div>
        ) : (
          <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sorted.map((project) => {
              const isRenaming = renamingId === project.id
              const projectPoems = project.poems ?? []
              const poemTitles = projectPoems
                .slice(0, 3)
                .map((p) => p.title)
                .filter(Boolean)
              const charCount = projectPoems.reduce(
                (acc, p) =>
                  acc + p.lines.reduce((n, l) => n + l.length, 0) + p.title.length,
                0,
              )
              return (
                <div
                  key={project.id}
                  onClick={() => navigate(`/poem/${project.id}`)}
                  className="group relative flex flex-col p-5 rounded-2xl bg-white/80 border border-gray-100 shadow-sm hover:shadow-lg hover:border-violet-200 transition-all cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      {isRenaming ? (
                        <div className="flex items-center gap-1">
                          <input
                            autoFocus
                            value={draftName}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => setDraftName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                renameProject(project.id, draftName)
                                setRenamingId(null)
                              }
                              if (e.key === 'Escape') setRenamingId(null)
                            }}
                            className="w-full px-2 py-1 rounded-md border border-violet-300 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                          />
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              renameProject(project.id, draftName)
                              setRenamingId(null)
                            }}
                            className="p-1 shrink-0 rounded-md bg-violet-600 text-white hover:bg-violet-700"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setRenamingId(null)
                            }}
                            className="p-1 shrink-0 rounded-md text-gray-400 hover:bg-gray-100"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <h3 className="font-semibold text-gray-800 truncate group-hover:text-violet-700 transition-colors">
                          {project.name}
                        </h3>
                      )}
                    </div>
                    {!isRenaming && (
                      <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setDraftName(project.name)
                            setRenamingId(project.id)
                          }}
                          className="p-1.5 rounded-md text-gray-400 hover:text-violet-600 hover:bg-violet-50"
                          title="Rename"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        {deleteConfirmId === project.id ? (
                          <span className="flex items-center gap-1 px-1 text-[11px] text-red-700">
                            Delete?
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                const player = usePoemPlayerStore.getState()
                                if (player.playingProjectId === project.id) player.stop()
                                deleteProject(project.id)
                                setDeleteConfirmId(null)
                              }}
                              className="px-1.5 py-0.5 rounded bg-red-600 text-white hover:bg-red-700"
                            >
                              Yes
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setDeleteConfirmId(null)
                              }}
                              className="px-1.5 py-0.5 rounded text-red-700 hover:bg-red-100"
                            >
                              No
                            </button>
                          </span>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setDeleteConfirmId(project.id)
                            }}
                            className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <p className="mt-2 text-xs text-gray-500 flex items-center gap-1 truncate">
                    <FileText className="w-3.5 h-3.5 shrink-0" />
                    {project.fileName}
                  </p>

                  {poemTitles.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {poemTitles.map((t, i) => (
                        <span
                          key={i}
                          className="px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 text-[11px]"
                        >
                          {t}
                        </span>
                      ))}
                      {projectPoems.length > 3 && (
                        <span className="text-[11px] text-gray-400 leading-5">
                          +{projectPoems.length - 3} more
                        </span>
                      )}
                    </div>
                  )}

                  <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs">
                      <span
                        className={`px-2 py-0.5 rounded-full font-medium ${FORMAT_STYLE[project.format]}`}
                      >
                        {FORMAT_LABEL[project.format]}
                      </span>
                      <span className="text-gray-500">
                        {projectPoems.length} poem{projectPoems.length === 1 ? '' : 's'} ·{' '}
                        {charCount.toLocaleString()} chars
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {projectPoems.length > 0 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            const active =
                              queueProjectId === project.id &&
                              playingProjectId === project.id &&
                              playerStatus !== 'idle'
                            if (active && playerStatus === 'playing') playerPause()
                            else if (active && playerStatus === 'paused') playerResume()
                            else playerPlayProject(project.id, 0, 'list')
                          }}
                          aria-label="Play all poems in this project"
                          title="Play all poems in this project"
                          className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-white shadow transition-all ${
                            queueProjectId === project.id &&
                            playingProjectId === project.id &&
                            playerStatus === 'playing'
                              ? 'bg-violet-500 hover:bg-violet-600'
                              : 'bg-gradient-to-r from-violet-600 to-purple-600 hover:opacity-90'
                          }`}
                        >
                          {queueProjectId === project.id &&
                          playingProjectId === project.id &&
                          playerStatus === 'playing' ? (
                            <Pause className="w-3.5 h-3.5" />
                          ) : (
                            <Play className="w-3.5 h-3.5 ml-px" />
                          )}
                        </button>
                      )}
                      <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-violet-500 group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 新建导入对话框 */}
      <PoemImportDialog
        open={importOpen}
        variant="create"
        onClose={() => setImportOpen(false)}
        onConfirm={handleCreate}
      />
    </div>
  )
}
