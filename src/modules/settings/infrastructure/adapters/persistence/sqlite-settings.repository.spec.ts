import { SqliteDatabase } from '../../../../../shared/infrastructure/database/sqlite-database.js';
import { SqliteSettingsRepository } from './sqlite-settings.repository.js';

describe('SqliteSettingsRepository', () => {
  let database: SqliteDatabase;
  let repository: SqliteSettingsRepository;

  beforeEach(() => {
    database = new SqliteDatabase(':memory:');
    repository = new SqliteSettingsRepository(database);
  });

  afterEach(() => {
    database.onModuleDestroy();
  });

  it('returns an empty record when nothing has been stored', async () => {
    await expect(repository.findAll()).resolves.toEqual({});
  });

  it('round-trips numbers, booleans and strings as JSON', async () => {
    await repository.saveMany({
      'passwordPolicy.minLength': 10,
      'passwordPolicy.requireSymbol': false,
      'some.string': 'value',
    });

    await expect(repository.findAll()).resolves.toEqual({
      'passwordPolicy.minLength': 10,
      'passwordPolicy.requireSymbol': false,
      'some.string': 'value',
    });
  });

  it('upserts existing keys without duplicating rows', async () => {
    await repository.saveMany({ 'passwordPolicy.minLength': 10 });
    await repository.saveMany({ 'passwordPolicy.minLength': 12 });

    const rows = database.connection.prepare('SELECT COUNT(*) AS count FROM settings').get() as unknown as {
      count: number;
    };

    expect(rows.count).toBe(1);
    await expect(repository.findAll()).resolves.toEqual({ 'passwordPolicy.minLength': 12 });
  });
});
