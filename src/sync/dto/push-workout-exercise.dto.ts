import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { PushSetEntryDto } from './push-set-entry.dto';

export class PushWorkoutExerciseDto {
  @IsUUID()
  id: string;

  @IsString()
  exerciseId: string;

  @IsOptional()
  @IsInt()
  order?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PushSetEntryDto)
  sets: PushSetEntryDto[];
}
