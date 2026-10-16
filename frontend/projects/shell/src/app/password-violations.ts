import { HttpErrorResponse } from '@angular/common/http';
import { TranslocoService } from '@jsverse/transloco';

/** A single password-policy rule failure (`details.violations`). */
export interface PasswordViolation {
  rule: string;
  message: string;
}

/**
 * Reads the domain error name from a response produced by the backend's
 * `DomainExceptionFilter` (`{ statusCode, error, message, details? }`).
 */
export function errorNameOf(error: unknown): string | null {
  if (!(error instanceof HttpErrorResponse)) {
    return null;
  }

  const body: unknown = error.error;

  if (typeof body === 'object' && body !== null && 'error' in body) {
    const name = (body as { error: unknown }).error;

    return typeof name === 'string' ? name : null;
  }

  return null;
}

/** Reads the `details` object of a domain error response, if any. */
export function errorDetailsOf(error: unknown): Record<string, unknown> {
  if (error instanceof HttpErrorResponse) {
    const body: unknown = error.error;

    if (typeof body === 'object' && body !== null && 'details' in body) {
      const details = (body as { details?: unknown }).details;

      if (typeof details === 'object' && details !== null) {
        return details as Record<string, unknown>;
      }
    }
  }

  return {};
}

/** Extracts `details.violations` from a `PasswordPolicyViolationError`. */
export function violationsOf(error: unknown): readonly PasswordViolation[] {
  const violations = errorDetailsOf(error)['violations'];

  if (!Array.isArray(violations)) {
    return [];
  }

  return violations.filter(
    (violation): violation is PasswordViolation =>
      typeof violation === 'object' &&
      violation !== null &&
      typeof (violation as Record<string, unknown>)['rule'] === 'string' &&
      typeof (violation as Record<string, unknown>)['message'] === 'string',
  );
}

/**
 * Translates a rule (`errors.password.<rule>`) into the active language and
 * falls back to the precise message sent by the API when there is no
 * translation for it.
 */
export function violationLabel(transloco: TranslocoService, violation: PasswordViolation): string {
  const key = `errors.password.${violation.rule}`;
  const translated = transloco.translate(key);

  return translated === '' || translated === key ? violation.message : translated;
}
