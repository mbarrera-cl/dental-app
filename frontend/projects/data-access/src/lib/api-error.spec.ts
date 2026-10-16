import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import { mapApiError } from './api-error';

function httpError(status: number, body: unknown): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: body });
}

describe('mapApiError', () => {
  it('maps the backend status 0 to a network error', () => {
    expect(mapApiError(new HttpErrorResponse({ status: 0 }))).toBe('errors.network');
  });

  it('maps domain error names to translation keys', () => {
    expect(mapApiError(httpError(409, { statusCode: 409, error: 'UserAlreadyExistsError', message: 'dup' }))).toBe(
      'errors.userAlreadyExists',
    );
    expect(mapApiError(httpError(404, { statusCode: 404, error: 'UserNotFoundError', message: 'missing' }))).toBe(
      'errors.userNotFound',
    );
    expect(mapApiError(httpError(400, { statusCode: 400, error: 'EmptyUserUpdateError', message: 'empty' }))).toBe(
      'errors.emptyUpdate',
    );
    expect(mapApiError(httpError(400, { statusCode: 400, error: 'InvalidEmailError', message: 'bad email' }))).toBe(
      'errors.invalidEmail',
    );
    expect(mapApiError(httpError(400, { statusCode: 400, error: 'InvalidNameError', message: 'bad name' }))).toBe(
      'errors.invalidName',
    );
  });

  it('maps ValidationPipe responses by status code', () => {
    const validationPipeBody = {
      statusCode: 400,
      message: ['email must be an email'],
      error: 'Bad Request',
    };

    expect(mapApiError(httpError(400, validationPipeBody))).toBe('errors.validation');
  });

  it('maps unknown statuses to a generic error', () => {
    expect(mapApiError(httpError(500, { statusCode: 500, message: 'boom' }))).toBe('errors.unknown');
    expect(mapApiError(new Error('not http'))).toBe('errors.unknown');
    expect(mapApiError(null)).toBe('errors.unknown');
  });
});
