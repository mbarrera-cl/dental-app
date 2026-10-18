import { Injectable, Logger, Optional, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import pg from 'pg';
import { POSTGRES_SCHEMA_SQL } from './postgres-schema.js';

const { Pool, types } = pg;

// DATE is a calendar day, not a timestamp. Keep the ISO date string expected
// by the patient entity instead of letting pg turn it into a Date.
types.setTypeParser(1082, (value: string) => value);

export interface QueryResult<T> {
  rows: T[];
  rowCount: number;
}

/**
 * Async PostgreSQL connection used by every repository. It owns the pool,
 * executes the idempotent schema, exposes typed query helpers and supports
 * transactions with a checked-out client.
 */
@Injectable()
export class PostgresDatabase implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PostgresDatabase.name);
  private readonly pool: pg.Pool;
  private closed = false;

  constructor(@Optional() connectionStringOverride?: string) {
    const connectionString = (connectionStringOverride ?? process.env.DATABASE_URL)?.trim();

    if (connectionString === undefined || connectionString === '') {
      throw new Error('DATABASE_URL is required (PostgreSQL connection string)');
    }

    this.pool = new Pool({
      connectionString,
      max: Number(process.env.DATABASE_POOL_MAX ?? 10),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      ssl:
        process.env.DATABASE_SSL === 'true'
          ? { rejectUnauthorized: false }
          : undefined,
    });
  }

  async onModuleInit(): Promise<void> {
    await this.ensureSchema();
  }

  async ensureSchema(): Promise<void> {
    const client = await this.pool.connect();

    try {
      // A test helper may recreate the public schema while a pooled connection
      // is still alive; pin the search path before running the idempotent DDL.
      await client.query('SET search_path TO public');
      await client.query(POSTGRES_SCHEMA_SQL);
    } finally {
      client.release();
    }

    this.logger.log('PostgreSQL schema is up to date');
  }

  async query<T = Record<string, unknown>>(
    sql: string,
    params: readonly unknown[] = [],
  ): Promise<T[]> {
    const result = await this.pool.query(sql, [...params]);

    return result.rows as T[];
  }

  async queryOne<T = Record<string, unknown>>(
    sql: string,
    params: readonly unknown[] = [],
  ): Promise<T | null> {
    const rows = await this.query<T>(sql, params);

    return rows[0] ?? null;
  }

  async execute(sql: string, params: readonly unknown[] = []): Promise<number> {
    const result = await this.pool.query(sql, [...params]);

    return result.rowCount ?? 0;
  }

  /** Runs work inside a transaction, rolling back on any error. */
  async transaction<T>(work: (client: pg.PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');

      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.closed) {
      return;
    }

    this.closed = true;
    await this.pool.end();
  }
}

export function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error &&
    (error as { code?: string }).code === '23505';
}

export function isForeignKeyViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error &&
    ['23503', '23001'].includes((error as { code?: string }).code ?? '');
}

export function isCheckViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error &&
    (error as { code?: string }).code === '23514';
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
