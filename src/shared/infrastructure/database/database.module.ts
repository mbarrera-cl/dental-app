import { Module } from '@nestjs/common';
import { SqliteDatabase } from './sqlite-database.js';

export const DATABASE_PATH_ENV = 'DATABASE_PATH';

const DEFAULT_DATABASE_PATH = 'data/hexa.sqlite';

/**
 * Provides the SQLite connection to every driven adapter that needs it.
 *
 * Point `DATABASE_PATH` at another file (or ':memory:') per environment.
 * Tests override the `SqliteDatabase` provider with an in-memory instance
 * instead of touching env vars (see `test/users.e2e-spec.ts`).
 */
@Module({
  providers: [
    {
      provide: SqliteDatabase,
      useFactory: (): SqliteDatabase =>
        new SqliteDatabase(process.env[DATABASE_PATH_ENV] ?? DEFAULT_DATABASE_PATH),
    },
  ],
  exports: [SqliteDatabase],
})
export class DatabaseModule {}
