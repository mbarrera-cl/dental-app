import { SqliteDatabase } from '../../../../../shared/infrastructure/database/sqlite-database.js';
import { SqliteSettingsAuditRepository } from './sqlite-settings-audit.repository.js';

describe('SqliteSettingsAuditRepository', () => {
  let database: SqliteDatabase;
  let repository: SqliteSettingsAuditRepository;

  beforeEach(() => {
    database = new SqliteDatabase(':memory:');
    repository = new SqliteSettingsAuditRepository(database);

    database.connection
      .prepare('INSERT INTO users (id, email, name, created_at) VALUES (?, ?, ?, ?)')
      .run('user-1', 'admin@hexa.local', 'Admin', '2026-01-01T00:00:00.000Z');
  });

  afterEach(() => {
    database.onModuleDestroy();
  });

  it('round-trips entries with their JSON changes', async () => {
    await repository.append({
      at: '2026-10-16T12:00:00.000Z',
      actorId: 'user-1',
      actorType: 'user',
      changes: [{ key: 'clinic.name', from: 'A', to: 'B' }],
    });

    const [entry] = await repository.list(10);

    expect(entry).toMatchObject({
      at: '2026-10-16T12:00:00.000Z',
      actorId: 'user-1',
      actorType: 'user',
      actorEmail: 'admin@hexa.local',
      changes: [{ key: 'clinic.name', from: 'A', to: 'B' }],
    });
    expect(entry!.id).toBeTruthy();
  });

  it('returns the newest first and respects the limit', async () => {
    await repository.append({
      at: '2026-10-16T10:00:00.000Z',
      actorId: 'user-1',
      actorType: 'user',
      changes: [{ key: 'clinic.slogan', from: null, to: 'Antigua' }],
    });
    await repository.append({
      at: '2026-10-16T12:00:00.000Z',
      actorId: 'user-1',
      actorType: 'user',
      changes: [{ key: 'clinic.slogan', from: 'Antigua', to: 'Nueva' }],
    });

    const entries = await repository.list(1);

    expect(entries).toHaveLength(1);
    expect(entries[0]!.changes).toEqual([{ key: 'clinic.slogan', from: 'Antigua', to: 'Nueva' }]);
  });

  it('leaves the email null for api keys or deleted users', async () => {
    await repository.append({
      at: '2026-10-16T12:00:00.000Z',
      actorId: 'key-9',
      actorType: 'apikey',
      changes: [{ key: 'clinic.theme.mode', from: 'light', to: 'auto' }],
    });

    const [entry] = await repository.list(10);

    expect(entry).toMatchObject({ actorType: 'apikey', actorEmail: null });
  });
});
