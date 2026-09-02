import { Type } from 'class-transformer';
import {
  IsArray,
  IsISO8601,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { PushCatalogOrderDto } from './push-catalog-order.dto';
import { PushCustomExerciseDto } from './push-custom-exercise.dto';
import { PushCustomMuscleGroupDto } from './push-custom-muscle-group.dto';
import { PushWorkoutDto } from './push-workout.dto';

export class SyncPushDto {
  // Присутствует в контракте (ARCHITECTURE.md), но сервером сейчас не используется —
  // решение по каждой записи принимается по её собственному updatedAt, не по этому полю.
  @IsOptional()
  @IsISO8601()
  lastSyncedAt?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PushWorkoutDto)
  workouts?: PushWorkoutDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PushCustomMuscleGroupDto)
  customMuscleGroups?: PushCustomMuscleGroupDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PushCustomExerciseDto)
  customExercises?: PushCustomExerciseDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => PushCatalogOrderDto)
  catalogOrder?: PushCatalogOrderDto;
}
