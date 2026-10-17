import { Injectable } from '@nestjs/common';
import { PostgresDatabase } from '../../../../../shared/infrastructure/database/postgres-database.js';
import {
  RefreshTokenRepositoryPort,
  type RefreshTokenRecord,
} from '../../../application/ports/refresh-token.repository.port.js';

interface RefreshTokenRow {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  revoked_at: Date | null;
  created_at: Date;
}

@Injectable()
export class PostgresRefreshTokenRepository extends RefreshTokenRepositoryPort {
  constructor(private readonly db: PostgresDatabase) {
    super();
  }

  async save(record: RefreshTokenRecord): Promise<void> {
    await this.db.execute(
      `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, revoked_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [record.id, record.userId, record.tokenHash, record.expiresAt, record.revokedAt, record.createdAt],
    );
  }

  async findByHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    const row = await this.db.queryOne<RefreshTokenRow>(
      'SELECT * FROM refresh_tokens WHERE token_hash = $1',
      [tokenHash],
    );

    return row === null ? null : this.toDomain(row);
  }

  async revoke(id: string, revokedAt: Date): Promise<void> {
    await this.db.execute(
      'UPDATE refresh_tokens SET revoked_at = $1 WHERE id = $2 AND revoked_at IS NULL',
      [revokedAt, id],
    );
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.db.execute(
      'DELETE FROM refresh_tokens WHERE user_id = $1 AND revoked_at IS NULL',
      [userId],
    );
  }

  async delete(id: string): Promise<void> {
    await this.db.execute('DELETE FROM refresh_tokens WHERE id = $1', [id]);
  }

  private toDomain(row: RefreshTokenRow): RefreshTokenRecord {
    return {
      id: row.id,
      userId: row.user_id,
      tokenHash: row.token_hash,
      expiresAt: new Date(row.expires_at),
      revokedAt: row.revoked_at === null ? null : new Date(row.revoked_at),
      createdAt: new Date(row.created_at),
    };
  }
}
