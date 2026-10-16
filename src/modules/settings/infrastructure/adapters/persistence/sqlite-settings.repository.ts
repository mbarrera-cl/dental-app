import { Injectable } from '@nestjs/common';
import { SqliteDatabase } from '../../../../../shared/infrastructure/database/sqlite-database.js';
import { SettingsRepositoryPort } from '../../../application/ports/settings-repository.port.js';
import type { SettingValue } from '../../../domain/setting-definition.js';

interface SettingRow {
  key: string;
  value: string;
}

/**
 * Driven adapter backed by SQLite. Values are persisted as JSON so numbers
 * and booleans round-trip unchanged. The `settings` table itself is created
 * by the shared schema (`ensureSchema`).
 */
@Injectable()
export class SqliteSettingsRepository extends SettingsRepositoryPort {
  private readonly db: SqliteDatabase;

  constructor(database: SqliteDatabase) {
    super();
    this.db = database;
  }

  async findAll(): Promise<Record<string, SettingValue>> {
    const rows = this.db.connection
      .prepare('SELECT key, value FROM settings')
      .all() as unknown as SettingRow[];

    const values: Record<string, SettingValue> = {};

    for (const row of rows) {
      values[row.key] = JSON.parse(row.value) as SettingValue;
    }

    return values;
  }

  async saveMany(values: Record<string, SettingValue>): Promise<void> {
    const upsert = this.db.connection.prepare(`
      INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `);
    const now = new Date().toISOString();

    this.db.connection.exec('BEGIN');

    try {
      for (const [key, value] of Object.entries(values)) {
        upsert.run(key, JSON.stringify(value), now);
      }

      this.db.connection.exec('COMMIT');
    } catch (error) {
      this.db.connection.exec('ROLLBACK');
      throw error;
    }
  }
}
