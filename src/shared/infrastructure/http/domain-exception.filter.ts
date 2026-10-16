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
  not_found: HttpStatus.NOT_FOUND,
  conflict: HttpStatus.CONFLICT,
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

    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(exception.message, exception.stack);
    }

    host
      .switchToHttp()
      .getResponse<Response>()
      .status(status)
      .json({
        statusCode: status,
        error: exception.name,
        message: exception.message,
      });
  }
}
