import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PostgresDatabase } from '../../../../../shared/infrastructure/database/postgres-database.js';
import { PasswordHistoryPort } from '../../../application/ports/password-history.port.js';

@Injectable()
export class PostgresPasswordHistoryRepository extends PasswordHistoryPort {
  constructor(private readonly db: PostgresDatabase) {
    super();
  }

  async listRecent(userId: string, limit: number): Promise<string[]> {
    if (limit <= 0) {
      return [];
    }

    const rows = await this.db.query<{ password_hash: string }>(
      `SELECT password_hash FROM password_history
       WHERE user_id = $1
       ORDER BY created_at DESC, id DESC
       LIMIT $2`,
      [userId, limit],
    );

    return rows.map((row) => row.password_hash);
  }

  async append(userId: string, passwordHash: string, changedAt: Date): Promise<void> {
    await this.db.execute(
      'INSERT INTO password_history (id, user_id, password_hash, created_at) VALUES ($1, $2, $3, $4)',
      [randomUUID(), userId, passwordHash, changedAt],
    );
  }

  async trim(userId: string, keep: number): Promise<void> {
    await this.db.execute(
      `DELETE FROM password_history
       WHERE user_id = $1 AND id NOT IN (
         SELECT id FROM password_history
         WHERE user_id = $1
         ORDER BY created_at DESC, id DESC
         LIMIT $2
       )`,
      [userId, Math.max(keep, 0)],
    );
  }
}
