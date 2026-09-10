import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm'

@Entity('user_progress')
export class UserProgress {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'uuid' })
  user_id: string

  @Column({ type: 'uuid' })
  word_id: string

  @Column({ type: 'int', default: 0 })
  current_level: number

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 2.5 })
  ease_factor: number

  @Column({ type: 'decimal', precision: 8, scale: 2, default: 1 })
  interval_days: number

  @Column({ type: 'timestamptz', nullable: true })
  last_reviewed: Date

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  next_review: Date

  @Column({ type: 'int', default: 0 })
  consecutive_correct: number

  @Column({ type: 'int', default: 0 })
  total_attempts: number

  @Column({ type: 'int', default: 0 })
  total_correct: number

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  success_rate: number

  @Column({ type: 'timestamptz', nullable: true })
  first_learned: Date

  @Column({ default: false })
  is_learned: boolean

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  created_at: Date

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  updated_at: Date
}
