import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response, Request } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  private get isProd(): boolean {
    return process.env.NODE_ENV === 'production';
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number;
    let message: string;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else {
        const m = (res as { message?: string | string[] }).message;
        message = Array.isArray(m) ? m[0] : (m ?? exception.message);
      }
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal server error';
    }

    // Never leak internals for 5xx in production
    if (this.isProd && status >= 500) {
      message = 'Internal server error';
    }

    if (status >= 500) {
      this.logger.error(
        `${request?.method ?? 'UNKNOWN'} ${request?.url ?? ''} → ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const body: Record<string, unknown> = { statusCode: status, message };

    if (!this.isProd && exception instanceof Error) {
      body.stack = exception.stack;
    }

    response.status(status).json(body);
  }
}
