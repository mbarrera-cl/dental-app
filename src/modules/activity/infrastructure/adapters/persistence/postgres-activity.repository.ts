import { Injectable } from '@nestjs/common';
import { PostgresDatabase } from '../../../../../shared/infrastructure/database/postgres-database.js';
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
  at: Date;
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
  metadata: Record<string, unknown>;
  actor_name: string | null;
  actor_email: string | null;
}

interface WhereClause {
  sql: string;
  values: Array<string | number | Date>;
}

@Injectable()
export class PostgresActivityRepository extends ActivityRepositoryPort {
  constructor(private readonly db: PostgresDatabase) {
    super();
  }

  async append(record: ActivityRecord): Promise<void> {
    await this.db.execute(
      `INSERT INTO activity_log (
         id, at, actor_id, actor_type, actor_label, action, module,
         subject_type, subject_id, subject_label, outcome, status_code,
         method, path, route, ip, user_agent, metadata
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
                 $13, $14, $15, $16, $17, $18::jsonb)`,
      [
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
      ],
    );
  }

  async list(filter: ActivityFilter): Promise<ActivityEntry[]> {
    const where = buildWhere(filter, filter.cursor);
    const limitParam = where.values.length + 1;
    const rows = await this.db.query<ActivityRow>(
      `SELECT a.*, u.name AS actor_name, u.email AS actor_email
       FROM activity_log a
       LEFT JOIN users u ON u.id = a.actor_id
       ${where.sql}
       ORDER BY a.at DESC, a.id DESC
       LIMIT $${limitParam}`,
      [...where.values, filter.limit],
    );

    return rows.map(toEntry);
  }

  async count(filter: ActivityPurgeFilter): Promise<number> {
    const where = buildPurgeWhere(filter);
    const row = await this.db.queryOne<{ total: string | number }>(
      `SELECT COUNT(*) AS total FROM activity_log ${where.sql}`,
      where.values,
    );

    return Number(row?.total ?? 0);
  }

  async purge(filter: ActivityPurgeFilter): Promise<number> {
    const where = buildPurgeWhere(filter);

    return this.db.execute(`DELETE FROM activity_log ${where.sql}`, where.values);
  }
}

function buildWhere(filter: ActivityFilter, cursor: string | null): WhereClause {
  const conditions: string[] = [];
  const values: Array<string | number | Date> = [];
  const add = (column: string, value: string | number | Date): void => {
    values.push(value);
    conditions.push(`${column} = $${values.length}`);
  };

  if (filter.module !== null) add('a.module', filter.module);
  if (filter.action !== null) add('a.action', filter.action);
  if (filter.actorId !== null) add('a.actor_id', filter.actorId);
  if (filter.from !== null) {
    values.push(new Date(filter.from));
    conditions.push(`a.at >= $${values.length}`);
  }
  if (filter.to !== null) {
    values.push(new Date(filter.to));
    conditions.push(`a.at <= $${values.length}`);
  }
  if (filter.subjectType !== null) add('a.subject_type', filter.subjectType);
  if (filter.subjectId !== null) add('a.subject_id', filter.subjectId);
  if (filter.outcome !== null) add('a.outcome', filter.outcome);

  if (cursor !== null) {
    const decoded = decodeActivityCursor(cursor);

    if (decoded !== null) {
      values.push(new Date(decoded.at), new Date(decoded.at), decoded.id);
      conditions.push(`(a.at < $${values.length - 2} OR (a.at = $${values.length - 1} AND a.id < $${values.length}))`);
    }
  }

  return {
    sql: conditions.length === 0 ? '' : `WHERE ${conditions.join(' AND ')}`,
    values,
  };
}

function buildPurgeWhere(filter: ActivityPurgeFilter): { sql: string; values: Array<Date> } {
  if (filter.all || filter.before === null) {
    return { sql: '', values: [] };
  }

  return { sql: 'WHERE at < $1', values: [new Date(filter.before)] };
}

function toEntry(row: ActivityRow): ActivityEntry {
  return {
    id: row.id,
    at: row.at.toISOString(),
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
    metadata: row.metadata && typeof row.metadata === 'object' ? row.metadata : {},
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
