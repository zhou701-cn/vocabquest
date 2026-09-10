import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm'

@Entity('learning_sessions')
export class LearningSession {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'uuid' })
  user_id: string

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  session_start: Date

  @Column({ type: 'timestamptz', nullable: true })
  session_end: Date

  @Column({ type: 'int', nullable: true })
  duration_minutes: number

  @Column()
  mode: string

  @Column({ type: 'int', default: 0 })
  words_studied: number

  @Column({ type: 'int', default: 0 })
  words_correct: number

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  accuracy_percentage: number

  @Column({ type: 'int', default: 0 })
  points_earned: number

  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, any>

  @Column({ default: false })
  is_completed: boolean

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  created_at: Date
}
