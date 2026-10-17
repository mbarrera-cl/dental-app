import { Injectable } from '@nestjs/common';
import { PostgresDatabase, isUuid } from '../../../../../shared/infrastructure/database/postgres-database.js';
import { ApiKeyRepositoryPort } from '../../../application/ports/api-key.repository.port.js';
import { ApiKey } from '../../../domain/api-key.entity.js';
import { ApiKeyNotFoundError } from '../../../domain/api-key.errors.js';

interface ApiKeyRow {
  id: string;
  user_id: string;
  name: string;
  prefix: string;
  key_hash: string;
  scopes: string[] | null;
  expires_at: Date | null;
  last_used_at: Date | null;
  revoked_at: Date | null;
  created_at: Date;
}

@Injectable()
export class PostgresApiKeyRepository extends ApiKeyRepositoryPort {
  constructor(private readonly db: PostgresDatabase) {
    super();
  }

  async save(apiKey: ApiKey): Promise<void> {
    await this.db.execute(
      `INSERT INTO api_keys (id, user_id, name, prefix, key_hash, scopes, expires_at, last_used_at, revoked_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10)`,
      [
        apiKey.id,
        apiKey.userId,
        apiKey.name,
        apiKey.prefix,
        apiKey.keyHash,
        apiKey.scopes === null ? null : JSON.stringify(apiKey.scopes),
        apiKey.expiresAt,
        apiKey.lastUsedAt,
        apiKey.revokedAt,
        apiKey.createdAt,
      ],
    );
  }

  async update(apiKey: ApiKey): Promise<void> {
    const changed = await this.db.execute(
      'UPDATE api_keys SET prefix = $1, key_hash = $2, last_used_at = $3, revoked_at = $4 WHERE id = $5',
      [apiKey.prefix, apiKey.keyHash, apiKey.lastUsedAt, apiKey.revokedAt, apiKey.id],
    );

    if (changed === 0) {
      throw new ApiKeyNotFoundError(apiKey.id);
    }
  }

  async findById(id: string): Promise<ApiKey | null> {
    if (!isUuid(id)) {
      return null;
    }

    const row = await this.db.queryOne<ApiKeyRow>('SELECT * FROM api_keys WHERE id = $1', [id]);

    return row === null ? null : this.toDomain(row);
  }

  async findByHash(keyHash: string): Promise<ApiKey | null> {
    const row = await this.db.queryOne<ApiKeyRow>(
      'SELECT * FROM api_keys WHERE key_hash = $1',
      [keyHash],
    );

    return row === null ? null : this.toDomain(row);
  }

  async findAll(): Promise<ApiKey[]> {
    const rows = await this.db.query<ApiKeyRow>('SELECT * FROM api_keys ORDER BY created_at DESC');
    return rows.map((row) => this.toDomain(row));
  }

  async findByUser(userId: string): Promise<ApiKey[]> {
    const rows = await this.db.query<ApiKeyRow>(
      'SELECT * FROM api_keys WHERE user_id = $1 ORDER BY created_at DESC',
      [userId],
    );

    return rows.map((row) => this.toDomain(row));
  }

  async countActiveByUser(userId: string, now: Date): Promise<number> {
    const row = await this.db.queryOne<{ count: string | number }>(
      `SELECT COUNT(*) AS count FROM api_keys
       WHERE user_id = $1 AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > $2)`,
      [userId, now],
    );

    return Number(row?.count ?? 0);
  }

  private toDomain(row: ApiKeyRow): ApiKey {
    return ApiKey.reconstitute(
      {
        userId: row.user_id,
        name: row.name,
        prefix: row.prefix,
        keyHash: row.key_hash,
        scopes: Array.isArray(row.scopes) ? row.scopes : null,
        expiresAt: row.expires_at === null ? null : new Date(row.expires_at),
        lastUsedAt: row.last_used_at === null ? null : new Date(row.last_used_at),
        revokedAt: row.revoked_at === null ? null : new Date(row.revoked_at),
        createdAt: new Date(row.created_at),
      },
      row.id,
    );
  }
}
