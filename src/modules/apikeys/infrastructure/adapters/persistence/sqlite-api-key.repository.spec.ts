import { SqliteDatabase } from '../../../../../shared/infrastructure/database/sqlite-database.js';
import { ApiKey } from '../../../domain/api-key.entity.js';
import { ApiKeyNotFoundError } from '../../../domain/api-key.errors.js';
import { SqliteApiKeyRepository } from './sqlite-api-key.repository.js';

describe('SqliteApiKeyRepository', () => {
  let database: SqliteDatabase;
  let repository: SqliteApiKeyRepository;
  const ownerId = 'user-1';

  beforeEach(() => {
    database = new SqliteDatabase(':memory:');
    repository = new SqliteApiKeyRepository(database);
    database.connection
      .prepare('INSERT INTO users (id, email, name, created_at) VALUES (?, ?, ?, ?)')
      .run(ownerId, 'ada@example.com', 'Ada Lovelace', new Date().toISOString());
  });

  afterEach(() => {
    database.onModuleDestroy();
  });

  const makeKey = (overrides: Partial<Parameters<typeof ApiKey.create>[0]> = {}) =>
    ApiKey.create({
      userId: ownerId,
      name: 'CI pipeline',
      prefix: 'hexa_ab12cd34',
      keyHash: 'a'.repeat(64),
      ...overrides,
    });

  it('saves a key and reconstitutes it from the database', async () => {
    const key = makeKey({
      scopes: ['dashboard:read', 'users:read'],
      expiresAt: new Date('2027-01-01T00:00:00.000Z'),
    });

    await repository.save(key);
    const found = await repository.findById(key.id);

    expect(found).not.toBeNull();
    expect(found?.id).toBe(key.id);
    expect(found?.userId).toBe(ownerId);
    expect(found?.name).toBe('CI pipeline');
    expect(found?.prefix).toBe('hexa_ab12cd34');
    expect(found?.keyHash).toBe('a'.repeat(64));
    expect(found?.scopes).toEqual(['dashboard:read', 'users:read']);
    expect(found?.expiresAt).toEqual(new Date('2027-01-01T00:00:00.000Z'));
    expect(found?.lastUsedAt).toBeNull();
    expect(found?.revokedAt).toBeNull();
    expect(found?.createdAt).toEqual(key.createdAt);
  });

  it('keeps null scopes and null expiration round-tripping', async () => {
    const key = makeKey();
    await repository.save(key);

    const found = await repository.findById(key.id);

    expect(found?.scopes).toBeNull();
    expect(found?.expiresAt).toBeNull();
  });

  it('finds keys by hash (the hot path of X-Api-Key requests)', async () => {
    const key = makeKey();
    await repository.save(key);

    await expect(repository.findByHash('a'.repeat(64))).resolves.toMatchObject({ id: key.id });
    await expect(repository.findByHash('b'.repeat(64))).resolves.toBeNull();
  });

  it('lists every key or only one user\u2019s keys', async () => {
    database.connection
      .prepare('INSERT INTO users (id, email, name, created_at) VALUES (?, ?, ?, ?)')
      .run('user-2', 'grace@example.com', 'Grace Hopper', new Date().toISOString());

    await repository.save(makeKey({ name: 'One' }));
    await repository.save(makeKey({ name: 'Two', keyHash: 'b'.repeat(64) }));
    await repository.save(
      makeKey({ name: 'Three', userId: 'user-2', keyHash: 'c'.repeat(64) }),
    );

    await expect(repository.findAll()).resolves.toHaveLength(3);
    const mine = await repository.findByUser(ownerId);
    expect(mine.map((key) => key.name).sort()).toEqual(['One', 'Two']);
  });

  it('counts only active keys: revoked and expired ones do not count', async () => {
    const now = new Date('2026-10-16T12:00:00.000Z');
    const alive = makeKey({ name: 'Alive' });
    const revoked = makeKey({ name: 'Revoked', keyHash: 'b'.repeat(64) });
    const expired = makeKey({
      name: 'Expired',
      keyHash: 'c'.repeat(64),
      expiresAt: new Date('2026-10-16T11:00:00.000Z'),
    });

    revoked.revoke(now);

    await repository.save(alive);
    await repository.save(revoked);
    await repository.save(expired);

    await expect(repository.countActiveByUser(ownerId, now)).resolves.toBe(1);
  });

  it('persists rotations, usage and revocations through update', async () => {
    const key = makeKey();
    await repository.save(key);

    key.rotateSecret('hexa_ffffffff', 'd'.repeat(64));
    key.touch(new Date('2026-10-16T10:00:00.000Z'));
    await repository.update(key);

    let found = await repository.findById(key.id);
    expect(found?.prefix).toBe('hexa_ffffffff');
    expect(found?.keyHash).toBe('d'.repeat(64));
    expect(found?.lastUsedAt).toEqual(new Date('2026-10-16T10:00:00.000Z'));

    found!.revoke(new Date('2026-10-16T11:00:00.000Z'));
    await repository.update(found!);

    found = await repository.findById(key.id);
    expect(found?.isRevoked).toBe(true);
    expect(found?.revokedAt).toEqual(new Date('2026-10-16T11:00:00.000Z'));
  });

  it('throws ApiKeyNotFoundError when updating a missing key', async () => {
    await expect(repository.update(makeKey())).rejects.toThrow(ApiKeyNotFoundError);
  });
});
