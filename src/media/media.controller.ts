import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Express, Response } from 'express';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MAX_MEDIA_BYTES, MediaService } from './media.service';

@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_MEDIA_BYTES },
    }),
  )
  async put(
    @Param('id', new ParseUUIDPipe()) id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: { id: string },
  ) {
    return this.mediaService.save(id, user.id, file);
  }

  // Без JwtAuthGuard — публичный доступ по неугадываемому UUID, см. ARCHITECTURE.md.
  @Get(':id')
  async get(
    @Param('id') rawId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { stream, contentType } = await this.mediaService.read(rawId);
    res.set({
      'Content-Type': contentType,
      // Один id — всегда одна и та же картинка (новое фото = новый mediaId), поэтому
      // можно кэшировать навсегда.
      'Cache-Control': 'public, max-age=31536000, immutable',
    });
    return new StreamableFile(stream);
  }
}
