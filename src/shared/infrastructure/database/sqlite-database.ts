import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { OnModuleDestroy } from '@nestjs/common';
import { ensureSchema } from './schema.js';

/**
 * Thin wrapper around Node's built-in SQLite driver (`node:sqlite`), so the
 * boilerplate needs no ORM or native module to run a real database. Owns the
 * connection and its lifecycle; driven adapters receive the `connection`.
 *
 * Creating an instance also brings the schema up to date (`ensureSchema`),
 * which keeps tests and the file-backed database in sync.
 *
 * Pass ':memory:' for an ephemeral database (used by the tests).
 */
export class SqliteDatabase implements OnModuleDestroy {
  readonly connection: DatabaseSync;

  constructor(path: string) {
    if (path !== ':memory:') {
      mkdirSync(dirname(path), { recursive: true });
    }

    this.connection = new DatabaseSync(path);
    this.connection.exec('PRAGMA journal_mode = WAL;');
    this.connection.exec('PRAGMA foreign_keys = ON;');
    ensureSchema(this);
  }

  onModuleDestroy(): void {
    if (this.connection.isOpen) {
      this.connection.close();
    }
  }
}
