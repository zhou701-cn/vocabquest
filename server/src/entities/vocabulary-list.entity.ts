import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm'

@Entity('vocabulary_lists')
export class VocabularyList {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column()
  name: string

  @Column({ nullable: true })
  description: string

  @Column({ type: 'uuid', nullable: true })
  created_by: string

  @Column({ default: false })
  is_default: boolean

  @Column({ default: false })
  is_public: boolean

  @Column()
  category: string

  @Column({ type: 'int', nullable: true })
  difficulty_level: number

  @Column({ type: 'int', nullable: true })
  target_grade_level: number

  @Column({ type: 'int', default: 0 })
  word_count: number

  @Column({ type: 'text', array: true, nullable: true })
  tags: string[]

  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, any>

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  created_at: Date

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  updated_at: Date

  @Column({ default: true })
  is_active: boolean
}
