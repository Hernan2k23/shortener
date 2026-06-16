import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();

    const { status, message, code } = this.map(exception);

    if (Number(status) >= 500) {
      this.logger.error(
        message,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    res.status(status).json({
      statusCode: status,
      error: HttpStatus[status] ?? 'Error',
      message,
      code,
    });
  }

  private map(exception: unknown): {
    status: HttpStatus;
    message: string;
    code: string;
  } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const r = exception.getResponse();
      const message =
        typeof r === 'string'
          ? r
          : ((r as { message?: string }).message ?? exception.message);
      return { status, message, code: this.codeFor(status) };
    }

    if (
      typeof exception === 'object' &&
      exception !== null &&
      (exception as { code?: number }).code === 11000
    ) {
      return {
        status: HttpStatus.CONFLICT,
        message: 'duplicate key',
        code: 'DUPLICATE_KEY',
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'internal server error',
      code: 'INTERNAL_ERROR',
    };
  }

  private codeFor(status: HttpStatus): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'BAD_REQUEST';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.CONFLICT:
        return 'CONFLICT';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'TOO_MANY_REQUESTS';
      default:
        return Number(status) >= 500 ? 'INTERNAL_ERROR' : 'ERROR';
    }
  }
}
