import {
  IsBoolean,
  IsIn,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class PushCustomExerciseDto {
  @IsUUID()
  id: string;

  @IsString()
  muscleGroupId: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  equipment?: string;

  @IsIn(['weight-reps', 'time-distance'])
  trackingType: 'weight-reps' | 'time-distance';

  @IsOptional()
  @IsInt()
  order?: number;

  @IsBoolean()
  isDeleted: boolean;

  @IsISO8601()
  updatedAt: string;
}
