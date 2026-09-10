import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { User } from '../../entities/user.entity'
import { UserGamification } from '../../entities/user-gamification.entity'
import { UserWordList } from '../../entities/user-word-list.entity'
import { VocabularyList } from '../../entities/vocabulary-list.entity'

/** 允许前端更新的字段白名单 */
const UPDATABLE_FIELDS = [
  'full_name',
  'grade_level',
  'date_of_birth',
  'parent_email',
  'preferences',
]

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(UserGamification)
    private readonly gamification: Repository<UserGamification>,
    @InjectRepository(UserWordList)
    private readonly userWordLists: Repository<UserWordList>,
    @InjectRepository(VocabularyList)
    private readonly vocabularyLists: Repository<VocabularyList>,
  ) {}

  async getProfile(userId: string) {
    const profile = await this.users.findOne({ where: { id: userId } })
    const gamification = await this.gamification.findOne({
      where: { user_id: userId },
    })

    return {
      data: {
        profile,
        gamification,
        needs_initialization: !profile || !gamification,
      },
    }
  }

  async updateProfile(userId: string, updates: Record<string, any>) {
    const safeUpdates: Record<string, any> = {}
    for (const key of UPDATABLE_FIELDS) {
      if (updates[key] !== undefined) safeUpdates[key] = updates[key]
    }
    safeUpdates.updated_at = new Date()

    await this.users.update(userId, safeUpdates)
    const profile = await this.users.findOne({ where: { id: userId } })
    if (!profile) throw new NotFoundException('User not found')

    return { data: profile }
  }

  async initialize(
    userId: string,
    email: string,
    profileData: Record<string, any>,
  ) {
    const existing = await this.users.findOne({ where: { id: userId } })
    if (existing) {
      return {
        data: { message: 'User already initialized', is_new_user: false },
      }
    }

    // 正常情况下注册用户已存在；此接口兜底处理“有 token 但无资料”的异常状态
    const profile = await this.users.save(
      this.users.create({
        id: userId,
        email,
        password_hash: '',
        full_name: profileData.full_name ?? 'Student User',
        role: profileData.role ?? 'student',
        grade_level: profileData.grade_level ?? 4,
        date_of_birth: profileData.date_of_birth ?? null,
        parent_email: profileData.parent_email ?? null,
        preferences: profileData.preferences ?? {},
        last_active: new Date(),
      }),
    )

    const today = new Date().toISOString().split('T')[0]
    await this.gamification.save(
      this.gamification.create({
        user_id: userId,
        last_activity_date: today,
      }),
    )

    // 学生自动分配默认词库
    if (profile.role === 'student') {
      const defaultList = await this.vocabularyLists.findOne({
        where: { is_default: true, is_active: true },
      })
      if (defaultList) {
        await this.userWordLists.save(
          this.userWordLists.create({
            user_id: userId,
            list_id: defaultList.id,
          }),
        )
      }
    }

    return {
      data: {
        message: 'User initialized successfully',
        profile,
        is_new_user: true,
      },
    }
  }
}
