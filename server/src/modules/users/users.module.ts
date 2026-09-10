import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { UsersController } from './users.controller'
import { UsersService } from './users.service'
import { User } from '../../entities/user.entity'
import { UserGamification } from '../../entities/user-gamification.entity'
import { UserWordList } from '../../entities/user-word-list.entity'
import { VocabularyList } from '../../entities/vocabulary-list.entity'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      UserGamification,
      UserWordList,
      VocabularyList,
    ]),
  ],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
