import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { CurrentUser } from '../../common/current-user.decorator'
import { AuthUser } from '../../common/jwt-auth.guard'
import { LearningSession } from '../../entities/learning-session.entity'

@Controller('sessions')
export class SessionsController {
  constructor(
    @InjectRepository(LearningSession)
    private readonly sessions: Repository<LearningSession>,
  ) {}

  @Post()
  async createSession(
    @CurrentUser() user: AuthUser,
    @Body() body: Partial<LearningSession>,
  ) {
    const session = await this.sessions.save(
      this.sessions.create({
        ...body,
        user_id: user.userId,
        metadata: body.metadata ?? {},
      }),
    )
    return { data: session }
  }

  /** 今日已完成会话数（按模式过滤） */
  @Get('today-count')
  async getTodayCount(
    @CurrentUser() user: AuthUser,
    @Query('mode') mode?: string,
  ) {
    const qb = this.sessions
      .createQueryBuilder('s')
      .where('s.user_id = :userId', { userId: user.userId })
      .andWhere('s.session_start >= :today', {
        today: new Date().toISOString().split('T')[0] + 'T00:00:00Z',
      })
      .andWhere('s.is_completed = true')

    if (mode) {
      qb.andWhere('s.mode = :mode', { mode })
    }

    const count = await qb.getCount()
    return { count }
  }
}
