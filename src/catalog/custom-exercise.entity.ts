import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

@Entity('custom_exercises')
@Index('idx_custom_exercises_user_id', ['userId'])
@Check(
  'custom_exercises_tracking_type_check',
  `"tracking_type" IN ('weight-reps', 'time-distance')`,
)
export class CustomExercise {
  @PrimaryColumn('uuid')
  id: string; // приходит от клиента

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'custom_exercises_user_id_fkey',
  })
  user: User;

  // может указывать на встроенную группу (не в БД) или на custom_muscle_groups.id —
  // сознательно не FOREIGN KEY, см. workout_exercises.exercise_id / ARCHITECTURE.md#3
  @Column({ type: 'text', name: 'muscle_group_id' })
  muscleGroupId: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'text', nullable: true })
  equipment: string | null;

  @Column({ type: 'text', name: 'tracking_type' })
  trackingType: string;

  @Column({ type: 'integer', nullable: true })
  order: number | null;

  @Column({ type: 'boolean', name: 'is_deleted', default: false })
  isDeleted: boolean;

  @Column({ type: 'timestamptz', name: 'updated_at', default: () => 'now()' })
  updatedAt: Date;
}
