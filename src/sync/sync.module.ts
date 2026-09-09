import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogOrder } from '../catalog/catalog-order.entity';
import { CustomExercise } from '../catalog/custom-exercise.entity';
import { CustomMuscleGroup } from '../catalog/custom-muscle-group.entity';
import { SetEntry } from '../workouts/set-entry.entity';
import { Workout } from '../workouts/workout.entity';
import { WorkoutExercise } from '../workouts/workout-exercise.entity';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Workout,
      WorkoutExercise,
      SetEntry,
      CustomMuscleGroup,
      CustomExercise,
      CatalogOrder,
    ]),
  ],
  controllers: [SyncController],
  providers: [SyncService],
})
export class SyncModule {}
