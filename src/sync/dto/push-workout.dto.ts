import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsISO8601,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { PushWorkoutExerciseDto } from './push-workout-exercise.dto';

export class PushWorkoutDto {
  @IsUUID()
  id: string;

  @IsDateString()
  date: string; // 'YYYY-MM-DD'

  @IsISO8601()
  createdAt: string;

  // Обязательное поле — без него LWW-сравнение при синке невозможно.
  // На фронте этого поля пока нет (Workout там только с createdAt) — добавить при интеграции.
  @IsISO8601()
  updatedAt: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PushWorkoutExerciseDto)
  exercises: PushWorkoutExerciseDto[];
}
