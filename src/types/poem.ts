/**
 * 诗歌（Poem）数据模型。
 *
 * 层级结构：项目（一次文件导入 / 或手动创建，名为文件名可改名）
 *           → 项目内拆分出的一首首诗词（题目 + 作者 + 正文行）
 *           → 单首诗词的内容页里才能对正文做增删改。
 */
export type PoemFileFormat = 'pdf' | 'docx' | 'txt' | 'md' | 'other'

/** 再次导入时的写入方式 */
export type PoemImportMode = 'append' | 'overwrite'

/** 一首诗词（入库形态） */
export interface Poem {
  id: string
  /** 题目 */
  title: string
  /** 作者 / 朝代（可选） */
  author?: string
  /** 正文行（不含题目与作者行）；空字符串可表示句间空行 */
  lines: string[]
}

/** 导入 / 创建时的诗词草稿（尚未分配 id） */
export interface PoemDraft {
  title: string
  author?: string
  lines: string[]
}

export interface PoemProject {
  id: string
  /** 项目名，默认取导入文件的文件名（不含扩展名），可自定义修改 */
  name: string
  /** 源文件名（含扩展名），用于展示与后续再次导入提示 */
  fileName: string
  format: PoemFileFormat
  /** 项目内拆分出的诗词列表 */
  poems: Poem[]
  createdAt: number
  updatedAt: number
}

/** 解析文件得到的导入草稿 */
export interface ParsedFileResult {
  text: string
  format: PoemFileFormat
  fileName: string
}
