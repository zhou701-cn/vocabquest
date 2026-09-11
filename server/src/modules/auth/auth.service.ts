import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import * as bcrypt from 'bcryptjs'
import { User } from '../../entities/user.entity'
import { UserGamification } from '../../entities/user-gamification.entity'

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(UserGamification)
    private readonly gamification: Repository<UserGamification>,
    private readonly jwt: JwtService,
  ) {}

  async register(email: string, password: string, fullName?: string) {
    const existing = await this.users.findOne({ where: { email } })
    if (existing) {
      throw new ConflictException('Email already registered')
    }

    // 第一个注册的用户自动成为 admin，便于初始化管理
    const userCount = await this.users.count()

    const user = await this.users.save(
      this.users.create({
        email,
        password_hash: await bcrypt.hash(password, 10),
        full_name: fullName?.trim() || 'Student User',
        role: userCount === 0 ? 'admin' : 'student',
        last_active: new Date(),
      }),
    )

    await this.createDefaultGamification(user.id)

    return this.buildAuthResponse(user)
  }

  async login(email: string, password: string) {
    const user = await this.users
      .createQueryBuilder('u')
      .addSelect('u.password_hash')
      .where('u.email = :email', { email })
      .getOne()

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      throw new UnauthorizedException('Invalid email or password')
    }

    if (!user.is_active) {
      throw new UnauthorizedException('Account is disabled')
    }

    await this.users.update(user.id, { last_active: new Date() })

    return this.buildAuthResponse(user)
  }

  async resetPassword(email: string, newPassword: string) {
    const user = await this.users.findOne({ where: { email } })
    if (user) {
      await this.users.update(user.id, {
        password_hash: await bcrypt.hash(newPassword, 10),
        updated_at: new Date(),
      })
    }
    // 无论邮箱是否存在都返回成功，避免被枚举
    return { message: '如果该邮箱已注册，密码已重置，请用新密码登录。' }
  }

  private async createDefaultGamification(userId: string) {
    const today = new Date().toISOString().split('T')[0]
    await this.gamification.save(
      this.gamification.create({
        user_id: userId,
        last_activity_date: today,
      }),
    )
  }

  private buildAuthResponse(user: User) {
    const token = this.jwt.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
    })
    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        created_at: user.created_at,
      },
    }
  }
}
