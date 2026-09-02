import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, MoreThan, Repository } from 'typeorm';
import { CatalogOrder } from '../catalog/catalog-order.entity';
import { CustomExercise } from '../catalog/custom-exercise.entity';
import { CustomMuscleGroup } from '../catalog/custom-muscle-group.entity';
import { SetEntry } from '../workouts/set-entry.entity';
import { Workout } from '../workouts/workout.entity';
import { WorkoutExercise } from '../workouts/workout-exercise.entity';
import { PushCatalogOrderDto } from './dto/push-catalog-order.dto';
import { PushCustomExerciseDto } from './dto/push-custom-exercise.dto';
import { PushCustomMuscleGroupDto } from './dto/push-custom-muscle-group.dto';
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

export interface WireCustomMuscleGroup {
  id: string;
  name: string;
  order: number;
  isDeleted: boolean;
  updatedAt: string;
}

export interface WireCustomExercise {
  id: string;
  muscleGroupId: string;
  name: string;
  equipment?: string;
  trackingType: string;
  order?: number;
  isDeleted: boolean;
  updatedAt: string;
}

export interface WireCatalogOrder {
  groupOrder: string[];
  exerciseOrder: Record<string, string[]>;
  updatedAt: string;
}

type WireRecord =
  WireWorkout | WireCustomMuscleGroup | WireCustomExercise | WireCatalogOrder;

export interface RejectedPush {
  id: string;
  reason: 'stale';
  current: WireRecord;
}

