import { describe, expect, it } from 'vitest';
import {
  applyMigrations,
  migrationChecksum,
  type Migration,
  type MigrationQueryable,
} from './migrations.js';

/**
 * In-memory fake of the subset of `pg.PoolClient` the runner uses. Records
 * every statement so the test can assert ordering, transactions and inserts.
 */
class FakeMigrationDb implements MigrationQueryable {
  readonly appliedRows = new Map<string, string | null>();
  readonly statements: string[] = [];
  private inTransaction = false;

  async query(sql: string, params: readonly unknown[] = []): Promise<{ rows: Record<string, unknown>[] }> {
    this.statements.push(sql);

    if (sql === 'SELECT version, checksum FROM schema_migrations') {
      return { rows: [...this.appliedRows.entries()].map(([version, checksum]) => ({ version, checksum })) };
    }

    if (sql === 'BEGIN') {
      this.inTransaction = true;
      return { rows: [] };
    }

    if (sql === 'COMMIT') {
      this.inTransaction = false;
      return { rows: [] };
    }

    if (sql === 'ROLLBACK') {
      this.inTransaction = false;
      return { rows: [] };
    }

    if (sql === 'INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)') {
      this.appliedRows.set(params[0] as string, params[1] as string);
      return { rows: [] };
    }

    // Migration SQL: throw when it contains the magic word to exercise rollback.
    if (sql.includes('__FAIL__')) {
      throw new Error('boom');
    }

    return { rows: [] };
  }
}

const migrationA: Migration = { version: '0001-a', sql: 'CREATE TABLE a (id int)' };
const migrationB: Migration = { version: '0002-b', sql: 'CREATE TABLE b (id int)' };

describe('applyMigrations', () => {
  it('applies pending migrations in order, each in its own transaction', async () => {
    const db = new FakeMigrationDb();
    const applied: string[] = [];

    await applyMigrations(db, [migrationA, migrationB], (v) => applied.push(v));

    expect(applied).toEqual(['0001-a', '0002-b']);
    expect(db.appliedRows.has('0001-a')).toBe(true);
    expect(db.appliedRows.has('0002-b')).toBe(true);
    expect(db.appliedRows.get('0001-a')).toBe(migrationChecksum(migrationA.sql));

    // Each migration ran inside BEGIN/COMMIT.
    const bIndex = db.statements.indexOf('BEGIN');
    expect(bIndex).toBeGreaterThanOrEqual(0);
    expect(db.statements[bIndex + 1]).toBe(migrationA.sql);
  });

  it('skips migrations that are already applied', async () => {
    const db = new FakeMigrationDb();
    db.appliedRows.set('0001-a', migrationChecksum(migrationA.sql));
    const applied: string[] = [];

    await applyMigrations(db, [migrationA, migrationB], (v) => applied.push(v));

    expect(applied).toEqual(['0002-b']);
    expect(db.statements).not.toContain(migrationA.sql);
  });

  it('throws when an applied migration was edited (checksum mismatch)', async () => {
    const db = new FakeMigrationDb();
    db.appliedRows.set('0001-a', 'stale-checksum');

    await expect(applyMigrations(db, [migrationA])).rejects.toThrow(/modified after being applied/);
  });

  it('rolls back and does not record a failing migration', async () => {
    const db = new FakeMigrationDb();
    const failing: Migration = { version: '0001-x', sql: 'CREATE TABLE x (id int); __FAIL__;' };

    await expect(applyMigrations(db, [failing])).rejects.toThrow('boom');
    expect(db.appliedRows.has('0001-x')).toBe(false);
    expect(db.statements).toContain('ROLLBACK');
  });
});
