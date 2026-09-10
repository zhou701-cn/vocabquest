import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ProgressController } from './progress.controller'
import { ProgressService } from './progress.service'
import { UserProgress } from '../../entities/user-progress.entity'
import { UserGamification } from '../../entities/user-gamification.entity'
import { ActivityLog } from '../../entities/activity-log.entity'

@Module({
  imports: [
    TypeOrmModule.forFeature([UserProgress, UserGamification, ActivityLog]),
  ],
  controllers: [ProgressController],
  providers: [ProgressService],
})
export class ProgressModule {}
