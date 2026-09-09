import { IsISO8601, IsOptional } from 'class-validator';

export class SyncPullQueryDto {
  @IsOptional()
  @IsISO8601()
  since?: string;
}
