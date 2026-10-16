import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { SqliteDatabase } from '../../../../../shared/infrastructure/database/sqlite-database.js';
import { PasswordHistoryPort } from '../../../application/ports/password-history.port.js';

/**
 * Driven adapter backed by SQLite. The `password_history` table is created by
 * the shared schema (`ensureSchema`).
 */
@Injectable()
export class SqlitePasswordHistoryRepository extends PasswordHistoryPort {
  private readonly db: SqliteDatabase;

  constructor(database: SqliteDatabase) {
    super();
    this.db = database;
  }

  async listRecent(userId: string, limit: number): Promise<string[]> {
    if (limit <= 0) {
      return [];
    }

    const rows = this.db.connection
      .prepare(
        `SELECT password_hash FROM password_history
         WHERE user_id = ?
         ORDER BY created_at DESC, rowid DESC
         LIMIT ?`,
      )
      .all(userId, limit) as unknown as Array<{ password_hash: string }>;

    return rows.map((row) => row.password_hash);
  }

  async append(userId: string, passwordHash: string, changedAt: Date): Promise<void> {
    this.db.connection
      .prepare(
        'INSERT INTO password_history (id, user_id, password_hash, created_at) VALUES (?, ?, ?, ?)',
      )
      .run(randomUUID(), userId, passwordHash, changedAt.toISOString());
  }

  async trim(userId: string, keep: number): Promise<void> {
    this.db.connection
      .prepare(
        `DELETE FROM password_history
         WHERE user_id = ? AND id NOT IN (
           SELECT id FROM password_history
           WHERE user_id = ?
           ORDER BY created_at DESC, rowid DESC
           LIMIT ?
         )`,
      )
      .run(userId, userId, Math.max(keep, 0));
  }
}
