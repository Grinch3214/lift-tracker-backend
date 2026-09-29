import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

// Пользовательские фото (сейчас — только кастомные упражнения). Файл лежит на диске
// (MEDIA_DIR/<id>), эта таблица — только метаданные: чей файл и как его отдавать.
// id приходит от клиента (как и everywhere else в проекте) — он же mediaId у
// CustomExercise, но сознательно без FOREIGN KEY (см. CustomExercise.muscleGroupId) —
// offline-first клиент может запушить mediaId раньше, чем успеет закачать сам файл.
@Entity('media')
@Index('idx_media_user_id', ['userId'])
export class Media {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'media_user_id_fkey',
  })
  user: User;

  @Column({ type: 'text', name: 'content_type' })
  contentType: string;

  @Column({ type: 'integer' })
  size: number;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