@Injectable()
export class SyncService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Workout)
    private readonly workoutsRepository: Repository<Workout>,
    @InjectRepository(CustomMuscleGroup)
    private readonly customMuscleGroupsRepository: Repository<CustomMuscleGroup>,
    @InjectRepository(CustomExercise)
    private readonly customExercisesRepository: Repository<CustomExercise>,
    @InjectRepository(CatalogOrder)
    private readonly catalogOrderRepository: Repository<CatalogOrder>,
  ) {}

  async pull(userId: string, since?: string) {
    const sinceDate = since ? new Date(since) : undefined;

    const workouts = await this.workoutsRepository.find({
      where: sinceDate
        ? { userId, updatedAt: MoreThan(sinceDate) }
        : { userId },
      relations: ['workoutExercises', 'workoutExercises.setEntries'],
      order: { date: 'ASC' },
    });

    // is_deleted намеренно НЕ фильтруем — клиент сам решает, скрывать ли soft-deleted
    // запись в UI; старые синхронизированные тренировки должны продолжать резолвить
    // название по id, см. ARCHITECTURE.md, раздел 7.
    const customMuscleGroups = await this.customMuscleGroupsRepository.find({
      where: sinceDate
        ? { userId, updatedAt: MoreThan(sinceDate) }
        : { userId },
    });

    const customExercises = await this.customExercisesRepository.find({
      where: sinceDate
        ? { userId, updatedAt: MoreThan(sinceDate) }
        : { userId },
    });

    const catalogOrderRow = await this.catalogOrderRepository.findOne({
      where: sinceDate
        ? { userId, updatedAt: MoreThan(sinceDate) }
        : { userId },
    });

    return {
      workouts: workouts.map((workout) => this.workoutToWire(workout)),
      customMuscleGroups: customMuscleGroups.map((group) =>
        this.muscleGroupToWire(group),
      ),
      customExercises: customExercises.map((exercise) =>
        this.exerciseToWire(exercise),
      ),
      catalogOrder: catalogOrderRow
        ? this.catalogOrderToWire(catalogOrderRow)
        : null,
      serverTime: new Date().toISOString(),
    };
  }

  async push(userId: string, dto: SyncPushDto) {
    const accepted: string[] = [];
    const rejected: RejectedPush[] = [];

    for (const incoming of dto.workouts ?? []) {
      const result = await this.pushWorkout(userId, incoming);
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

    for (const incoming of dto.customMuscleGroups ?? []) {
      const result = await this.pushMuscleGroup(userId, incoming);
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

    for (const incoming of dto.customExercises ?? []) {
      const result = await this.pushExercise(userId, incoming);
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

    if (dto.catalogOrder) {
      const result = await this.pushCatalogOrder(userId, dto.catalogOrder);
      if (result.accepted) {
        accepted.push(userId); // catalog_order одна строка на юзера, PK = user_id
      } else {
        rejected.push({ id: userId, reason: 'stale', current: result.current });
      }
    }

    return { accepted, rejected, serverTime: new Date().toISOString() };
  }

  private async pushWorkout(
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
        return { accepted: false, current: this.workoutToWire(existing) };
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

  private async pushMuscleGroup(
    userId: string,
    incoming: PushCustomMuscleGroupDto,
  ): Promise<
    { accepted: true } | { accepted: false; current: WireCustomMuscleGroup }
  > {
    const existing = await this.customMuscleGroupsRepository.findOne({
      where: { id: incoming.id, userId },
    });

    const incomingUpdatedAt = new Date(incoming.updatedAt);
    if (existing && existing.updatedAt >= incomingUpdatedAt) {
      return { accepted: false, current: this.muscleGroupToWire(existing) };
    }

    await this.customMuscleGroupsRepository.save({
      id: incoming.id,
      userId,
      name: incoming.name,
      order: incoming.order,
      isDeleted: incoming.isDeleted,
      updatedAt: incomingUpdatedAt,
    });

    return { accepted: true };
  }

  private async pushExercise(
    userId: string,
    incoming: PushCustomExerciseDto,
  ): Promise<
    { accepted: true } | { accepted: false; current: WireCustomExercise }
  > {
    const existing = await this.customExercisesRepository.findOne({
      where: { id: incoming.id, userId },
    });

    const incomingUpdatedAt = new Date(incoming.updatedAt);
    if (existing && existing.updatedAt >= incomingUpdatedAt) {
      return { accepted: false, current: this.exerciseToWire(existing) };
    }

    await this.customExercisesRepository.save({
      id: incoming.id,
      userId,
      muscleGroupId: incoming.muscleGroupId,
      name: incoming.name,
      equipment: incoming.equipment ?? null,
      trackingType: incoming.trackingType,
      order: incoming.order ?? null,
      isDeleted: incoming.isDeleted,
      updatedAt: incomingUpdatedAt,
    });

    return { accepted: true };
  }

  private async pushCatalogOrder(
    userId: string,
    incoming: PushCatalogOrderDto,
  ): Promise<
    { accepted: true } | { accepted: false; current: WireCatalogOrder }
  > {
    const existing = await this.catalogOrderRepository.findOne({
      where: { userId },
    });

    const incomingUpdatedAt = new Date(incoming.updatedAt);
    if (existing && existing.updatedAt >= incomingUpdatedAt) {
      return { accepted: false, current: this.catalogOrderToWire(existing) };
    }

    await this.catalogOrderRepository.save({
      userId,
      groupOrder: incoming.groupOrder,
      exerciseOrder: incoming.exerciseOrder,
      updatedAt: incomingUpdatedAt,
    });

    return { accepted: true };
  }

  private workoutToWire(workout: Workout): WireWorkout {
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

  private muscleGroupToWire(group: CustomMuscleGroup): WireCustomMuscleGroup {
    return {
      id: group.id,
      name: group.name,
      order: group.order,
      isDeleted: group.isDeleted,
      updatedAt: group.updatedAt.toISOString(),
    };
  }

  private exerciseToWire(exercise: CustomExercise): WireCustomExercise {
    return {
      id: exercise.id,
      muscleGroupId: exercise.muscleGroupId,
      name: exercise.name,
      equipment: exercise.equipment ?? undefined,
      trackingType: exercise.trackingType,
      order: exercise.order ?? undefined,
      isDeleted: exercise.isDeleted,
      updatedAt: exercise.updatedAt.toISOString(),
    };
  }

  private catalogOrderToWire(row: CatalogOrder): WireCatalogOrder {
    return {
      groupOrder: row.groupOrder,
      exerciseOrder: row.exerciseOrder,
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
