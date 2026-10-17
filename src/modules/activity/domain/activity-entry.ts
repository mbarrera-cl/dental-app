/** Who produced an activity entry. */
export type ActivityActorType = 'user' | 'apikey' | 'system' | 'anonymous';

/** Whether the recorded request succeeded or was rejected. */
export type ActivityOutcome = 'success' | 'failure';

/** Actor as captured at write time (no account data is duplicated). */
export interface ActivityActorRef {
  id: string | null;
  type: ActivityActorType;
  /**
   * Snapshot label for actors with no account (a failed login carries the
   * attempted email) or API keys. `null` for regular users: their name and
   * email are resolved at read time from `users`.
   */
  label?: string | null;
}

/** Actor as returned by the API: account data resolved at read time. */
export interface ActivityActor {
  id: string | null;
  type: ActivityActorType;
  name: string | null;
  email: string | null;
}

/** The entity an action was performed on (patient, user, role, …). */
export interface ActivitySubject {
  type: string | null;
  id: string | null;
  label: string | null;
}

/** A persisted activity entry. */
export interface ActivityEntry {
  id: string;
  /** ISO-8601 UTC timestamp. */
  at: string;
  actor: ActivityActor;
  /** Stable action key, e.g. `patients.create`. */
  action: string;
  /** Owning module, e.g. `patients`; drives the capture toggles. */
  module: string;
  subject: ActivitySubject;
  outcome: ActivityOutcome;
  statusCode: number | null;
  method: string;
  path: string;
  route: string | null;
  ip: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown>;
}

/** Row about to be persisted (the repository only stores ids, never names). */
export interface ActivityRecord {
  id: string;
  at: string;
  actorId: string | null;
  actorType: ActivityActorType;
  actorLabel: string | null;
  action: string;
  module: string;
  subjectType: string | null;
  subjectId: string | null;
  subjectLabel: string | null;
  outcome: ActivityOutcome;
  statusCode: number | null;
  method: string;
  path: string;
  route: string | null;
  ip: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown>;
}

/** Every filter the list endpoint accepts. `null` means “no filter”. */
export interface ActivityFilter {
  limit: number;
  cursor: string | null;
  action: string | null;
  module: string | null;
  actorId: string | null;
  from: string | null;
  to: string | null;
  subjectType: string | null;
  subjectId: string | null;
  outcome: ActivityOutcome | null;
}

/** Bulk-delete scope. `all` wins over `before`. */
export interface ActivityPurgeFilter {
  all: boolean;
  before: string | null;
}

export interface ActivityPage {
  items: ActivityEntry[];
  nextCursor: string | null;
}

export const DEFAULT_ACTIVITY_LIMIT = 20;
export const MAX_ACTIVITY_LIMIT = 100;

/**
 * Keyset cursor: `at` plus `id` keeps pagination stable when several entries
 * share the same millisecond.
 */
export function encodeActivityCursor(entry: Pick<ActivityEntry, 'at' | 'id'>): string {
  return Buffer.from(`${entry.at}|${entry.id}`, 'utf8').toString('base64url');
}

export function decodeActivityCursor(cursor: string): { at: string; id: string } | null {
  try {
    const [at, id] = Buffer.from(cursor, 'base64url').toString('utf8').split('|');

    return at !== undefined && at !== '' && id !== undefined && id !== ''
      ? { at, id }
      : null;
  } catch {
    return null;
  }
}

/** Clamps the `limit` query parameter to the accepted range. */
export function normalizeActivityLimit(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) {
    return DEFAULT_ACTIVITY_LIMIT;
  }

  return Math.min(MAX_ACTIVITY_LIMIT, Math.max(1, Math.trunc(value)));
}
