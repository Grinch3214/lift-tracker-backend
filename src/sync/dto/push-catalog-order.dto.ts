import { IsArray, IsISO8601, IsObject, IsString } from 'class-validator';

export class PushCatalogOrderDto {
  @IsArray()
  @IsString({ each: true })
  groupOrder: string[];

  // { [muscleGroupId: string]: string[] } — форма приходит с фронта как есть,
  // построчную валидацию каждого массива внутри сознательно не делаем (см. LEARNING.md)
  @IsObject()
  exerciseOrder: Record<string, string[]>;

  @IsISO8601()
  updatedAt: string;
}
