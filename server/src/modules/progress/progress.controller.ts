import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { CurrentUser } from '../../common/current-user.decorator'
import { AuthUser } from '../../common/jwt-auth.guard'
import { ProgressService } from './progress.service'

@Controller('progress')
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  @Get()
  getUserProgress(@CurrentUser() user: AuthUser) {
    return this.progressService.getUserProgress(user.userId)
  }

  @Get('review-words')
  getWordsForReview(
    @CurrentUser() user: AuthUser,
    @Query('limit') limit?: string,
  ) {
    return this.progressService.getWordsForReview(
      user.userId,
      Number(limit) || 20,
    )
  }

  @Post('spaced-repetition')
  updateSpacedRepetition(
    @CurrentUser() user: AuthUser,
    @Body()
    body: {
      word_id: string
      is_correct: boolean
      response_time_seconds?: number
      learning_mode?: string
    },
  ) {
    return this.progressService.updateSpacedRepetition(user.userId, body)
  }
}
