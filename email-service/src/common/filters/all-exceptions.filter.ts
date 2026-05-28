import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Inject,
  LoggerService,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx      = host.switchToHttp();
    const request  = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    const errorBody = {
      statusCode: status,
      timestamp:  new Date().toISOString(),
      path:       request.url,
      method:     request.method,
      message:    typeof message === 'string' ? message : (message as any).message ?? message,
      errors:     typeof message === 'object'  ? (message as any).message : undefined,
    };

    if (status >= 500) {
      this.logger.error(
        `[${request.method}] ${request.url} — ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
        'ExceptionFilter',
      );
    } else {
      this.logger.warn(
        `[${request.method}] ${request.url} — ${status}: ${errorBody.message}`,
        'ExceptionFilter',
      );
    }

    response.status(status).json(errorBody);
  }
}
