import { BadRequestException, Injectable } from '@nestjs/common'
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm'
import { DataSource, Repository } from 'typeorm'
import { UserProgress } from '../../entities/user-progress.entity'
import { UserGamification } from '../../entities/user-gamification.entity'
import { ActivityLog } from '../../entities/activity-log.entity'

interface SpacedRepetitionInput {
  word_id: string
  is_correct: boolean
  response_time_seconds?: number
  learning_mode?: string
}

@Injectable()
export class ProgressService {
  constructor(
    @InjectRepository(UserProgress)
    private readonly progress: Repository<UserProgress>,
    @InjectRepository(UserGamification)
    private readonly gamification: Repository<UserGamification>,
    @InjectRepository(ActivityLog)
    private readonly activityLog: Repository<ActivityLog>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  getUserProgress(userId: string) {
    return this.progress.find({ where: { user_id: userId } })
  }

  /** 调用数据库 SQL 函数 get_words_for_review */
  async getWordsForReview(userId: string, limit: number) {
    return this.dataSource.query(
      'SELECT * FROM get_words_for_review($1, $2)',
      [userId, limit],
    )
  }

  /**
   * 儿童优化版 SM-2 间隔重复算法（移植自原 spaced-repetition Edge Function）。
   * 间隔压缩到成人版的 60-70%，interval 以“小时”为单位存储在 interval_days 字段。
   */
  async updateSpacedRepetition(userId: string, input: SpacedRepetitionInput) {
    const { word_id, is_correct, response_time_seconds, learning_mode } = input
    if (!word_id || is_correct === undefined) {
      throw new BadRequestException('word_id and is_correct are required')
    }

    const current = await this.progress.findOne({
      where: { user_id: userId, word_id },
    })

    const now = new Date()
    let newLevel: number
    let newEaseFactor: number
    let newInterval: number

    const consecutiveCorrect = is_correct
      ? (current?.consecutive_correct ?? 0) + 1
      : 0
    const totalAttempts = (current?.total_attempts ?? 0) + 1
    const totalCorrect = (current?.total_correct ?? 0) + (is_correct ? 1 : 0)
    const firstLearned = current?.first_learned ?? now
    const successRate = (totalCorrect / totalAttempts) * 100

    if (is_correct) {
      if (!current) {
        newLevel = 1
        newEaseFactor = 2.5
        newInterval = 1 // 1 小时
      } else {
        const currentLevel = current.current_level || 0
        const currentEase = Number(current.ease_factor) || 2.5

        newLevel = currentLevel + 1

        let easeAdjustment = 0
        if (response_time_seconds) {
          if (response_time_seconds < 3) easeAdjustment = 0.1
          else if (response_time_seconds > 10) easeAdjustment = -0.1
        }
        newEaseFactor = Math.max(1.3, Math.min(3.0, currentEase + easeAdjustment))

        if (newLevel === 1) {
          newInterval = 6 // 6 小时
        } else if (newLevel === 2) {
          newInterval = 24 // 1 天
        } else {
          const baseInterval = Math.round(
            Number(current.interval_days) * newEaseFactor * 0.65,
          )
          newInterval = Math.min(baseInterval, 720) // 最多 30 天
        }
      }
    } else {
      newLevel = Math.max(0, (current?.current_level ?? 0) - 1)
      newEaseFactor = Math.max(1.3, Number(current?.ease_factor ?? 2.5) - 0.2)
      newInterval = 1 // 1 小时后重试
    }

    const nextReview = new Date(now.getTime() + newInterval * 60 * 60 * 1000)
    const isLearned =
      (newLevel >= 2 && successRate >= 80) || (newLevel === 1 && is_correct)

    const progressData: Partial<UserProgress> = {
      user_id: userId,
      word_id,
      current_level: newLevel,
      ease_factor: newEaseFactor,
      interval_days: newInterval,
      last_reviewed: now,
      next_review: nextReview,
      consecutive_correct: consecutiveCorrect,
      total_attempts: totalAttempts,
      total_correct: totalCorrect,
      success_rate: successRate,
      first_learned: firstLearned,
      is_learned: isLearned,
      updated_at: now,
    }

    if (current) {
      await this.progress.update(current.id, progressData)
    } else {
      await this.progress.save(this.progress.create(progressData))
    }

    // 积分计算
    let pointsEarned = 0
    if (is_correct) {
      pointsEarned = 10
      if (consecutiveCorrect >= 5) pointsEarned += 5
      if (response_time_seconds && response_time_seconds < 5) pointsEarned += 5
      if (newLevel === 1) pointsEarned += 10
      if (isLearned && !current?.is_learned) pointsEarned += 25
    }

    // 记录活动日志
    await this.activityLog.save(
      this.activityLog.create({
        user_id: userId,
        activity_type: `${learning_mode || 'review'}_attempt`,
        activity_data: {
          word_id,
          is_correct,
          response_time_seconds,
          points_earned: pointsEarned,
          new_level: newLevel,
          success_rate: successRate,
        },
        points_earned: pointsEarned,
      }),
    )

    // 更新游戏化数据
    if (pointsEarned > 0) {
      const gam = await this.gamification.findOne({
        where: { user_id: userId },
      })
      if (gam) {
        await this.gamification.update(gam.id, {
          total_points: gam.total_points + pointsEarned,
          current_xp: gam.current_xp + pointsEarned,
          words_learned:
            isLearned && !current?.is_learned
              ? gam.words_learned + 1
              : gam.words_learned,
          updated_at: new Date(),
        })
      }
    }

    return {
      data: {
        message: 'Progress updated successfully',
        progress: {
          current_level: newLevel,
          next_review: nextReview.toISOString(),
          interval_hours: newInterval,
          success_rate: successRate,
          is_learned: isLearned,
          consecutive_correct: consecutiveCorrect,
        },
        points_earned: pointsEarned,
      },
    }
  }
}
