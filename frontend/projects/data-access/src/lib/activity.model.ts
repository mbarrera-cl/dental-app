/**
 * Platform activity trail (`GET /activity`). Mirrors
 * `activity-entry.response.dto.ts` on the backend.
 */
export type ActivityActorType = 'user' | 'apikey' | 'system' | 'anonymous';
export type ActivityOutcome = 'success' | 'failure';

export interface ActivityActor {
  id: string | null;
  type: ActivityActorType;
  name: string | null;
  email: string | null;
}

export interface ActivitySubject {
  type: string | null;
  id: string | null;
  label: string | null;
}

export interface ActivityEntry {
  id: string;
  /** ISO-8601 UTC timestamp. */
  at: string;
  actor: ActivityActor;
  /** Stable action key, e.g. `patients.create`. */
  action: string;
  /** Owning module, e.g. `patients`. */
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

/** Panel-related settings exposed to every authenticated user. */
export interface ActivityPanelConfig {
  enabled: boolean;
  panelLimit: number;
  refreshSeconds: number;
  badge: boolean;
}

export interface ActivityPage {
  config: ActivityPanelConfig;
  items: ActivityEntry[];
  nextCursor: string | null;
}

/** Filters accepted by `GET /activity`. */
export interface ActivityQuery {
  limit?: number;
  cursor?: string;
  action?: string;
  module?: string;
  actorId?: string;
  from?: string;
  to?: string;
  subjectType?: string;
  subjectId?: string;
  outcome?: ActivityOutcome;
}

export interface ActivityPurgeQuery {
  all?: boolean;
  before?: string;
}

export interface ActivityPurgePreview {
  count: number;
}

export interface ActivityPurgeResult {
  deleted: number;
  at: string;
}

/** Modules the admin can toggle (mirrors `ACTIVITY_MODULE_SETTINGS`). */
export const ACTIVITY_MODULES = [
  'auth',
  'patients',
  'clinical',
  'users',
  'roles',
  'settings',
  'navigation',
  'clinic',
  'apikeys',
  'mcp',
] as const;

export type ActivityModule = (typeof ACTIVITY_MODULES)[number];

export const DEFAULT_ACTIVITY_CONFIG: ActivityPanelConfig = {
  enabled: true,
  panelLimit: 20,
  refreshSeconds: 60,
  badge: true,
};
