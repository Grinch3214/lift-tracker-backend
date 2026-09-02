import { IsBoolean, IsISO8601, IsInt, IsString, IsUUID } from 'class-validator';

export class PushCustomMuscleGroupDto {
  @IsUUID()
  id: string;

  @IsString()
  name: string;

  @IsInt()
  order: number;

  @IsBoolean()
  isDeleted: boolean;

  @IsISO8601()
  updatedAt: string;
}
