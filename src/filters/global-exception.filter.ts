import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

interface MongoError {
  code?: number;
  message?: string;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode: number;
    let errorMessage: string;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const res = exception.getResponse();
      errorMessage =
        typeof res === 'string'
          ? res
          : ((res as { message?: string | string[] }).message
              ? Array.isArray((res as { message: string[] }).message)
                ? (res as { message: string[] }).message.join(', ')
                : String((res as { message: string }).message)
              : 'Request error');
    } else if ((exception as MongoError).code === 11000) {
      statusCode = HttpStatus.CONFLICT;
      errorMessage = 'Duplicate property_id';
    } else {
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      errorMessage = 'Internal server error';
    }

    this.logger.error(
      `${request.method} ${request.url} → ${statusCode}`,
      exception instanceof Error ? exception.stack : String(exception),
    );

    response.status(statusCode).json({ error: errorMessage, statusCode });
  }
}
