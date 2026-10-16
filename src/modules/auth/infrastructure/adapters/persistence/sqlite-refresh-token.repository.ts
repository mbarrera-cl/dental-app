import { Injectable } from '@nestjs/common';
import { SqliteDatabase } from '../../../../../shared/infrastructure/database/sqlite-database.js';
import {
  RefreshTokenRepositoryPort,
  type RefreshTokenRecord,
} from '../../../application/ports/refresh-token.repository.port.js';

interface RefreshTokenRow {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
}

@Injectable()
export class SqliteRefreshTokenRepository extends RefreshTokenRepositoryPort {
  private readonly db: SqliteDatabase;

  constructor(database: SqliteDatabase) {
    super();
    this.db = database;
  }

  async save(record: RefreshTokenRecord): Promise<void> {
    this.db.connection
      .prepare(
        `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, revoked_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        record.id,
        record.userId,
        record.tokenHash,
        record.expiresAt.toISOString(),
        record.revokedAt?.toISOString() ?? null,
        record.createdAt.toISOString(),
      );
  }

  async findByHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    const row = this.db.connection
      .prepare('SELECT * FROM refresh_tokens WHERE token_hash = ?')
      .get(tokenHash) as unknown as RefreshTokenRow | undefined;

    return row === undefined ? null : toDomain(row);
  }

  async revoke(id: string, revokedAt: Date): Promise<void> {
    this.db.connection
      .prepare('UPDATE refresh_tokens SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL')
      .run(revokedAt.toISOString(), id);
  }

  async revokeAllForUser(userId: string): Promise<void> {
    this.db.connection
      .prepare('DELETE FROM refresh_tokens WHERE user_id = ? AND revoked_at IS NULL')
      .run(userId);
  }

  async delete(id: string): Promise<void> {
    this.db.connection.prepare('DELETE FROM refresh_tokens WHERE id = ?').run(id);
  }
}

function toDomain(row: RefreshTokenRow): RefreshTokenRecord {
  return {
    id: row.id,
    userId: row.user_id,
    tokenHash: row.token_hash,
    expiresAt: new Date(row.expires_at),
    revokedAt: row.revoked_at === null ? null : new Date(row.revoked_at),
    createdAt: new Date(row.created_at),
  };
}
