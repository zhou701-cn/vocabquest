import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm'

@Entity('user_word_lists')
export class UserWordList {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'uuid' })
  user_id: string

  @Column({ type: 'uuid' })
  list_id: string

  @Column({ type: 'uuid', nullable: true })
  assigned_by: string

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  assigned_at: Date

  @Column({ default: true })
  is_active: boolean

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  progress_percentage: number

  @Column({ type: 'int', default: 0 })
  words_mastered: number

  @Column({ type: 'timestamptz', nullable: true })
  last_studied: Date

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  created_at: Date
}
