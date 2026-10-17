import { loadEnvFile } from 'node:process';
import pg from 'pg';
import { PostgresDatabase } from '../../src/shared/infrastructure/database/postgres-database.js';

const { Client } = pg;

try {
  loadEnvFile('.env.postgres');
} catch {
  // The developer can provide TEST_DATABASE_URL directly.
}

function testUrl(): string {
  const url = process.env.TEST_DATABASE_URL?.trim();

  if (url === undefined || url === '') {
    throw new Error(
      'TEST_DATABASE_URL is required. Start Docker PostgreSQL and use .env.postgres (see compose.postgres.yml).',
    );
  }

  return url;
}

/**
 * Gives one spec a clean PostgreSQL schema. Unit specs and e2e specs both use
 * this helper; Vitest runs files sequentially so the shared test database is
 * never touched concurrently.
 */
export async function createPostgresTestDatabase(): Promise<PostgresDatabase> {
  const connectionString = testUrl();
  const admin = new Client({ connectionString });
  await admin.connect();

  try {
    await admin.query('DROP SCHEMA IF EXISTS public CASCADE');
    await admin.query('CREATE SCHEMA public');
  } finally {
    await admin.end();
  }

  const database = new PostgresDatabase(connectionString);
  await database.ensureSchema();

  return database;
}

export async function closePostgresTestDatabase(database: PostgresDatabase): Promise<void> {
  await database.onModuleDestroy();
}
