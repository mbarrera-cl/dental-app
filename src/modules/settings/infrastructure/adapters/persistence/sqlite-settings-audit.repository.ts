import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { SqliteDatabase } from '../../../../../shared/infrastructure/database/sqlite-database.js';
import { SettingsAuditRepositoryPort } from '../../../application/ports/settings-audit-repository.port.js';
import type {
  SettingChange,
  SettingsAuditEntry,
  SettingsAuditRecord,
} from '../../../domain/settings-audit.js';

interface AuditRow {
  id: string;
  at: string;
  actor_id: string;
  actor_type: string;
  changes: string;
  actor_email: string | null;
}

/**
 * Driven adapter backed by SQLite. The `settings_audit` table is created by
 * the shared schema (`ensureSchema`); `changes` is stored as JSON and the
 * actor email is joined at read time.
 */
@Injectable()
export class SqliteSettingsAuditRepository extends SettingsAuditRepositoryPort {
  private readonly db: SqliteDatabase;

  constructor(database: SqliteDatabase) {
    super();
    this.db = database;
  }

  async append(record: SettingsAuditRecord): Promise<void> {
    this.db.connection
      .prepare(
        `INSERT INTO settings_audit (id, at, actor_id, actor_type, changes)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        randomUUID(),
        record.at,
        record.actorId,
        record.actorType,
        JSON.stringify(record.changes),
      );
  }

  async list(limit: number): Promise<SettingsAuditEntry[]> {
    const rows = this.db.connection
      .prepare(
        `SELECT a.id, a.at, a.actor_id, a.actor_type, a.changes, u.email AS actor_email
         FROM settings_audit a
         LEFT JOIN users u ON u.id = a.actor_id
         ORDER BY a.at DESC, a.rowid DESC
         LIMIT ?`,
      )
      .all(limit) as unknown as AuditRow[];

    return rows.map((row) => ({
      id: row.id,
      at: row.at,
      actorId: row.actor_id,
      actorType: row.actor_type === 'apikey' ? 'apikey' : 'user',
      actorEmail: row.actor_email ?? null,
      changes: JSON.parse(row.changes) as SettingChange[],
    }));
  }
}
