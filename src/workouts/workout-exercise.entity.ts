import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
} from 'typeorm';
import { SetEntry } from './set-entry.entity';
import { Workout } from './workout.entity';

@Entity('workout_exercises')
@Index('idx_workout_exercises_workout_id', ['workoutId'])
export class WorkoutExercise {
  @PrimaryColumn('uuid')
  id: string; // приходит от клиента

  @Column({ type: 'uuid', name: 'workout_id' })
  workoutId: string;

  @ManyToOne(() => Workout, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'workout_id',
    foreignKeyConstraintName: 'workout_exercises_workout_id_fkey',
  })
  workout: Workout;

  @Column({ type: 'text', name: 'exercise_id' })
  exerciseId: string;

  @Column({ type: 'integer', nullable: true })
  order: number | null;

  @Column({ type: 'uuid', name: 'superset_id', nullable: true })
  supersetId: string | null;

  @OneToMany(() => SetEntry, (setEntry) => setEntry.workoutExercise)
  setEntries: SetEntry[];
}
