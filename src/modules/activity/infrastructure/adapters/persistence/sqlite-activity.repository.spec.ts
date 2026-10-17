import { SqliteDatabase } from '../../../../../shared/infrastructure/database/sqlite-database.js';
import type { ActivityRecord } from '../../../domain/activity-entry.js';
import { SqliteActivityRepository } from './sqlite-activity.repository.js';

const BASE: Omit<ActivityRecord, 'id' | 'at' | 'action' | 'module' | 'subjectId'> = {
  actorId: 'user-1',
  actorType: 'user',
  actorLabel: null,
  subjectType: null,
  subjectLabel: null,
  outcome: 'success',
  statusCode: 201,
  method: 'POST',
  path: '/patients',
  route: '/patients',
  ip: '127.0.0.1',
  userAgent: 'vitest',
  metadata: {},
};

function record(overrides: Partial<ActivityRecord> & Pick<ActivityRecord, 'id' | 'at'>): ActivityRecord {
  return {
    ...BASE,
    action: 'patients.create',
    module: 'patients',
    subjectId: null,
    ...overrides,
  };
}

describe('SqliteActivityRepository', () => {
  let database: SqliteDatabase;
  let repository: SqliteActivityRepository;

  beforeEach(() => {
    database = new SqliteDatabase(':memory:');
    repository = new SqliteActivityRepository(database);

    database.connection
      .prepare('INSERT INTO users (id, email, name, created_at) VALUES (?, ?, ?, ?)')
      .run('user-1', 'ana@example.com', 'Ana Pérez', new Date().toISOString());
  });

  afterEach(() => {
    database.onModuleDestroy();
  });

  it('appends and reads entries newest first, resolving the actor', async () => {
    await repository.append(record({ id: 'a', at: '2026-10-17T10:00:00.000Z' }));
    await repository.append(record({ id: 'b', at: '2026-10-17T11:00:00.000Z' }));

    const entries = await repository.list({
      limit: 10,
      cursor: null,
      action: null,
      module: null,
      actorId: null,
      from: null,
      to: null,
      subjectType: null,
      subjectId: null,
      outcome: null,
    });

    expect(entries.map((entry) => entry.id)).toEqual(['b', 'a']);
    expect(entries[0]?.actor).toMatchObject({
      id: 'user-1',
      type: 'user',
      name: 'Ana Pérez',
      email: 'ana@example.com',
    });
  });

  it('filters by module, actor, outcome and subject', async () => {
    await repository.append(record({ id: 'a', at: '2026-10-17T10:00:00.000Z' }));
    await repository.append(
      record({
        id: 'b',
        at: '2026-10-17T11:00:00.000Z',
        actorId: 'user-2',
        action: 'clinical.read',
        module: 'clinical',
        outcome: 'failure',
        subjectType: 'patient',
        subjectId: 'patient-1',
      }),
    );

    const base = {
      limit: 10,
      cursor: null,
      action: null,
      module: null,
      actorId: null,
      from: null,
      to: null,
      subjectType: null,
      subjectId: null,
      outcome: null,
    } as const;

    await expect(repository.list({ ...base, module: 'clinical' })).resolves.toHaveLength(1);
    await expect(repository.list({ ...base, actorId: 'user-2' })).resolves.toHaveLength(1);
    await expect(repository.list({ ...base, outcome: 'failure' })).resolves.toHaveLength(1);
    await expect(repository.list({ ...base, subjectType: 'patient' })).resolves.toHaveLength(1);
    await expect(repository.list({ ...base, action: 'patients.create' })).resolves.toHaveLength(1);
  });

  it('paginates with a keyset cursor without repeating rows', async () => {
    await repository.append(record({ id: 'a', at: '2026-10-17T10:00:00.000Z' }));
    await repository.append(record({ id: 'b', at: '2026-10-17T11:00:00.000Z' }));
    await repository.append(record({ id: 'c', at: '2026-10-17T12:00:00.000Z' }));

    const filter = {
      limit: 2,
      cursor: null,
      action: null,
      module: null,
      actorId: null,
      from: null,
      to: null,
      subjectType: null,
      subjectId: null,
      outcome: null,
    } as const;

    const first = await repository.list(filter);
    expect(first.map((entry) => entry.id)).toEqual(['c', 'b']);

    const cursor = Buffer.from('2026-10-17T11:00:00.000Z|b', 'utf8').toString('base64url');
    const second = await repository.list({ ...filter, cursor });
    expect(second.map((entry) => entry.id)).toEqual(['a']);
  });

  it('counts and purges by cutoff date', async () => {
    await repository.append(record({ id: 'old', at: '2025-01-01T00:00:00.000Z' }));
    await repository.append(record({ id: 'new', at: '2026-10-17T00:00:00.000Z' }));

    await expect(repository.count({ all: false, before: '2026-01-01T00:00:00.000Z' })).resolves.toBe(1);
    await expect(repository.purge({ all: false, before: '2026-01-01T00:00:00.000Z' })).resolves.toBe(1);
    await expect(repository.count({ all: false, before: '2026-01-01T00:00:00.000Z' })).resolves.toBe(0);
  });

  it('purges every row when scope is all', async () => {
    await repository.append(record({ id: 'a', at: '2026-10-17T10:00:00.000Z' }));
    await repository.append(record({ id: 'b', at: '2026-10-17T11:00:00.000Z' }));

    await expect(repository.purge({ all: true, before: null })).resolves.toBe(2);
    await expect(repository.count({ all: true, before: null })).resolves.toBe(0);
  });
});
