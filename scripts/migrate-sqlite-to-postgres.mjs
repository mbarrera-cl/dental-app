#!/usr/bin/env node
/**
 * One-time SQLite -> PostgreSQL data migration.
 *
 * Usage (local Docker):
 *   pnpm run build
 *   node --env-file=.env.postgres scripts/migrate-sqlite-to-postgres.mjs
 *
 * Environment:
 *   DATABASE_URL  PostgreSQL target (required)
 *   SQLITE_PATH   source database (default data/hexa.sqlite)
 *
 * The script creates the PostgreSQL schema, copies every application table
 * inside one transaction with deferred foreign keys, then verifies row counts.
 * It refuses to run twice thanks to the `migration.sqlite.completed` marker.
 */
import { existsSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import pg from 'pg';

const { Pool } = pg;

const TABLES = [
  'users',
  'roles',
  'user_roles',
  'user_permissions',
  'refresh_tokens',
  'password_history',
  'api_keys',
  'patients',
  'settings',
  'settings_audit',
  'bootstrap_state',
  'menu_items',
  'clinic_assets',
  'clinical_records',
  'clinical_findings',
  'clinical_events',
  'uco_procedures',
  'quotes',
  'quote_items',
  'quote_versions',
  'quote_counters',
  'caro_conversations',
  'caro_messages',
  'caro_approvals',
  'activity_log',
];

const sourcePath = process.env.SQLITE_PATH ?? 'data/hexa.sqlite';
const targetUrl = process.env.DATABASE_URL;

if (!targetUrl) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

if (!existsSync(sourcePath)) {
  console.error(`SQLite source not found: ${sourcePath}`);
  process.exit(1);
}

const { POSTGRES_SCHEMA_SQL } = await import(
  '../dist/shared/infrastructure/database/postgres-schema.js'
);

const sqlite = new DatabaseSync(sourcePath);
const pool = new Pool({ connectionString: targetUrl, max: 2 });
const client = await pool.connect();

function convert(value, udtName) {
  if (value === null || value === undefined) {
    return null;
  }

  switch (udtName) {
    case 'jsonb': {
      const parsed = typeof value === 'string' ? JSON.parse(value) : value;
      return JSON.stringify(parsed);
    }
    case 'bool':
      return value === true || value === 1 || value === '1';
    case 'bytea':
      return Buffer.isBuffer(value) ? value : Buffer.from(value);
    case 'int2':
    case 'int4':
    case 'int8':
    case 'float4':
    case 'float8':
    case 'numeric':
      return Number(value);
    case 'uuid':
    case 'date':
    case 'timestamptz':
    case 'timestamp':
      return String(value);
    default:
      return value;
  }
}

try {
  await client.query(POSTGRES_SCHEMA_SQL);

  const marker = await client.query(
    `SELECT 1 FROM bootstrap_state WHERE key = 'migration.sqlite.completed'`,
  );

  if (marker.rowCount > 0) {
    console.log('Migration already completed; nothing to do.');
    process.exit(0);
  }

  const existingUsers = await client.query('SELECT COUNT(*)::int AS count FROM users');

  if (Number(existingUsers.rows[0]?.count ?? 0) > 0) {
    throw new Error('Target already has users; refusing to overwrite. Use an empty database.');
  }

  const counts = {};
  const sourceCounts = {};

  await client.query('BEGIN');
  await client.query('SET CONSTRAINTS ALL DEFERRED');

  for (const table of TABLES) {
    const rows = sqlite.prepare(`SELECT * FROM "${table}"`).all();
    sourceCounts[table] = rows.length;

    if (rows.length === 0) {
      counts[table] = 0;
      continue;
    }

    const columns = await client.query(
      `SELECT column_name, udt_name, is_identity
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1
       ORDER BY ordinal_position`,
      [table],
    );
    const copiedColumns = columns.rows.filter((row) => row.is_identity !== 'YES');
    const names = copiedColumns.map((row) => row.column_name);
    const placeholders = copiedColumns
      .map((column, index) =>
        column.udt_name === 'jsonb' ? `$${index + 1}::jsonb` : `$${index + 1}`,
      )
      .join(', ');
    const insertSql = `INSERT INTO "${table}" (${names.map((name) => `"${name}"`).join(', ')}) VALUES (${placeholders})`;

    for (const row of rows) {
      const values = copiedColumns.map((column) =>
        convert(row[column.column_name], column.udt_name),
      );

      try {
        await client.query(insertSql, values);
      } catch (error) {
        console.error(`Insert failed in ${table} (id=${row.id ?? 'n/a'}):`, error.message);
        throw error;
      }
    }

    counts[table] = rows.length;
  }

  let failures = 0;

  for (const table of TABLES) {
    const result = await client.query(`SELECT COUNT(*)::int AS count FROM "${table}"`);
    const target = Number(result.rows[0]?.count ?? 0);

    if (target !== sourceCounts[table]) {
      console.error(`MISMATCH ${table}: sqlite=${sourceCounts[table]} postgres=${target}`);
      failures += 1;
    }
  }

  if (failures > 0) {
    throw new Error(`${failures} table count mismatch(es)`);
  }

  await client.query(
    `INSERT INTO bootstrap_state (key, value) VALUES ('migration.sqlite.completed', $1)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [new Date().toISOString()],
  );

  await client.query('COMMIT');

  console.log('Migration complete. Row counts:');
  for (const table of TABLES) {
    console.log(`  ${table.padEnd(24)} ${sourceCounts[table]}`);
  }
} catch (error) {
  try {
    await client.query('ROLLBACK');
  } catch {
    // The transaction may not have started.
  }

  console.error('Migration failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
  sqlite.close();
}
