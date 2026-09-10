import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { VocabularyController } from './vocabulary.controller'
import { VocabularyList } from '../../entities/vocabulary-list.entity'
import { VocabularyWord } from '../../entities/vocabulary-word.entity'

@Module({
  imports: [TypeOrmModule.forFeature([VocabularyList, VocabularyWord])],
  controllers: [VocabularyController],
})
export class VocabularyModule {}
