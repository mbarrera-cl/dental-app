import { Injectable } from '@nestjs/common';
import { SqliteDatabase } from '../../../../../shared/infrastructure/database/sqlite-database.js';
import { UcoProcedureRepositoryPort } from '../../../application/ports/uco-procedure-repository.port.js';
import { UcoProcedure, type UcoStatus } from '../../../domain/uco-procedure.entity.js';
import { UcoProcedureCodeTakenError, UcoProcedureNotFoundError } from '../../../domain/uco.errors.js';

interface UcoProcedureRow {
  id: string;
  code: string;
  chapter: string;
  name: string;
  units: number;
  active: number;
  created_at: string;
  updated_at: string;
}

/** Driven adapter backed by SQLite. The `uco_procedures` table comes from `ensureSchema`. */
@Injectable()
export class SqliteUcoProcedureRepository extends UcoProcedureRepositoryPort {
  private readonly db: SqliteDatabase;

  constructor(database: SqliteDatabase) {
    super();
    this.db = database;
  }

  async save(procedure: UcoProcedure): Promise<void> {
    try {
      this.db.connection
        .prepare(
          `INSERT INTO uco_procedures
             (id, code, chapter, name, units, active, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          procedure.id,
          procedure.code,
          procedure.chapter,
          procedure.name,
          procedure.units,
          procedure.status === 'active' ? 1 : 0,
          procedure.createdAt.toISOString(),
          procedure.updatedAt.toISOString(),
        );
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new UcoProcedureCodeTakenError(procedure.code);
      }

      throw error;
    }
  }

  async update(procedure: UcoProcedure): Promise<void> {
    const result = this.db.connection
      .prepare(
        `UPDATE uco_procedures
         SET code = ?, chapter = ?, name = ?, units = ?, active = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(
        procedure.code,
        procedure.chapter,
        procedure.name,
        procedure.units,
        procedure.status === 'active' ? 1 : 0,
        procedure.updatedAt.toISOString(),
        procedure.id,
      );

    if (result.changes === 0) {
      throw new UcoProcedureNotFoundError(procedure.id);
    }
  }

  async delete(id: string): Promise<void> {
    const result = this.db.connection
      .prepare('UPDATE uco_procedures SET active = 0, updated_at = ? WHERE id = ?')
      .run(new Date().toISOString(), id);

    if (result.changes === 0) {
      throw new UcoProcedureNotFoundError(id);
    }
  }

  async findById(id: string): Promise<UcoProcedure | null> {
    const row = this.db.connection
      .prepare('SELECT * FROM uco_procedures WHERE id = ?')
      .get(id) as unknown as UcoProcedureRow | undefined;

    return row === undefined ? null : this.toDomain(row);
  }

  async findByCode(code: string): Promise<UcoProcedure | null> {
    const row = this.db.connection
      .prepare('SELECT * FROM uco_procedures WHERE code = ?')
      .get(code) as unknown as UcoProcedureRow | undefined;

    return row === undefined ? null : this.toDomain(row);
  }

  async findAll(): Promise<UcoProcedure[]> {
    const rows = this.db.connection
      .prepare('SELECT * FROM uco_procedures ORDER BY active DESC, name ASC')
      .all() as unknown as UcoProcedureRow[];

    return rows.map((row) => this.toDomain(row));
  }

  async search(q: string, activeOnly: boolean): Promise<UcoProcedure[]> {
    const like = `%${q}%`;
    const base = 'SELECT * FROM uco_procedures WHERE (code LIKE ? OR name LIKE ? OR chapter LIKE ?)';
    const activeClause = activeOnly ? ' AND active = 1' : '';
    const rows = this.db.connection
      .prepare(`${base}${activeClause} ORDER BY active DESC, name ASC`)
      .all(like, like, like) as unknown as UcoProcedureRow[];

    return rows.map((row) => this.toDomain(row));
  }

  private toDomain(row: UcoProcedureRow): UcoProcedure {
    return UcoProcedure.reconstitute(
      {
        code: row.code,
        chapter: row.chapter,
        name: row.name,
        units: row.units,
        status: (row.active === 1 ? 'active' : 'inactive') as UcoStatus,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
      },
      row.id,
    );
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 'SQLITE_CONSTRAINT_UNIQUE'
  );
}
