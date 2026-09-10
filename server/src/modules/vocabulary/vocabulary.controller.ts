import { Controller, Get, Param } from '@nestjs/common'
import { Public } from '../../common/public.decorator'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { VocabularyList } from '../../entities/vocabulary-list.entity'
import { VocabularyWord } from '../../entities/vocabulary-word.entity'

@Controller('vocabulary')
export class VocabularyController {
  constructor(
    @InjectRepository(VocabularyList)
    private readonly lists: Repository<VocabularyList>,
    @InjectRepository(VocabularyWord)
    private readonly words: Repository<VocabularyWord>,
  ) {}

  // 词库为只读公开数据（与原 Supabase anon 可读行为一致，
  // 保证本地一键登录的 demo 会话也能正常使用）
  @Public()
  @Get('lists')
  getLists() {
    return this.lists.find({
      where: { is_active: true },
      order: { is_default: 'DESC', created_at: 'DESC' },
    })
  }

  @Public()
  @Get('lists/:listId/words')
  getWords(@Param('listId') listId: string) {
    return this.words.find({
      where: { list_id: listId },
      order: { sort_order: 'ASC' },
    })
  }
}
