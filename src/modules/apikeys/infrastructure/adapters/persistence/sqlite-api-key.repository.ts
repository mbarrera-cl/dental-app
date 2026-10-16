import { Injectable } from '@nestjs/common';
import { SqliteDatabase } from '../../../../../shared/infrastructure/database/sqlite-database.js';
import { ApiKeyRepositoryPort } from '../../../application/ports/api-key.repository.port.js';
import { ApiKey } from '../../../domain/api-key.entity.js';
import { ApiKeyNotFoundError } from '../../../domain/api-key.errors.js';

interface ApiKeyRow {
  id: string;
  user_id: string;
  name: string;
  prefix: string;
  key_hash: string;
  scopes: string | null;
  expires_at: string | null;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

/** Driven adapter backed by SQLite. The `api_keys` table comes from `ensureSchema`. */
@Injectable()
export class SqliteApiKeyRepository extends ApiKeyRepositoryPort {
  private readonly db: SqliteDatabase;

  constructor(database: SqliteDatabase) {
    super();
    this.db = database;
  }

  async save(apiKey: ApiKey): Promise<void> {
    this.db.connection
      .prepare(
        `INSERT INTO api_keys (id, user_id, name, prefix, key_hash, scopes, expires_at, last_used_at, revoked_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        apiKey.id,
        apiKey.userId,
        apiKey.name,
        apiKey.prefix,
        apiKey.keyHash,
        apiKey.scopes === null ? null : JSON.stringify(apiKey.scopes),
        toIso(apiKey.expiresAt),
        toIso(apiKey.lastUsedAt),
        toIso(apiKey.revokedAt),
        apiKey.createdAt.toISOString(),
      );
  }

  async update(apiKey: ApiKey): Promise<void> {
    const result = this.db.connection
      .prepare(
        `UPDATE api_keys SET prefix = ?, key_hash = ?, last_used_at = ?, revoked_at = ? WHERE id = ?`,
      )
      .run(
        apiKey.prefix,
        apiKey.keyHash,
        toIso(apiKey.lastUsedAt),
        toIso(apiKey.revokedAt),
        apiKey.id,
      );

    if (result.changes === 0) {
      throw new ApiKeyNotFoundError(apiKey.id);
    }
  }

  async findById(id: string): Promise<ApiKey | null> {
    const row = this.db.connection.prepare('SELECT * FROM api_keys WHERE id = ?').get(id) as unknown as
      | ApiKeyRow
      | undefined;

    return row === undefined ? null : this.toDomain(row);
  }

  async findByHash(keyHash: string): Promise<ApiKey | null> {
    const row = this.db.connection
      .prepare('SELECT * FROM api_keys WHERE key_hash = ?')
      .get(keyHash) as unknown as ApiKeyRow | undefined;

    return row === undefined ? null : this.toDomain(row);
  }

  async findAll(): Promise<ApiKey[]> {
    const rows = this.db.connection
      .prepare('SELECT * FROM api_keys ORDER BY created_at DESC')
      .all() as unknown as ApiKeyRow[];

    return rows.map((row) => this.toDomain(row));
  }

  async findByUser(userId: string): Promise<ApiKey[]> {
    const rows = this.db.connection
      .prepare('SELECT * FROM api_keys WHERE user_id = ? ORDER BY created_at DESC')
      .all(userId) as unknown as ApiKeyRow[];

    return rows.map((row) => this.toDomain(row));
  }

  async countActiveByUser(userId: string, now: Date): Promise<number> {
    const row = this.db.connection
      .prepare(
        `SELECT COUNT(*) AS count FROM api_keys
         WHERE user_id = ? AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > ?)`,
      )
      .get(userId, now.toISOString()) as unknown as { count: number };

    return Number(row.count);
  }

  private toDomain(row: ApiKeyRow): ApiKey {
    return ApiKey.reconstitute(
      {
        userId: row.user_id,
        name: row.name,
        prefix: row.prefix,
        keyHash: row.key_hash,
        scopes: row.scopes === null ? null : (JSON.parse(row.scopes) as string[]),
        expiresAt: toDate(row.expires_at),
        lastUsedAt: toDate(row.last_used_at),
        revokedAt: toDate(row.revoked_at),
        createdAt: new Date(row.created_at),
      },
      row.id,
    );
  }
}

function toIso(date: Date | null): string | null {
  return date === null ? null : date.toISOString();
}

function toDate(value: string | null): Date | null {
  return value === null ? null : new Date(value);
}
