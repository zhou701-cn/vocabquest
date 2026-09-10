import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm'

@Entity('user_gamification')
export class UserGamification {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'uuid', unique: true })
  user_id: string

  @Column({ type: 'int', default: 0 })
  total_points: number

  @Column({ type: 'int', default: 1 })
  current_level: number

  @Column({ type: 'int', default: 0 })
  current_xp: number

  @Column({ type: 'int', default: 100 })
  xp_to_next_level: number

  @Column({ type: 'int', default: 0 })
  current_streak: number

  @Column({ type: 'int', default: 0 })
  longest_streak: number

  @Column({ type: 'date', nullable: true })
  last_activity_date: string

  @Column({ type: 'int', default: 0 })
  words_learned: number

  @Column({ type: 'int', default: 0 })
  total_time_minutes: number

  @Column({ type: 'int', default: 0 })
  achievements_earned: number

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  created_at: Date

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  updated_at: Date
}
