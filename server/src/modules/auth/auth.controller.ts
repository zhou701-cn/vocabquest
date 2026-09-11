import { BadRequestException, Body, Controller, Post } from '@nestjs/common'
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator'
import { Public } from '../../common/public.decorator'
import { AuthService } from './auth.service'

class RegisterDto {
  @IsEmail()
  email: string

  @IsString()
  @MinLength(6)
  password: string

  @IsOptional()
  @IsString()
  full_name?: string
}

class LoginDto {
  @IsEmail()
  email: string

  @IsString()
  password: string
}

class ResetPasswordDto {
  @IsEmail()
  email: string

  @IsString()
  @MinLength(6)
  newPassword: string

  @IsString()
  confirmPassword: string
}

@Public()
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto.email, dto.password, dto.full_name)
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password)
  }

  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('两次输入的密码不一致')
    }
    return this.authService.resetPassword(dto.email, dto.newPassword)
  }
}
