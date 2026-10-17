import { Injectable } from '@nestjs/common';
import { SqliteDatabase } from '../../../../../shared/infrastructure/database/sqlite-database.js';
import { ActivityRepositoryPort } from '../../../application/ports/activity-repository.port.js';
import {
  decodeActivityCursor,
  type ActivityActorType,
  type ActivityEntry,
  type ActivityFilter,
  type ActivityOutcome,
  type ActivityPurgeFilter,
  type ActivityRecord,
} from '../../../domain/activity-entry.js';

interface ActivityRow {
  id: string;
  at: string;
  actor_id: string | null;
  actor_type: string;
  actor_label: string | null;
  action: string;
  module: string;
  subject_type: string | null;
  subject_id: string | null;
  subject_label: string | null;
  outcome: string;
  status_code: number | null;
  method: string;
  path: string;
  route: string | null;
  ip: string | null;
  user_agent: string | null;
  metadata: string;
  actor_name: string | null;
  actor_email: string | null;
}

interface WhereClause {
  sql: string;
  values: Array<string | number>;
}

/**
 * SQLite adapter for `activity_log`. Actor names are resolved at read time
 * with a `LEFT JOIN users`, so renaming an account does not rewrite history
 * and no personal data is duplicated in the trail.
 */
@Injectable()
export class SqliteActivityRepository extends ActivityRepositoryPort {
  private readonly db: SqliteDatabase;

  constructor(database: SqliteDatabase) {
    super();
    this.db = database;
  }

  async append(record: ActivityRecord): Promise<void> {
    this.db.connection
      .prepare(
        `INSERT INTO activity_log (
           id, at, actor_id, actor_type, actor_label, action, module,
           subject_type, subject_id, subject_label, outcome, status_code,
           method, path, route, ip, user_agent, metadata
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        record.id,
        record.at,
        record.actorId,
        record.actorType,
        record.actorLabel,
        record.action,
        record.module,
        record.subjectType,
        record.subjectId,
        record.subjectLabel,
        record.outcome,
        record.statusCode,
        record.method,
        record.path,
        record.route,
        record.ip,
        record.userAgent,
        JSON.stringify(record.metadata),
      );
  }

  async list(filter: ActivityFilter): Promise<ActivityEntry[]> {
    const where = buildWhere(filter, filter.cursor);
    const rows = this.db.connection
      .prepare(
        `SELECT a.*, u.name AS actor_name, u.email AS actor_email
         FROM activity_log a
         LEFT JOIN users u ON u.id = a.actor_id
         ${where.sql}
         ORDER BY a.at DESC, a.id DESC
         LIMIT ?`,
      )
      .all(...where.values, filter.limit) as unknown as ActivityRow[];

    // One extra row tells us whether another page exists without a COUNT.
    return rows.map(toEntry);
  }

  async count(filter: ActivityPurgeFilter): Promise<number> {
    const where = buildPurgeWhere(filter);
    const row = this.db.connection
      .prepare(`SELECT COUNT(*) AS total FROM activity_log ${where.sql}`)
      .get(...where.values) as unknown as { total: number };

    return Number(row.total);
  }

  async purge(filter: ActivityPurgeFilter): Promise<number> {
    const where = buildPurgeWhere(filter);

    if (where.sql === '') {
      // `all`: no WHERE clause at all.
      const result = this.db.connection.prepare('DELETE FROM activity_log').run();

      return Number(result.changes);
    }

    const result = this.db.connection
      .prepare(`DELETE FROM activity_log ${where.sql}`)
      .run(...where.values);

    return Number(result.changes);
  }
}

function buildWhere(filter: ActivityFilter, cursor: string | null): WhereClause {
  const conditions: string[] = [];
  const values: Array<string | number> = [];

  if (filter.module !== null) {
    conditions.push('a.module = ?');
    values.push(filter.module);
  }

  if (filter.action !== null) {
    conditions.push('a.action = ?');
    values.push(filter.action);
  }

  if (filter.actorId !== null) {
    conditions.push('a.actor_id = ?');
    values.push(filter.actorId);
  }

  if (filter.from !== null) {
    conditions.push('a.at >= ?');
    values.push(filter.from);
  }

  if (filter.to !== null) {
    conditions.push('a.at <= ?');
    values.push(filter.to);
  }

  if (filter.subjectType !== null) {
    conditions.push('a.subject_type = ?');
    values.push(filter.subjectType);
  }

  if (filter.subjectId !== null) {
    conditions.push('a.subject_id = ?');
    values.push(filter.subjectId);
  }

  if (filter.outcome !== null) {
    conditions.push('a.outcome = ?');
    values.push(filter.outcome);
  }

  if (cursor !== null) {
    const decoded = decodeActivityCursor(cursor);

    if (decoded !== null) {
      conditions.push('(a.at < ? OR (a.at = ? AND a.id < ?))');
      values.push(decoded.at, decoded.at, decoded.id);
    }
  }

  return {
    sql: conditions.length === 0 ? '' : `WHERE ${conditions.join(' AND ')}`,
    values,
  };
}

function buildPurgeWhere(filter: ActivityPurgeFilter): WhereClause {
  if (filter.all || filter.before === null) {
    return { sql: '', values: [] };
  }

  return { sql: 'WHERE at < ?', values: [filter.before] };
}

function toEntry(row: ActivityRow): ActivityEntry {
  return {
    id: row.id,
    at: row.at,
    actor: {
      id: row.actor_id,
      type: toActorType(row.actor_type),
      name: row.actor_name ?? row.actor_label,
      email: row.actor_email,
    },
    action: row.action,
    module: row.module,
    subject: {
      type: row.subject_type,
      id: row.subject_id,
      label: row.subject_label,
    },
    outcome: toOutcome(row.outcome),
    statusCode: row.status_code,
    method: row.method,
    path: row.path,
    route: row.route,
    ip: row.ip,
    userAgent: row.user_agent,
    metadata: parseMetadata(row.metadata),
  };
}

function toActorType(value: string): ActivityActorType {
  return value === 'user' || value === 'apikey' || value === 'system' || value === 'anonymous'
    ? value
    : 'system';
}

function toOutcome(value: string): ActivityOutcome {
  return value === 'failure' ? 'failure' : 'success';
}

function parseMetadata(raw: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(raw);

    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}
