import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { QueryFailedError } from 'typeorm';

// pg добавляет code/constraint прямо на QueryFailedError (см. TypeORM's QueryFailedError
// конструктор — расспределяет свойства driverError на себя), но статически они не
// типизированы.
interface PgQueryFailedError extends QueryFailedError {
  code?: string;
  constraint?: string;
}

// Access-токен живёт до 15 минут и после logout/удаления аккаунта (см. API.md) —
// staleный, но ещё подписанный токен может успеть дойти до push/upload с userId,
// которого уже нет в "users". Без этого фильтра такой запрос падает необработанным
// QueryFailedError (нарушение FK на *_user_id_fkey) прямо в БД-драйвере — голый 500
// вместо понятной ошибки клиенту. Другие сбои SQL (не по этому шаблону) по-прежнему
// уходят в 500, как и раньше — просто без утечки деталей запроса в ответ.
@Catch(QueryFailedError)
export class QueryFailedFilter implements ExceptionFilter {
  catch(exception: PgQueryFailedError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (
      exception.code === '23503' &&
      exception.constraint?.endsWith('_user_id_fkey')
    ) {
      response.status(HttpStatus.UNAUTHORIZED).json({
        statusCode: HttpStatus.UNAUTHORIZED,
        message: 'Учётная запись больше не существует',
      });
      return;
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
    });
  }
}
