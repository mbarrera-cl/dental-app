import { Injectable } from '@nestjs/common';
import type { Principal } from '../../../../shared/security/principal.js';
import { ListActivitiesUseCase } from '../../../activity/application/use-cases/list-activities.use-case.js';
import type { ActivityOutcome } from '../../../activity/domain/activity-entry.js';

export interface ActivityListInput {
  limit: number;
  module?: string;
  outcome?: ActivityOutcome;
  from?: string;
  to?: string;
}

/** MCP-facing reader of the platform activity trail, scoped by permission. */
@Injectable()
export class ActivityFacade {
  constructor(private readonly listActivities: ListActivitiesUseCase) {}

  async list(input: ActivityListInput, actor: Principal) {
    const canReadAll = actor.permissions.has('activity:read-all');
    const page = await this.listActivities.execute({
      limit: input.limit,
      module: input.module ?? null,
      outcome: input.outcome ?? null,
      from: input.from ?? null,
      to: input.to ?? null,
      scopeActorId: canReadAll ? null : actor.userId,
    });

    return {
      nextCursor: page.nextCursor,
      items: page.items.map((entry) => ({
        at: entry.at,
        actor: {
          name: entry.actor.name,
          email: entry.actor.email,
          type: entry.actor.type,
        },
        action: entry.action,
        module: entry.module,
        subject: entry.subject,
        outcome: entry.outcome,
        statusCode: entry.statusCode,
      })),
    };
  }
}
