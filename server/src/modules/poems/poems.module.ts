import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { PoemsController } from './poems.controller'
import {
  Poem,
  PoemPracticeRecord,
  PoemProject,
} from '../../entities/poem.entity'

@Module({
  imports: [TypeOrmModule.forFeature([PoemProject, Poem, PoemPracticeRecord])],
  controllers: [PoemsController],
})
export class PoemsModule {}
