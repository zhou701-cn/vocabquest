import { Body, Controller, Get, Patch, Post } from '@nestjs/common'
import { CurrentUser } from '../../common/current-user.decorator'
import { AuthUser } from '../../common/jwt-auth.guard'
import { UsersService } from './users.service'

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getProfile(@CurrentUser() user: AuthUser) {
    return this.usersService.getProfile(user.userId)
  }

  @Patch('me')
  updateProfile(
    @CurrentUser() user: AuthUser,
    @Body() updates: Record<string, any>,
  ) {
    return this.usersService.updateProfile(user.userId, updates)
  }

  @Post('initialize')
  initialize(
    @CurrentUser() user: AuthUser,
    @Body() profileData: Record<string, any>,
  ) {
    return this.usersService.initialize(user.userId, user.email, profileData)
  }
}
