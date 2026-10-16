import { Injectable } from '@nestjs/common';
import { SqliteDatabase } from '../../../../../shared/infrastructure/database/sqlite-database.js';
import { RoleRepositoryPort, type RoleWithUsage } from '../../../application/ports/role-repository.port.js';
import { Role } from '../../../domain/role.entity.js';
import { RoleNameTakenError, RoleNotFoundError } from '../../../domain/role.errors.js';

/** SQLite status code for a violated UNIQUE constraint (SQLITE_CONSTRAINT_UNIQUE). */
const SQLITE_CONSTRAINT_UNIQUE = 2067;

interface RoleRow {
  id: string;
  name: string;
  description: string;
  permissions: string;
  built_in: number;
  created_at: string;
  updated_at: string;
  user_count?: number;
}

/** Roles with the number of users they are assigned to, for display. */
const SELECT_WITH_USAGE = `
  SELECT r.*, (SELECT COUNT(*) FROM user_roles ur WHERE ur.role_id = r.id) AS user_count
  FROM roles r
`;

/**
 * Driven adapter backed by SQLite. The `roles` table is created by the shared
 * schema (`ensureSchema`); `user_roles` is written by the users context and
 * only read here for usage counts.
 */
@Injectable()
export class SqliteRoleRepository extends RoleRepositoryPort {
  private readonly db: SqliteDatabase;

  constructor(database: SqliteDatabase) {
    super();
    this.db = database;
  }

  async save(role: Role): Promise<void> {
    try {
      this.db.connection
        .prepare(
          `INSERT INTO roles (id, name, description, permissions, built_in, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          role.id,
          role.name,
          role.description,
          JSON.stringify(role.permissions),
          role.builtIn ? 1 : 0,
          role.createdAt.toISOString(),
          role.updatedAt.toISOString(),
        );
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new RoleNameTakenError(role.name);
      }

      throw error;
    }
  }

  async update(role: Role): Promise<void> {
    const result = this.db.connection
      .prepare(
        `UPDATE roles SET name = ?, description = ?, permissions = ?, updated_at = ? WHERE id = ?`,
      )
      .run(
        role.name,
        role.description,
        JSON.stringify(role.permissions),
        role.updatedAt.toISOString(),
        role.id,
      );

    if (result.changes === 0) {
      throw new RoleNotFoundError(role.id);
    }
  }

  async delete(id: string): Promise<void> {
    const result = this.db.connection.prepare('DELETE FROM roles WHERE id = ?').run(id);

    if (result.changes === 0) {
      throw new RoleNotFoundError(id);
    }
  }

  async findById(id: string): Promise<RoleWithUsage | null> {
    const row = this.db.connection
      .prepare(`${SELECT_WITH_USAGE} WHERE r.id = ?`)
      .get(id) as unknown as RoleRow | undefined;

    return row === undefined ? null : this.toUsage(row);
  }

  async findByName(name: string): Promise<Role | null> {
    const row = this.db.connection
      .prepare('SELECT * FROM roles WHERE name = ?')
      .get(name.trim()) as unknown as RoleRow | undefined;

    return row === undefined ? null : this.toDomain(row);
  }

  async findAll(): Promise<RoleWithUsage[]> {
    const rows = this.db.connection
      .prepare(`${SELECT_WITH_USAGE} ORDER BY r.built_in DESC, r.name COLLATE NOCASE ASC`)
      .all() as unknown as RoleRow[];

    return rows.map((row) => this.toUsage(row));
  }

  async countAssignedUsers(roleId: string): Promise<number> {
    const row = this.db.connection
      .prepare('SELECT COUNT(*) AS count FROM user_roles WHERE role_id = ?')
      .get(roleId) as unknown as { count: number };

    return Number(row.count);
  }

  private toUsage(row: RoleRow): RoleWithUsage {
    return { role: this.toDomain(row), userCount: Number(row.user_count ?? 0) };
  }

  private toDomain(row: RoleRow): Role {
    return Role.reconstitute(
      {
        name: row.name,
        description: row.description,
        permissions: JSON.parse(row.permissions) as string[],
        builtIn: row.built_in === 1,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
      },
      row.id,
    );
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Error &&
    'errcode' in error &&
    (error as { errcode?: number }).errcode === SQLITE_CONSTRAINT_UNIQUE
  );
}
