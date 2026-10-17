import { Injectable } from '@nestjs/common';
import {
  PostgresDatabase,
  isUniqueViolation,
} from '../../../../../shared/infrastructure/database/postgres-database.js';
import { UcoProcedureRepositoryPort } from '../../../application/ports/uco-procedure-repository.port.js';
import { UcoProcedure, type UcoStatus } from '../../../domain/uco-procedure.entity.js';
import { UcoProcedureCodeTakenError, UcoProcedureNotFoundError } from '../../../domain/uco.errors.js';

interface UcoProcedureRow {
  id: string;
  code: string;
  chapter: string;
  name: string;
  units: number;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class PostgresUcoProcedureRepository extends UcoProcedureRepositoryPort {
  constructor(private readonly db: PostgresDatabase) {
    super();
  }

  async save(procedure: UcoProcedure): Promise<void> {
    try {
      await this.db.execute(
        `INSERT INTO uco_procedures
           (id, code, chapter, name, units, active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          procedure.id,
          procedure.code,
          procedure.chapter,
          procedure.name,
          procedure.units,
          procedure.status === 'active',
          procedure.createdAt,
          procedure.updatedAt,
        ],
      );
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new UcoProcedureCodeTakenError(procedure.code);
      }

      throw error;
    }
  }

  async update(procedure: UcoProcedure): Promise<void> {
    const changed = await this.db.execute(
      `UPDATE uco_procedures
       SET code = $1, chapter = $2, name = $3, units = $4, active = $5, updated_at = $6
       WHERE id = $7`,
      [
        procedure.code,
        procedure.chapter,
        procedure.name,
        procedure.units,
        procedure.status === 'active',
        procedure.updatedAt,
        procedure.id,
      ],
    );

    if (changed === 0) {
      throw new UcoProcedureNotFoundError(procedure.id);
    }
  }

  async delete(id: string): Promise<void> {
    const changed = await this.db.execute(
      'UPDATE uco_procedures SET active = FALSE, updated_at = NOW() WHERE id = $1',
      [id],
    );

    if (changed === 0) {
      throw new UcoProcedureNotFoundError(id);
    }
  }

  async findById(id: string): Promise<UcoProcedure | null> {
    const row = await this.db.queryOne<UcoProcedureRow>(
      'SELECT * FROM uco_procedures WHERE id = $1',
      [id],
    );

    return row === null ? null : this.toDomain(row);
  }

  async findByCode(code: string): Promise<UcoProcedure | null> {
    const row = await this.db.queryOne<UcoProcedureRow>(
      'SELECT * FROM uco_procedures WHERE code = $1',
      [code],
    );

    return row === null ? null : this.toDomain(row);
  }

  async findAll(): Promise<UcoProcedure[]> {
    const rows = await this.db.query<UcoProcedureRow>(
      'SELECT * FROM uco_procedures ORDER BY active DESC, name ASC',
    );

    return rows.map((row) => this.toDomain(row));
  }

  async search(q: string, activeOnly: boolean): Promise<UcoProcedure[]> {
    const like = `%${q}%`;
    const rows = await this.db.query<UcoProcedureRow>(
      `SELECT * FROM uco_procedures
       WHERE (code ILIKE $1 OR name ILIKE $1 OR chapter ILIKE $1)
       ${activeOnly ? 'AND active = TRUE' : ''}
       ORDER BY active DESC, name ASC`,
      [like],
    );

    return rows.map((row) => this.toDomain(row));
  }

  private toDomain(row: UcoProcedureRow): UcoProcedure {
    return UcoProcedure.reconstitute(
      {
        code: row.code,
        chapter: row.chapter,
        name: row.name,
        units: row.units,
        status: (row.active ? 'active' : 'inactive') as UcoStatus,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
      },
      row.id,
    );
  }
}
