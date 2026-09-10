import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { SessionsController } from './sessions.controller'
import { LearningSession } from '../../entities/learning-session.entity'

@Module({
  imports: [TypeOrmModule.forFeature([LearningSession])],
  controllers: [SessionsController],
})
export class SessionsModule {}
