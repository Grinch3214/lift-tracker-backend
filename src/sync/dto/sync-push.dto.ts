import { Type } from 'class-transformer';
import {
  IsArray,
  IsISO8601,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { PushWorkoutDto } from './push-workout.dto';

export class SyncPushDto {
  // Присутствует в контракте (ARCHITECTURE.md), но сервером сейчас не используется —
  // решение по каждому Workout принимается по его собственному updatedAt, не по этому полю.
  @IsOptional()
  @IsISO8601()
  lastSyncedAt?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PushWorkoutDto)
  workouts: PushWorkoutDto[];
}
