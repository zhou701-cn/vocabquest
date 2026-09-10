import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AdminController } from './admin.controller'
import { VocabularyList } from '../../entities/vocabulary-list.entity'
import { VocabularyWord } from '../../entities/vocabulary-word.entity'

@Module({
  imports: [TypeOrmModule.forFeature([VocabularyList, VocabularyWord])],
  controllers: [AdminController],
})
export class AdminModule {}
