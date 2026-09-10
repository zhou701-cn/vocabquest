import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  NotFoundException,
  Post,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { CurrentUser } from '../../common/current-user.decorator'
import { AuthUser } from '../../common/jwt-auth.guard'
import { VocabularyList } from '../../entities/vocabulary-list.entity'
import { VocabularyWord } from '../../entities/vocabulary-word.entity'

interface WordManagerRequest {
  action:
    | 'get_words'
    | 'search_words'
    | 'add_word'
    | 'update_word'
    | 'delete_word'
    | 'bulk_import'
  data: Record<string, any>
}

/** 单词可写字段白名单 */
const WORD_FIELDS = [
  'word',
  'part_of_speech',
  'definition',
  'simple_definition',
  'example_sentence',
  'example_context',
  'synonyms',
  'antonyms',
  'difficulty_level',
  'frequency_score',
  'ssat_importance',
  'audio_url',
  'image_url',
  'pronunciation_guide',
  'etymology',
  'related_words',
  'usage_notes',
  'sort_order',
]

function pickWordFields(input: Record<string, any>) {
  const out: Record<string, any> = {}
  for (const key of WORD_FIELDS) {
    if (input[key] !== undefined) out[key] = input[key]
  }
  return out
}

@Controller('admin')
export class AdminController {
  constructor(
    @InjectRepository(VocabularyList)
    private readonly lists: Repository<VocabularyList>,
    @InjectRepository(VocabularyWord)
    private readonly words: Repository<VocabularyWord>,
  ) {}

  /**
   * 管理端单词管理，沿用原 admin-word-manager Edge Function 的
   * { action, data } 契约，前端只需改调用地址。
   */
  @Post('word-manager')
  async wordManager(
    @CurrentUser() user: AuthUser,
    @Body() body: WordManagerRequest,
  ) {
    if (user.role !== 'admin') {
      throw new ForbiddenException('Admin role required')
    }

    const { action, data } = body

    switch (action) {
      case 'get_words':
        return this.getWords(data)
      case 'search_words':
        return this.searchWords(data)
      case 'add_word':
        return this.addWord(data)
      case 'update_word':
        return this.updateWord(data)
      case 'delete_word':
        return this.deleteWord(data)
      case 'bulk_import':
        return this.bulkImport(data)
      default:
        throw new BadRequestException(`Unknown action: ${action}`)
    }
  }

  private async getWords(data: Record<string, any>) {
    const limit = Math.min(Number(data.limit) || 100, 10000)
    const offset = Number(data.offset) || 0
    const sortBy = ['word', 'sort_order', 'created_at', 'difficulty_level'].includes(
      data.sort_by,
    )
      ? data.sort_by
      : 'sort_order'
    const sortOrder = data.sort_order === 'desc' ? 'DESC' : 'ASC'

    const [words, total] = await this.words.findAndCount({
      where: data.list_id ? { list_id: data.list_id } : {},
      order: { [sortBy]: sortOrder },
      take: limit,
      skip: offset,
    })

    return { data: { words, total } }
  }

  private async searchWords(data: Record<string, any>) {
    const query = `%${(data.query || '').replace(/[%_]/g, '')}%`
    const limit = Math.min(Number(data.limit) || 100, 1000)

    const qb = this.words
      .createQueryBuilder('w')
      .where('(w.word ILIKE :query OR w.definition ILIKE :query)', { query })
      .orderBy('w.word', 'ASC')
      .take(limit)

    if (data.list_id) {
      qb.andWhere('w.list_id = :listId', { listId: data.list_id })
    }

    const words = await qb.getMany()
    return { data: { words, total: words.length } }
  }

  private async addWord(data: Record<string, any>) {
    if (!data.list_id || !data.word_data?.word) {
      throw new BadRequestException('list_id and word_data.word are required')
    }

    const maxSort = await this.words
      .createQueryBuilder('w')
      .select('MAX(w.sort_order)', 'max')
      .where('w.list_id = :listId', { listId: data.list_id })
      .getRawOne()

    const word = await this.words.save(
      this.words.create({
        ...pickWordFields(data.word_data),
        list_id: data.list_id,
        sort_order: (Number(maxSort?.max) || 0) + 1,
      }),
    )

    await this.refreshWordCount(data.list_id)
    return { data: { word, success: true } }
  }

  private async updateWord(data: Record<string, any>) {
    if (!data.word_id) {
      throw new BadRequestException('word_id is required')
    }

    const word = await this.words.findOne({ where: { id: data.word_id } })
    if (!word) throw new NotFoundException('Word not found')

    await this.words.update(word.id, {
      ...pickWordFields(data.word_data ?? {}),
      updated_at: new Date(),
    })

    const updated = await this.words.findOne({ where: { id: word.id } })
    return { data: { word: updated, success: true } }
  }

  private async deleteWord(data: Record<string, any>) {
    if (!data.word_id) {
      throw new BadRequestException('word_id is required')
    }

    const word = await this.words.findOne({ where: { id: data.word_id } })
    await this.words.delete(data.word_id)

    if (word) {
      await this.refreshWordCount(word.list_id)
    }
    return { data: { success: true } }
  }

  private async bulkImport(data: Record<string, any>) {
    if (!data.list_id || !Array.isArray(data.words)) {
      throw new BadRequestException('list_id and words array are required')
    }

    const maxSort = await this.words
      .createQueryBuilder('w')
      .select('MAX(w.sort_order)', 'max')
      .where('w.list_id = :listId', { listId: data.list_id })
      .getRawOne()

    let sortOrder = Number(maxSort?.max) || 0
    let imported = 0
    const errors: string[] = []

    for (const wordData of data.words) {
      try {
        await this.words.save(
          this.words.create({
            ...pickWordFields(wordData),
            list_id: data.list_id,
            sort_order: ++sortOrder,
          }),
        )
        imported++
      } catch (error) {
        errors.push(`${wordData?.word}: ${(error as Error).message}`)
      }
    }

    await this.refreshWordCount(data.list_id)
    return { data: { imported, errors, success: true } }
  }

  private async refreshWordCount(listId: string) {
    const count = await this.words.count({ where: { list_id: listId } })
    await this.lists.update(listId, { word_count: count })
  }
}
