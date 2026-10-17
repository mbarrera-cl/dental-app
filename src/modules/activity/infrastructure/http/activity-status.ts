import { DomainError, type DomainErrorKind } from '../../../../shared/domain/domain-error.js';

const STATUS_BY_DOMAIN_KIND: Record<DomainErrorKind, number> = {
  validation: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  locked: 423,
  unsupported_media: 415,
  unexpected: 500,
};

/**
 * Best-effort HTTP status of a thrown error. Nest's `HttpException` exposes
 * `getStatus()`; domain errors are mapped through their kind. Anything else
 * is reported as `null` (unknown) instead of guessing 500: the audit trail
 * must not invent outcomes.
 */
export function activityStatusOf(error: unknown): number | null {
  if (error instanceof DomainError) {
    return STATUS_BY_DOMAIN_KIND[error.kind];
  }

  if (typeof error === 'object' && error !== null && 'getStatus' in error) {
    const getStatus = (error as { getStatus?: unknown }).getStatus;

    if (typeof getStatus === 'function') {
      const status = (getStatus as () => unknown).call(error);

      return typeof status === 'number' ? status : null;
    }
  }

  return null;
}
