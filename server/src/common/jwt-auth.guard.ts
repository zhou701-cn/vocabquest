import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import { IS_PUBLIC_KEY } from './public.decorator'

export interface AuthUser {
  userId: string
  email: string
  role: string
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) return true

    const request = context.switchToHttp().getRequest()
    const authHeader: string = request.headers['authorization'] || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!token) {
      throw new UnauthorizedException('Missing authorization token')
    }

    try {
      const payload = await this.jwtService.verifyAsync(token)
      request.user = {
        userId: payload.sub,
        email: payload.email,
        role: payload.role,
      } as AuthUser
      return true
    } catch {
      throw new UnauthorizedException('Invalid or expired token')
    }
  }
}
