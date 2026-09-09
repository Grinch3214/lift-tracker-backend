import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

@Entity('custom_muscle_groups')
@Index('idx_custom_muscle_groups_user_id', ['userId'])
export class CustomMuscleGroup {
  @PrimaryColumn('uuid')
  id: string; // приходит от клиента

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'custom_muscle_groups_user_id_fkey',
  })
  user: User;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'integer' })
  order: number;

  // soft-delete — старые тренировки должны продолжать резолвить название, см. ARCHITECTURE.md#3
  @Column({ type: 'boolean', name: 'is_deleted', default: false })
  isDeleted: boolean;

  @Column({ type: 'timestamptz', name: 'updated_at', default: () => 'now()' })
  updatedAt: Date;
}
