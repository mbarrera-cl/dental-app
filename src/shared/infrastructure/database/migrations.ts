import { createHash } from 'node:crypto';

/**
 * Versioned schema migrations.
 *
 * `POSTGRES_SCHEMA_SQL` is the idempotent *baseline* (it recreates the whole
 * schema on a fresh database). Anything that must *change* an existing table
 * on an already-populated database goes here, as an ordered migration.
 *
 * The runner (`applyMigrations`, wired from `PostgresDatabase.ensureSchema`)
 * applies each pending migration inside its own transaction and records it in
 * `schema_migrations` together with a SHA-256 checksum of the SQL, so an edit
 * to an already-applied migration is detected instead of silently ignored.
 *
 * To add a migration: append an entry to `MIGRATIONS` with a unique, ordered
 * `version` (ISO date + slug is a good convention, e.g. `2026-10-integrity-hash`).
 * Never reorder or edit an entry that has already been deployed.
 */

export interface Migration {
  /** Unique, ordered identifier. Applied rows are keyed by this value. */
  version: string;
  /** Raw SQL. May contain several statements; runs in a single transaction. */
  sql: string;
}

export const MIGRATIONS: readonly Migration[] = [];

/** SHA-256 of a migration's SQL, used to detect post-apply edits. */
export function migrationChecksum(sql: string): string {
  return createHash('sha256').update(sql).digest('hex');
}

/** Minimal subset of `pg.PoolClient` the runner needs (keeps it unit-testable). */
export interface MigrationQueryable {
  query(
    sql: string,
    params?: readonly unknown[],
  ): Promise<{ rows: ReadonlyArray<Record<string, unknown>> }>;
}

/**
 * Applies every migration in `migrations` that has not been recorded yet, in
 * order, each in its own transaction. Already-applied migrations are skipped
 * (their checksum is verified). Throws if an applied migration was edited.
 */
export async function applyMigrations(
  db: MigrationQueryable,
  migrations: readonly Migration[] = MIGRATIONS,
  onApplied?: (version: string) => void,
): Promise<void> {
  const { rows } = await db.query('SELECT version, checksum FROM schema_migrations');

  const applied = new Map<string, string | null>(
    rows.map((row) => [row.version as string, (row.checksum as string | null) ?? null]),
  );

  for (const migration of migrations) {
    const hash = migrationChecksum(migration.sql);
    const existing = applied.get(migration.version);

    if (existing !== undefined) {
      if (existing !== null && existing !== hash) {
        throw new Error(
          `Migration "${migration.version}" was modified after being applied; refusing to start`,
        );
      }

      continue;
    }

    await db.query('BEGIN');

    try {
      await db.query(migration.sql);
      await db.query('INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)', [
        migration.version,
        hash,
      ]);
      await db.query('COMMIT');
      onApplied?.(migration.version);
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  }
}
