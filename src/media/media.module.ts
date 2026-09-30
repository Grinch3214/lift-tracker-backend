import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MediaController } from './media.controller';
import { Media } from './media.entity';
import { MediaService } from './media.service';

@Module({
  imports: [TypeOrmModule.forFeature([Media])],
  controllers: [MediaController],
  providers: [MediaService],
})
export class MediaModule {}
