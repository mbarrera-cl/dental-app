import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ActivityPurgeScopeError, ActivityPurgeDateError } from '../../domain/activity.errors.js';
import type { ActivityActorRef } from '../../domain/activity-entry.js';
import { ActivityRepositoryPort } from '../ports/activity-repository.port.js';

export interface PurgeActivitiesInput {
  /** Delete every entry (mutually exclusive with `before`). */
  all: boolean;
  /** Delete entries strictly older than this ISO-8601 instant. */
  before: string | null;
  actor: ActivityActorRef;
  ip?: string | null;
  userAgent?: string | null;
  /** Distinguishes the administrator action from the scheduled retention. */
  reason?: 'manual' | 'retention' | 'bootstrap';
}

export interface PurgeActivitiesResult {
  deleted: number;
  at: string;
}

export interface PreviewPurgeActivitiesInput {
  all: boolean;
  before: string | null;
}

/**
 * Destructive, permission-guarded cleanup. The purge itself is appended to
 * the trail **after** deleting, so the audit entry survives its own scope
 * (including `all: true`).
 */
@Injectable()
export class PurgeActivitiesUseCase {
  constructor(private readonly repository: ActivityRepositoryPort) {}

  /** Rows the purge would remove; used by the confirmation dialog. */
  async preview(input: PreviewPurgeActivitiesInput): Promise<number> {
    const before = resolveScope(input);

    return this.repository.count({ all: input.all, before });
  }

  async execute(input: PurgeActivitiesInput): Promise<PurgeActivitiesResult> {
    const before = resolveScope(input);
    const at = new Date().toISOString();
    const deleted = await this.repository.purge({ all: input.all, before });

    await this.repository.append({
      id: randomUUID(),
      at,
      actorId: input.actor.id,
      actorType: input.actor.type,
      actorLabel: input.actor.label ?? null,
      action: 'activity.purge',
      module: 'activity',
      subjectType: 'activity-log',
      subjectId: null,
      subjectLabel: null,
      outcome: 'success',
      statusCode: 200,
      method: 'POST',
      path: '/activity/purge',
      route: '/activity/purge',
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
      metadata: {
        deleted,
        mode: input.all ? 'all' : 'before',
        before,
        reason: input.reason ?? 'manual',
      },
    });

    return { deleted, at };
  }
}

function resolveScope(input: PreviewPurgeActivitiesInput): string | null {
  if (input.all) {
    return null;
  }

  if (input.before === null || input.before.trim() === '') {
    throw new ActivityPurgeScopeError();
  }

  return normalizeDate(input.before);
}

function normalizeDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new ActivityPurgeDateError(value);
  }

  return date.toISOString();
}
