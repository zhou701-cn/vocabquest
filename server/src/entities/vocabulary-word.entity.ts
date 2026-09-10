import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm'

@Entity('vocabulary_words')
export class VocabularyWord {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'uuid' })
  list_id: string

  @Column()
  word: string

  @Column({ nullable: true })
  part_of_speech: string

  @Column()
  definition: string

  @Column({ nullable: true })
  simple_definition: string

  @Column()
  example_sentence: string

  @Column({ nullable: true })
  example_context: string

  @Column({ type: 'text', array: true, nullable: true })
  synonyms: string[]

  @Column({ type: 'text', array: true, nullable: true })
  antonyms: string[]

  @Column({ type: 'int', nullable: true })
  difficulty_level: number

  @Column({ type: 'int', nullable: true })
  frequency_score: number

  @Column({ type: 'int', nullable: true })
  ssat_importance: number

  @Column({ nullable: true })
  audio_url: string

  @Column({ nullable: true })
  image_url: string

  @Column({ nullable: true })
  pronunciation_guide: string

  @Column({ nullable: true })
  etymology: string

  @Column({ type: 'text', array: true, nullable: true })
  related_words: string[]

  @Column({ nullable: true })
  usage_notes: string

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  created_at: Date

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  updated_at: Date

  @Column({ type: 'int', default: 0 })
  sort_order: number
}
