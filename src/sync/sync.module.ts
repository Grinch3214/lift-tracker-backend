import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SetEntry } from '../workouts/set-entry.entity';
import { Workout } from '../workouts/workout.entity';
import { WorkoutExercise } from '../workouts/workout-exercise.entity';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';

@Module({
  imports: [TypeOrmModule.forFeature([Workout, WorkoutExercise, SetEntry])],
  controllers: [SyncController],
  providers: [SyncService],
})
export class SyncModule {}
