import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  Unique,
} from 'typeorm';
import { User } from '../users/user.entity';
import { WorkoutExercise } from './workout-exercise.entity';

@Entity('workouts')
@Unique('workouts_user_id_date_key', ['userId', 'date'])
@Index('idx_workouts_user_id', ['userId'])
export class Workout {
  @PrimaryColumn('uuid')
  id: string; // приходит от клиента, см. ARCHITECTURE.md#3

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'workouts_user_id_fkey',
  })
  user: User;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @Column({ type: 'timestamptz', name: 'updated_at', default: () => 'now()' })
  updatedAt: Date;

  @OneToMany(
    () => WorkoutExercise,
    (workoutExercise) => workoutExercise.workout,
  )
  workoutExercises: WorkoutExercise[];
}
