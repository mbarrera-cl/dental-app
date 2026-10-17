import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PostgresDatabase } from '../../../../../shared/infrastructure/database/postgres-database.js';
import { SettingsAuditRepositoryPort } from '../../../application/ports/settings-audit-repository.port.js';
import type {
  SettingChange,
  SettingsAuditEntry,
  SettingsAuditRecord,
} from '../../../domain/settings-audit.js';

interface AuditRow {
  id: string;
  at: Date;
  actor_id: string;
  actor_type: string;
  changes: SettingChange[];
  actor_email: string | null;
}

@Injectable()
export class PostgresSettingsAuditRepository extends SettingsAuditRepositoryPort {
  constructor(private readonly db: PostgresDatabase) {
    super();
  }

  async append(record: SettingsAuditRecord): Promise<void> {
    await this.db.execute(
      `INSERT INTO settings_audit (id, at, actor_id, actor_type, changes)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [randomUUID(), record.at, record.actorId, record.actorType, JSON.stringify(record.changes)],
    );
  }

  async list(limit: number): Promise<SettingsAuditEntry[]> {
    const rows = await this.db.query<AuditRow>(
      `SELECT a.id, a.at, a.actor_id, a.actor_type, a.changes, u.email AS actor_email
       FROM settings_audit a
       LEFT JOIN users u ON u.id = a.actor_id
       ORDER BY a.at DESC, a.id DESC
       LIMIT $1`,
      [limit],
    );

    return rows.map((row) => ({
      id: row.id,
      at: row.at.toISOString(),
      actorId: row.actor_id,
      actorType: row.actor_type === 'apikey' ? 'apikey' : 'user',
      actorEmail: row.actor_email ?? null,
      changes: Array.isArray(row.changes) ? row.changes : [],
    }));
  }
}
