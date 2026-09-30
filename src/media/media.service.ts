import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Media } from './media.entity';

// После сжатия на клиенте (imageCompress.ts) фото весит ~20-60КБ — 300КБ с большим
// запасом на случай, если клиент когда-нибудь пришлёт что-то покрупнее.
export const MAX_MEDIA_BYTES = 300 * 1024;

// В докере — /app/media (том, см. docker-compose.yml), локально — ./media рядом с проектом.
const MEDIA_DIR = path.join(process.cwd(), 'media');

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface DetectedType {
  contentType: 'image/webp' | 'image/jpeg';
  extension: 'webp' | 'jpg';
}

// Смотрим на первые байты файла, а не на заголовок Content-Type от клиента — его легко
// подделать. Только то, что реально отдаёт imageCompress.ts (webp, с фоллбеком на jpeg).
function detectImageType(buffer: Buffer): DetectedType | null {
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return { contentType: 'image/webp', extension: 'webp' };
  }
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return { contentType: 'image/jpeg', extension: 'jpg' };
  }
  return null;
}

@Injectable()
export class MediaService {
  constructor(
    @InjectRepository(Media)
    private readonly mediaRepository: Repository<Media>,
  ) {}

  private filePath(id: string): string {
    // Без расширения на диске — тип хранится в БД (content_type), а не в имени файла;
    // так замена content-type между двумя PUT одного id не оставляет файл-сироту со
    // старым расширением.
    return path.join(MEDIA_DIR, id);
  }

  async save(id: string, userId: string, file?: Express.Multer.File) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Файл не передан');
    }
    if (file.size > MAX_MEDIA_BYTES) {
      throw new BadRequestException('Файл слишком большой');
    }

    const detected = detectImageType(file.buffer);
    if (!detected) {
      throw new BadRequestException('Ожидается изображение (webp или jpeg)');
    }

    const existing = await this.mediaRepository.findOne({ where: { id } });
    if (existing && existing.userId !== userId) {
      throw new ForbiddenException('Этот id занят другим пользователем');
    }

    await fsp.mkdir(MEDIA_DIR, { recursive: true });
    await fsp.writeFile(this.filePath(id), file.buffer);

    await this.mediaRepository.save({
      id,
      userId,
      contentType: detected.contentType,
      size: file.size,
    });

    return { id };
  }

  async read(
    rawId: string,
  ): Promise<{ stream: fs.ReadStream; contentType: string }> {
    // Клиент вправе постучаться на /media/<id>.webp — расширение чисто для читаемости
    // URL и на резолв не влияет, см. API.md.
    const id = rawId.split('.')[0];
    if (!UUID_RE.test(id)) {
      throw new NotFoundException();
    }

    const media = await this.mediaRepository.findOne({ where: { id } });
    if (!media) {
      throw new NotFoundException();
    }

    const filePath = this.filePath(id);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException();
    }

    return {
      stream: fs.createReadStream(filePath),
      contentType: media.contentType,
    };
  }
}
