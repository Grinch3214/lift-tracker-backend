import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { WorkoutExercise } from './workout-exercise.entity';

@Entity('set_entries')
@Index('idx_set_entries_workout_exercise_id', ['workoutExerciseId'])
@Check(
  'set_entries_dumbbell_count_check',
  '"dumbbell_count" IS NULL OR "dumbbell_count" IN (1, 2)',
)
export class SetEntry {
  @PrimaryColumn('uuid')
  id: string; // приходит от клиента

  @Column({ type: 'uuid', name: 'workout_exercise_id' })
  workoutExerciseId: string;

  @ManyToOne(() => WorkoutExercise, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'workout_exercise_id',
    foreignKeyConstraintName: 'set_entries_workout_exercise_id_fkey',
  })
  workoutExercise: WorkoutExercise;

  @Column({ type: 'numeric', nullable: true })
  weight: string | null; // кг, только для trackingType 'weight-reps'

  @Column({ type: 'integer', nullable: true })
  reps: number | null;

  @Column({ type: 'integer', name: 'duration_seconds', nullable: true })
  durationSeconds: number | null; // только для trackingType 'time-distance'

  @Column({ type: 'numeric', name: 'distance_km', nullable: true })
  distanceKm: string | null;

  @Column({ type: 'smallint', name: 'dumbbell_count', nullable: true })
  dumbbellCount: number | null;

  @Column({ type: 'boolean', name: 'is_completed', default: true })
  isCompleted: boolean;
}
