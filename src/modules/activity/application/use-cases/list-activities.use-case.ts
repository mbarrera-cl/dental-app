import { Injectable } from '@nestjs/common';
import { ActivityRepositoryPort } from '../ports/activity-repository.port.js';
import {
  encodeActivityCursor,
  normalizeActivityLimit,
  type ActivityOutcome,
  type ActivityPage,
} from '../../domain/activity-entry.js';

export interface ListActivitiesInput {
  limit?: number;
  cursor?: string | null;
  action?: string | null;
  module?: string | null;
  actorId?: string | null;
  from?: string | null;
  to?: string | null;
  subjectType?: string | null;
  subjectId?: string | null;
  outcome?: ActivityOutcome | null;
  /**
   * Forced actor scope for callers without `activity:read-all`; `null` means
   * “everyone” (permission already checked by the controller).
   */
  scopeActorId?: string | null;
}

/**
 * Reads the trail newest-first with keyset pagination. The repository fetches
 * one extra row so we can tell whether another page exists without a COUNT.
 */
@Injectable()
export class ListActivitiesUseCase {
  constructor(private readonly repository: ActivityRepositoryPort) {}

  async execute(input: ListActivitiesInput): Promise<ActivityPage> {
    const limit = normalizeActivityLimit(input.limit);
    const rows = await this.repository.list({
      limit: limit + 1,
      cursor: input.cursor ?? null,
      action: input.action ?? null,
      module: input.module ?? null,
      actorId: input.scopeActorId ?? input.actorId ?? null,
      from: input.from ?? null,
      to: input.to ?? null,
      subjectType: input.subjectType ?? null,
      subjectId: input.subjectId ?? null,
      outcome: input.outcome ?? null,
    });

    const items = rows.slice(0, limit);
    const last = items.at(-1);

    return {
      items,
      nextCursor: rows.length > limit && last !== undefined ? encodeActivityCursor(last) : null,
    };
  }
}
