import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Put,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Not, Repository } from 'typeorm'
import { CurrentUser } from '../../common/current-user.decorator'
import { AuthUser } from '../../common/jwt-auth.guard'
import {
  Poem,
  PoemPracticeRecord,
  PoemProject,
} from '../../entities/poem.entity'

interface PoemInput {
  id: string
  title: string
  author?: string | null
  lines: string[]
}

interface ProjectSyncInput {
  name: string
  file_name?: string
  format?: string
  created_at?: string
  updated_at?: string
  poems: PoemInput[]
}

interface PracticeRecordInput {
  project_id?: string
  fingerprint?: string
  recite?: Record<string, any> | null
  dictate?: Record<string, any> | null
  updated_at?: string
}

@Controller('poems')
export class PoemsController {
  constructor(
    @InjectRepository(PoemProject)
    private readonly projects: Repository<PoemProject>,
    @InjectRepository(Poem)
    private readonly poems: Repository<Poem>,
    @InjectRepository(PoemPracticeRecord)
    private readonly practice: Repository<PoemPracticeRecord>,
  ) {}

  /** 拉取当前用户的诗词库（项目 + 诗词原始行，前端负责组装） */
  @Get('library')
  async getLibrary(@CurrentUser() user: AuthUser) {
    const [projects, poems] = await Promise.all([
      this.projects.find({
        where: { user_id: user.userId },
        order: { created_at: 'DESC' },
      }),
      this.poems.find({
        where: { user_id: user.userId },
        order: { sort_order: 'ASC' },
      }),
    ])
    return { projects, poems }
  }

  /** 整体同步一个项目：upsert 项目 → 逐首 upsert（保留原 id）→ 删除已移除的诗词 */
  @Put('projects/:id')
  async syncProject(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: ProjectSyncInput,
  ) {
    const existing = await this.projects.findOne({ where: { id } })
    if (existing && existing.user_id !== user.userId) {
      throw new NotFoundException('Project not found')
    }

    await this.projects.save(
      this.projects.create({
        id,
        user_id: user.userId,
        name: body.name,
        file_name: body.file_name ?? '',
        format: body.format ?? 'other',
        created_at: body.created_at ? new Date(body.created_at) : new Date(),
        updated_at: body.updated_at ? new Date(body.updated_at) : new Date(),
      }),
    )

    const poemInputs = body.poems ?? []
    if (poemInputs.length > 0) {
      await this.poems.save(
        poemInputs.map((p, idx) =>
          this.poems.create({
            id: p.id,
            project_id: id,
            user_id: user.userId,
            title: p.title,
            author: p.author ?? null,
            lines: p.lines,
            sort_order: idx,
            updated_at: new Date(),
          }),
        ),
      )
      await this.poems.delete({
        project_id: id,
        id: Not(In(poemInputs.map((p) => p.id))),
      })
    } else {
      await this.poems.delete({ project_id: id })
    }

    return { data: { success: true } }
  }

  @Delete('projects/:id')
  async deleteProject(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.projects.delete({ id, user_id: user.userId })
    return { data: { success: true } }
  }

  /** 拉取当前用户全部练习进度 */
  @Get('practice')
  async getPractice(@CurrentUser() user: AuthUser) {
    return this.practice.find({ where: { user_id: user.userId } })
  }

  /** 上传单条练习进度，按 (user_id, poem_id) upsert */
  @Put('practice/:poemId')
  async syncPractice(
    @CurrentUser() user: AuthUser,
    @Param('poemId') poemId: string,
    @Body() body: PracticeRecordInput,
  ) {
    const existing = await this.practice.findOne({
      where: { user_id: user.userId, poem_id: poemId },
    })

    const data: Partial<PoemPracticeRecord> = {
      user_id: user.userId,
      poem_id: poemId,
      project_id: body.project_id ?? null,
      fingerprint: body.fingerprint ?? '',
      recite: body.recite ?? null,
      dictate: body.dictate ?? null,
      updated_at: body.updated_at ? new Date(body.updated_at) : new Date(),
    }

    if (existing) {
      await this.practice.update(existing.id, data)
    } else {
      await this.practice.save(this.practice.create(data))
    }

    return { data: { success: true } }
  }
}
