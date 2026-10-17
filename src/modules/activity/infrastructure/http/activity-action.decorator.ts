import { SetMetadata } from '@nestjs/common';

/** Metadata keys read by `ActivityInterceptor`. */
export const ACTIVITY_ACTION_METADATA = 'activity:action';
export const ACTIVITY_SKIP_METADATA = 'activity:skip';

/**
 * Declares how a mutating endpoint appears in the activity trail.
 *
 * ```ts
 * @ActivityAction({ action: 'patients.create', subjectType: 'patient', subjectLabel: personNameLabel })
 * @Post()
 * ```
 *
 * The interceptor records the entry after the handler runs; the decorator only
 * supplies the stable action key and, when cheaply available, the subject.
 */
export interface ActivityActionOptions {
  /** Stable key, e.g. `patients.create`. Its prefix is the default module. */
  action: string;
  /** Owning module (used by the capture toggles); defaults to the key prefix. */
  module?: string;
  /** Subject kind stored in `subject_type`, e.g. `patient`. */
  subjectType?: string;
  /** Route parameter that carries the subject id, e.g. `patientId` or `id`. */
  subjectParam?: string;
  /**
   * Optional short label extracted from the request body (a full name). It is
   * truncated and only stored when `activity.privacySubjectLabel` is on.
   */
  subjectLabel?: (body: unknown) => string | null;
}

/** Marks a handler as an activity; required for reads we do want to audit. */
export const ActivityAction = (options: ActivityActionOptions): MethodDecorator =>
  SetMetadata(ACTIVITY_ACTION_METADATA, {
    ...options,
    module: options.module ?? options.action.split('.')[0],
  });

/**
 * Excludes a controller or handler from the automatic trail. Auth endpoints
 * use it because they record their events explicitly (including failures,
 * which need the attempted email).
 */
export const ActivitySkip = (): ClassDecorator & MethodDecorator =>
  SetMetadata(ACTIVITY_SKIP_METADATA, true);

/**
 * Best-effort label for a person-shaped body: patients use `nombres` +
 * `apellidoPaterno`, users and roles use `name`.
 */
export function personNameLabel(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) {
    return null;
  }

  const values = body as Record<string, unknown>;
  const parts = [values['nombres'], values['apellidoPaterno'], values['name']]
    .filter((part): part is string => typeof part === 'string' && part.trim() !== '')
    .map((part) => part.trim());

  return parts.length === 0 ? null : parts.join(' ');
}
