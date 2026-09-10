import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm'

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ unique: true })
  email: string

  @Column({ select: false })
  password_hash: string

  @Column()
  full_name: string

  @Column({ default: 'student' })
  role: 'student' | 'teacher' | 'parent' | 'admin'

  @Column({ type: 'int', nullable: true })
  grade_level: number

  @Column({ type: 'date', nullable: true })
  date_of_birth: string

  @Column({ nullable: true })
  parent_email: string

  @Column({ type: 'jsonb', default: {} })
  preferences: Record<string, any>

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  created_at: Date

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  updated_at: Date

  @Column({ type: 'timestamptz', nullable: true })
  last_active: Date

  @Column({ default: true })
  is_active: boolean
}
