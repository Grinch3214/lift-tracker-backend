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

  // Ссылка в каталог упражнений (статичный на фронте или custom_exercises) — сознательно
  // не FOREIGN KEY, т.к. статичный каталог в БД не хранится. См. ARCHITECTURE.md#3.
  @Column({ type: 'text', name: 'exercise_id' })
  exerciseId: string;

  @Column({ type: 'integer', nullable: true })
  order: number | null;

  @OneToMany(() => SetEntry, (setEntry) => setEntry.workoutExercise)
  setEntries: SetEntry[];
}
