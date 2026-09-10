import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm'

@Entity('activity_log')
export class ActivityLog {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'uuid' })
  user_id: string

  @Column()
  activity_type: string

  @Column({ type: 'jsonb', default: {} })
  activity_data: Record<string, any>

  @Column({ type: 'int', default: 0 })
  points_earned: number

  @Column({ type: 'uuid', nullable: true })
  session_id: string

  @Column({ nullable: true })
  ip_address: string

  @Column({ nullable: true })
  user_agent: string

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  created_at: Date
}
