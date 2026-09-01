import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class AppService {
  constructor(private readonly dataSource: DataSource) {}

  getHello(): string {
    return 'Hello World!';
  }

  async getDbTime(): Promise<Date> {
    const result = await this.dataSource.query<{ now: Date }[]>('SELECT NOW()');
    return result[0].now;
  }
}
