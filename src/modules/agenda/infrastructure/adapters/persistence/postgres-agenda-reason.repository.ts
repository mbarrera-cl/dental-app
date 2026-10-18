import { Injectable } from '@nestjs/common';
import {
  PostgresDatabase,
  isUniqueViolation,
  isUuid,
} from '../../../../../shared/infrastructure/database/postgres-database.js';
import { AgendaReasonRepositoryPort } from '../../../application/ports/agenda-reason-repository.port.js';
import { AgendaReason } from '../../../domain/agenda-reason.entity.js';
import {
  AgendaReasonNameTakenError,
  AgendaReasonNotFoundError,
} from '../../../domain/appointment.errors.js';

interface AgendaReasonRow {
  id: string;
  name: string;
  created_by: string | null;
  updated_by: string | null;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class PostgresAgendaReasonRepository extends AgendaReasonRepositoryPort {
  constructor(private readonly db: PostgresDatabase) {
    super();
  }

  async findAll(): Promise<AgendaReason[]> {
    const rows = await this.db.query<AgendaReasonRow>(
      'SELECT * FROM agenda_reasons ORDER BY LOWER(name) ASC',
    );

    return rows.map(toDomain);
  }

  async findById(id: string): Promise<AgendaReason | null> {
    if (!isUuid(id)) {
      return null;
    }

    const row = await this.db.queryOne<AgendaReasonRow>(
      'SELECT * FROM agenda_reasons WHERE id = $1',
      [id],
    );

    return row === null ? null : toDomain(row);
  }

  async count(): Promise<number> {
    const row = await this.db.queryOne<{ count: string | number }>(
      'SELECT COUNT(*) AS count FROM agenda_reasons',
    );

    return Number(row?.count ?? 0);
  }

  async save(reason: AgendaReason): Promise<void> {
    try {
      await this.db.execute(
        `INSERT INTO agenda_reasons (id, name, created_by, updated_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          reason.id,
          reason.name,
          reason.createdBy,
          reason.updatedBy,
          reason.createdAt,
          reason.updatedAt,
        ],
      );
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AgendaReasonNameTakenError(reason.name);
      }

      throw error;
    }
  }

  async update(reason: AgendaReason): Promise<void> {
    try {
      const changed = await this.db.execute(
        `UPDATE agenda_reasons
         SET name = $1, updated_by = $2, updated_at = $3
         WHERE id = $4`,
        [reason.name, reason.updatedBy, reason.updatedAt, reason.id],
      );

      if (changed === 0) {
        throw new AgendaReasonNotFoundError(reason.id);
      }
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AgendaReasonNameTakenError(reason.name);
      }

      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    const changed = await this.db.execute('DELETE FROM agenda_reasons WHERE id = $1', [id]);

    if (changed === 0) {
      throw new AgendaReasonNotFoundError(id);
    }
  }
}

function toDomain(row: AgendaReasonRow): AgendaReason {
  return AgendaReason.reconstitute(
    {
      name: row.name,
      createdBy: row.created_by,
      updatedBy: row.updated_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    },
    row.id,
  );
}
