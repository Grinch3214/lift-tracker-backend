import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SyncPullQueryDto } from './dto/sync-pull-query.dto';
import { SyncPushDto } from './dto/sync-push.dto';
import { SyncService } from './sync.service';

@Controller('sync')
@UseGuards(JwtAuthGuard)
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Get('pull')
  pull(@CurrentUser() user: { id: string }, @Query() query: SyncPullQueryDto) {
    return this.syncService.pull(user.id, query.since);
  }

  @Post('push')
  push(@CurrentUser() user: { id: string }, @Body() dto: SyncPushDto) {
    return this.syncService.push(user.id, dto);
  }
}
