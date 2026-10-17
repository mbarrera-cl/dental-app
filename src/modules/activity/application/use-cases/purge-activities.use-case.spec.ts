import { ActivityRepositoryPort } from '../ports/activity-repository.port.js';
import type {
  ActivityEntry,
  ActivityFilter,
  ActivityPurgeFilter,
  ActivityRecord,
} from '../../domain/activity-entry.js';
import { ActivityPurgeDateError, ActivityPurgeScopeError } from '../../domain/activity.errors.js';
import { PurgeActivitiesUseCase } from './purge-activities.use-case.js';

class FakeRepository extends ActivityRepositoryPort {
  records: ActivityRecord[] = [];

  async append(record: ActivityRecord): Promise<void> {
    this.records.push(record);
  }

  async list(_filter: ActivityFilter): Promise<ActivityEntry[]> {
    return [];
  }

  async count(filter: ActivityPurgeFilter): Promise<number> {
    return this.records.filter((entry) => filter.all || (filter.before !== null && entry.at < filter.before))
      .length;
  }

  async purge(filter: ActivityPurgeFilter): Promise<number> {
    const before = filter.all ? null : filter.before;
    const removed = this.records.filter((entry) => before === null || entry.at < before);

    this.records = this.records.filter((entry) => !removed.includes(entry));

    return removed.length;
  }
}

const actor = { id: 'user-1', type: 'user' as const };

describe('PurgeActivitiesUseCase', () => {
  it('requires a scope', async () => {
    const useCase = new PurgeActivitiesUseCase(new FakeRepository());

    await expect(
      useCase.execute({ all: false, before: null, actor }),
    ).rejects.toBeInstanceOf(ActivityPurgeScopeError);
  });

  it('rejects an invalid cutoff date', async () => {
    const useCase = new PurgeActivitiesUseCase(new FakeRepository());

    await expect(
      useCase.execute({ all: false, before: 'not-a-date', actor }),
    ).rejects.toBeInstanceOf(ActivityPurgeDateError);
  });

  it('purges by cutoff and audits the operation', async () => {
    const repository = new FakeRepository();
    const useCase = new PurgeActivitiesUseCase(repository);

    await repository.append({
      id: 'old',
      at: '2025-01-01T00:00:00.000Z',
      actorId: null,
      actorType: 'system',
      actorLabel: null,
      action: 'patients.create',
      module: 'patients',
      subjectType: null,
      subjectId: null,
      subjectLabel: null,
      outcome: 'success',
      statusCode: 201,
      method: 'POST',
      path: '/patients',
      route: '/patients',
      ip: null,
      userAgent: null,
      metadata: {},
    });

    await expect(
      useCase.execute({
        all: false,
        before: '2026-01-01T00:00:00.000Z',
        actor,
        reason: 'retention',
      }),
    ).resolves.toMatchObject({ deleted: 1 });

    expect(repository.records).toHaveLength(1);
    expect(repository.records[0]).toMatchObject({
      action: 'activity.purge',
      actorId: 'user-1',
      outcome: 'success',
      metadata: { mode: 'before', reason: 'retention' },
    });
  });

  it('previews the number of affected rows', async () => {
    const repository = new FakeRepository();
    repository.records = [
      {
        id: 'old',
        at: '2025-01-01T00:00:00.000Z',
        actorId: null,
        actorType: 'system',
        actorLabel: null,
        action: 'patients.create',
        module: 'patients',
        subjectType: null,
        subjectId: null,
        subjectLabel: null,
        outcome: 'success',
        statusCode: 201,
        method: 'POST',
        path: '/patients',
        route: '/patients',
        ip: null,
        userAgent: null,
        metadata: {},
      },
    ];

    const useCase = new PurgeActivitiesUseCase(repository);

    await expect(
      useCase.preview({ all: false, before: '2026-01-01T00:00:00.000Z' }),
    ).resolves.toBe(1);
  });
});
