import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm'

@Entity('poem_projects')
export class PoemProject {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'uuid' })
  user_id: string

  @Column()
  name: string

  @Column({ default: '' })
  file_name: string

  @Column({ default: 'other' })
  format: string

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  created_at: Date

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  updated_at: Date
}

@Entity('poems')
export class Poem {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'uuid' })
  project_id: string

  @Column({ type: 'uuid' })
  user_id: string

  @Column()
  title: string

  @Column({ nullable: true })
  author: string

  @Column({ type: 'text', array: true, default: '{}' })
  lines: string[]

  @Column({ type: 'int', default: 0 })
  sort_order: number

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  created_at: Date

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  updated_at: Date
}

@Entity('poem_practice_records')
export class PoemPracticeRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'uuid' })
  user_id: string

  @Column({ type: 'uuid' })
  poem_id: string

  @Column({ type: 'uuid', nullable: true })
  project_id: string

  @Column({ default: '' })
  fingerprint: string

  @Column({ type: 'jsonb', nullable: true })
  recite: Record<string, any>

  @Column({ type: 'jsonb', nullable: true })
  dictate: Record<string, any>

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  updated_at: Date
}
