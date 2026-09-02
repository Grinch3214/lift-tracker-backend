import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, MoreThan, Repository } from 'typeorm';
import { SetEntry } from '../workouts/set-entry.entity';
import { Workout } from '../workouts/workout.entity';
import { WorkoutExercise } from '../workouts/workout-exercise.entity';
import { PushWorkoutDto } from './dto/push-workout.dto';
import { SyncPushDto } from './dto/sync-push.dto';

export interface WireSetEntry {
  id: string;
  weight?: number;
  reps?: number;
  durationSeconds?: number;
  distanceKm?: number;
  dumbbellCount?: 1 | 2;
  isCompleted: boolean;
}

export interface WireWorkoutExercise {
  id: string;
  exerciseId: string;
  order?: number;
  sets: WireSetEntry[];
}

export interface WireWorkout {
  id: string;
  date: string;
  createdAt: string;
  updatedAt: string;
  exercises: WireWorkoutExercise[];
}

export interface RejectedPush {
  id: string;
  reason: 'stale';
  current: WireWorkout;
}

@Injectable()
export class SyncService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Workout)
    private readonly workoutsRepository: Repository<Workout>,
  ) {}

  async pull(userId: string, since?: string) {
    const workouts = await this.workoutsRepository.find({
      where: since
        ? { userId, updatedAt: MoreThan(new Date(since)) }
        : { userId },
      relations: ['workoutExercises', 'workoutExercises.setEntries'],
      order: { date: 'ASC' },
    });

    return {
      workouts: workouts.map((workout) => this.toWire(workout)),
      serverTime: new Date().toISOString(),
    };
  }

  async push(userId: string, dto: SyncPushDto) {
    const accepted: string[] = [];
    const rejected: RejectedPush[] = [];

    for (const incoming of dto.workouts) {
      const result = await this.pushOne(userId, incoming);
      if (result.accepted) {
        accepted.push(incoming.id);
      } else {
        rejected.push({
          id: incoming.id,
          reason: 'stale',
          current: result.current,
        });
      }
    }

    return { accepted, rejected, serverTime: new Date().toISOString() };
  }

  private async pushOne(
    userId: string,
    incoming: PushWorkoutDto,
  ): Promise<{ accepted: true } | { accepted: false; current: WireWorkout }> {
    return this.dataSource.transaction(async (manager) => {
      const existing = await manager.findOne(Workout, {
        where: { id: incoming.id, userId },
        relations: ['workoutExercises', 'workoutExercises.setEntries'],
      });

      const incomingUpdatedAt = new Date(incoming.updatedAt);
      if (existing && existing.updatedAt >= incomingUpdatedAt) {
        return { accepted: false, current: this.toWire(existing) };
      }

      if (existing) {
        // проще удалить старые exercises (CASCADE унесёт их sets) и вставить заново,
        // чем построчно диффать — см. ARCHITECTURE.md, раздел "Транзакции"
        await manager.delete(WorkoutExercise, { workoutId: existing.id });
      }

      await manager.save(Workout, {
        id: incoming.id,
        userId,
        date: incoming.date,
        createdAt: existing?.createdAt ?? new Date(incoming.createdAt),
        updatedAt: incomingUpdatedAt,
      });

      for (const exercise of incoming.exercises) {
        await manager.save(WorkoutExercise, {
          id: exercise.id,
          workoutId: incoming.id,
          exerciseId: exercise.exerciseId,
          order: exercise.order ?? null,
        });

        for (const set of exercise.sets) {
          await manager.save(SetEntry, {
            id: set.id,
            workoutExerciseId: exercise.id,
            weight: set.weight !== undefined ? String(set.weight) : null,
            reps: set.reps ?? null,
            durationSeconds: set.durationSeconds ?? null,
            distanceKm:
              set.distanceKm !== undefined ? String(set.distanceKm) : null,
            dumbbellCount: set.dumbbellCount ?? null,
            isCompleted: set.isCompleted,
          });
        }
      }

      return { accepted: true };
    });
  }

  private toWire(workout: Workout): WireWorkout {
    return {
      id: workout.id,
      date: workout.date,
      createdAt: workout.createdAt.toISOString(),
      updatedAt: workout.updatedAt.toISOString(),
      exercises: (workout.workoutExercises ?? []).map((exercise) => ({
        id: exercise.id,
        exerciseId: exercise.exerciseId,
        order: exercise.order ?? undefined,
        sets: (exercise.setEntries ?? []).map((set) => ({
          id: set.id,
          weight: set.weight !== null ? Number(set.weight) : undefined,
          reps: set.reps ?? undefined,
          durationSeconds: set.durationSeconds ?? undefined,
          distanceKm:
            set.distanceKm !== null ? Number(set.distanceKm) : undefined,
          dumbbellCount: (set.dumbbellCount ?? undefined) as 1 | 2 | undefined,
          isCompleted: set.isCompleted,
        })),
      })),
    };
  }
}
