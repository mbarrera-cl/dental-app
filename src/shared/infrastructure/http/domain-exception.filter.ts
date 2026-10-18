import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { DomainError, type DomainErrorKind } from '../../domain/domain-error.js';

/** Maps domain error kinds to HTTP status codes. */
const STATUS_BY_KIND: Record<DomainErrorKind, HttpStatus> = {
  validation: HttpStatus.BAD_REQUEST,
  unauthorized: HttpStatus.UNAUTHORIZED,
  forbidden: HttpStatus.FORBIDDEN,
  not_found: HttpStatus.NOT_FOUND,
  conflict: HttpStatus.CONFLICT,
  locked: HttpStatus.LOCKED,
  unsupported_media: HttpStatus.UNSUPPORTED_MEDIA_TYPE,
  unexpected: HttpStatus.INTERNAL_SERVER_ERROR,
};

/**
 * Translates `DomainError`s thrown by entities, value objects and use cases
 * into HTTP responses. Anything that is not a `DomainError` (validation pipe
 * errors, unexpected exceptions, ...) is left to Nest's default handling.
 */
@Catch(DomainError)
export class DomainExceptionFilter implements ExceptionFilter<DomainError> {
  private readonly logger = new Logger(DomainExceptionFilter.name);

  catch(exception: DomainError, host: ArgumentsHost): void {
    const status = STATUS_BY_KIND[exception.kind];
    const response = host.switchToHttp().getResponse<Response>();

    // Unexpected errors may carry internal details (SQL, paths, stack hints).
    // Log them server-side and return a generic payload to the client.
    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(exception.message, exception.stack);

      response.status(status).json({
        statusCode: status,
        error: 'InternalServerError',
        message: 'Internal server error',
      });

      return;
    }

    response.status(status).json({
      statusCode: status,
      error: exception.name,
      message: exception.message,
      ...(exception.details === undefined ? {} : { details: exception.details }),
    });
  }
}
