import { Module } from '@nestjs/common';
import { PostgresDatabase } from './postgres-database.js';

/**
 * Provides the PostgreSQL pool to every persistence adapter. The connection
 * string comes from `DATABASE_URL`; the pool applies the idempotent schema on
 * module initialization.
 */
@Module({
  providers: [PostgresDatabase],
  exports: [PostgresDatabase],
})
export class DatabaseModule {}
