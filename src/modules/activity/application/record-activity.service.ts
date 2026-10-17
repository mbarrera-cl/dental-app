import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { SettingsService } from '../../settings/application/settings.service.js';
import { ACTIVITY_SETTINGS, ACTIVITY_MODULE_SETTINGS } from '../domain/activity-settings.js';
import type {
  ActivityActorRef,
  ActivityOutcome,
  ActivityRecord,
  ActivitySubject,
} from '../domain/activity-entry.js';
import { ActivityRepositoryPort } from './ports/activity-repository.port.js';

/** What a caller (interceptor, auth controller, purge use case) hands over. */
export interface RecordActivityInput {
  actor: ActivityActorRef;
  /** Stable key, e.g. `patients.create`. */
  action: string;
  /** Owning module; also selects the capture toggle. */
  module: string;
  outcome: ActivityOutcome;
  method: string;
  path: string;
  route?: string | null;
  subject?: ActivitySubject | null;
  statusCode?: number | null;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
}

interface PrivacyFlags {
  ip: boolean;
  userAgent: boolean;
  subjectLabel: boolean;
  metadata: boolean;
}

const MAX_PATH_LENGTH = 512;
const MAX_USER_AGENT_LENGTH = 256;
const MAX_LABEL_LENGTH = 160;
const MAX_METADATA_KEYS = 12;
const MAX_METADATA_STRING = 160;

/**
 * Single write path of the activity trail. Applies the administrator's
 * settings (what to capture and which privacy fields to keep) and is
 * deliberately failure-isolated: an activity that cannot be written is logged
 * and dropped, never propagated to the business request.
 */
@Injectable()
export class ActivityRecorder {
  private readonly logger = new Logger(ActivityRecorder.name);

  constructor(
    private readonly repository: ActivityRepositoryPort,
    private readonly settings: SettingsService,
  ) {}

  /** Returns whether the entry was persisted (useful for tests). */
  async record(input: RecordActivityInput): Promise<boolean> {
    try {
      if (!(await this.shouldRecord(input))) {
        return false;
      }

      const privacy = await this.privacyFlags();

      await this.repository.append(
        buildRecord(input, privacy, sanitizeMetadata(input.metadata ?? {})),
      );

      return true;
    } catch (error) {
      this.logger.warn(
        `Could not record activity "${input.action}": ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      return false;
    }
  }

  private async shouldRecord(input: RecordActivityInput): Promise<boolean> {
    if (!(await this.settings.getBoolean(ACTIVITY_SETTINGS.enabled))) {
      return false;
    }

    // Auth events are written explicitly by the auth adapter and gated by
    // their own toggle so they survive `captureMutations = false`.
    if (input.module === 'auth') {
      return this.settings.getBoolean(ACTIVITY_SETTINGS.captureAuth);
    }

    // MCP calls have their own toggle: they are neither browser mutations nor
    // HTTP reads, and both transports must be auditable.
    if (input.module === 'mcp') {
      return this.settings.getBoolean(ACTIVITY_SETTINGS.captureMcp);
    }

    if (input.outcome === 'failure' && !(await this.settings.getBoolean(ACTIVITY_SETTINGS.captureFailures))) {
      return false;
    }

    const isRead = input.method === 'GET' || input.method === 'HEAD';

    if (isRead) {
      return this.settings.getBoolean(ACTIVITY_SETTINGS.captureClinicalReads);
    }

    if (!(await this.settings.getBoolean(ACTIVITY_SETTINGS.captureMutations))) {
      return false;
    }

    const moduleKey = ACTIVITY_MODULE_SETTINGS[input.module];

    return moduleKey === undefined ? true : this.settings.getBoolean(moduleKey);
  }

  private async privacyFlags(): Promise<PrivacyFlags> {
    const [ip, userAgent, subjectLabel, metadata] = await Promise.all([
      this.settings.getBoolean(ACTIVITY_SETTINGS.privacyIp),
      this.settings.getBoolean(ACTIVITY_SETTINGS.privacyUserAgent),
      this.settings.getBoolean(ACTIVITY_SETTINGS.privacySubjectLabel),
      this.settings.getBoolean(ACTIVITY_SETTINGS.privacyMetadata),
    ]);

    return { ip, userAgent, subjectLabel, metadata };
  }
}

function buildRecord(
  input: RecordActivityInput,
  privacy: PrivacyFlags,
  metadata: Record<string, unknown>,
): ActivityRecord {
  return {
    id: randomUUID(),
    at: new Date().toISOString(),
    actorId: input.actor.id,
    actorType: input.actor.type,
    actorLabel: truncate(input.actor.label ?? null, MAX_LABEL_LENGTH),
    action: input.action,
    module: input.module,
    subjectType: input.subject?.type ?? null,
    subjectId: input.subject?.id ?? null,
    subjectLabel: privacy.subjectLabel
      ? truncate(input.subject?.label ?? null, MAX_LABEL_LENGTH)
      : null,
    outcome: input.outcome,
    statusCode: input.statusCode ?? null,
    method: input.method.toUpperCase(),
    path: truncate(input.path, MAX_PATH_LENGTH) ?? '',
    route: truncate(input.route ?? null, MAX_PATH_LENGTH),
    ip: privacy.ip ? (input.ip ?? null) : null,
    userAgent: privacy.userAgent ? truncate(input.userAgent ?? null, MAX_USER_AGENT_LENGTH) : null,
    metadata: privacy.metadata ? metadata : {},
  };
}

function truncate(value: string | null, max: number): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

/** Keeps only small primitives; never stores bodies, tokens or clinical values. */
function sanitizeMetadata(input: Record<string, unknown>): Record<string, unknown> {
  const output: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input).slice(0, MAX_METADATA_KEYS)) {
    if (value === null || typeof value === 'boolean' || typeof value === 'number') {
      output[key] = value;
      continue;
    }

    if (typeof value === 'string') {
      output[key] = truncate(value, MAX_METADATA_STRING);
    }
  }

  return output;
}
