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

export const MIGRATIONS: readonly Migration[] = [
  {
    version: '2026-10-clinical-integrity-hash',
    sql: 'ALTER TABLE clinical_records ADD COLUMN IF NOT EXISTS integrity_hash TEXT;',
  },
  {
    version: '2026-10-treatment-plans',
    sql: `CREATE TABLE IF NOT EXISTS treatment_plans (
  id         UUID PRIMARY KEY,
  record_id  UUID NOT NULL UNIQUE REFERENCES clinical_records(id) ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS treatment_plan_items (
  id                UUID PRIMARY KEY,
  plan_id           UUID NOT NULL REFERENCES treatment_plans(id) ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE,
  tooth             INTEGER,
  procedure         TEXT NOT NULL,
  uco_code          TEXT REFERENCES uco_procedures(code) ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE,
  status            TEXT NOT NULL DEFAULT 'planificado',
  notes             TEXT,
  position          INTEGER NOT NULL DEFAULT 0,
  created_by        UUID REFERENCES users(id) ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE,
  updated_by        UUID REFERENCES users(id) ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE,
  created_at        TIMESTAMPTZ NOT NULL,
  updated_at        TIMESTAMPTZ NOT NULL,
  status_changed_at TIMESTAMPTZ,
  status_changed_by UUID REFERENCES users(id) ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE
);
CREATE INDEX IF NOT EXISTS idx_treatment_plan_items_plan ON treatment_plan_items (plan_id, position);`,
  },
  {
    version: '2026-10-treatment-plan-item-status',
    sql: `ALTER TABLE treatment_plan_items ADD COLUMN IF NOT EXISTS realizado_at TIMESTAMPTZ;
ALTER TABLE treatment_plan_items ADD COLUMN IF NOT EXISTS realizado_by UUID REFERENCES users(id) ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE treatment_plan_items ALTER COLUMN status SET DEFAULT 'pendiente';
UPDATE treatment_plan_items SET status = 'pendiente' WHERE status IN ('planificado', 'en-ejecucion');`,
  },
  {
    version: '2026-10-treatment-plan-item-soft-delete',
    sql: `ALTER TABLE treatment_plan_items ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE treatment_plan_items ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id) ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE treatment_plan_items ADD COLUMN IF NOT EXISTS deleted_reason TEXT;`,
  },
  {
    version: '2026-10-treatment-plan-item-source',
    sql: `ALTER TABLE treatment_plan_items ADD COLUMN IF NOT EXISTS source_quote_item_id UUID REFERENCES quote_items(id) ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
CREATE INDEX IF NOT EXISTS idx_treatment_plan_items_source ON treatment_plan_items (source_quote_item_id);`,
  },
  {
    version: '2026-10-treatment-plan-notes',
    sql: `ALTER TABLE treatment_plans ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE treatment_plans ADD COLUMN IF NOT EXISTS notes_updated_at TIMESTAMPTZ;
ALTER TABLE treatment_plans ADD COLUMN IF NOT EXISTS notes_updated_by UUID REFERENCES users(id) ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE treatment_plan_items ADD COLUMN IF NOT EXISTS notes_updated_at TIMESTAMPTZ;
ALTER TABLE treatment_plan_items ADD COLUMN IF NOT EXISTS notes_updated_by UUID REFERENCES users(id) ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;`,
  },
];

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
