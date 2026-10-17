import { Injectable } from '@nestjs/common';
import {
  PostgresDatabase,
  isUniqueViolation,
  isUuid,
} from '../../../../../shared/infrastructure/database/postgres-database.js';
import { RoleRepositoryPort, type RoleWithUsage } from '../../../application/ports/role-repository.port.js';
import { Role } from '../../../domain/role.entity.js';
import { RoleNameTakenError, RoleNotFoundError } from '../../../domain/role.errors.js';

interface RoleRow {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  built_in: boolean;
  created_at: Date;
  updated_at: Date;
  user_count?: string | number;
}

const SELECT_WITH_USAGE = `
  SELECT r.*, (SELECT COUNT(*) FROM user_roles ur WHERE ur.role_id = r.id) AS user_count
  FROM roles r
`;

@Injectable()
export class PostgresRoleRepository extends RoleRepositoryPort {
  constructor(private readonly db: PostgresDatabase) {
    super();
  }

  async save(role: Role): Promise<void> {
    try {
      await this.db.execute(
        `INSERT INTO roles (id, name, description, permissions, built_in, created_at, updated_at)
         VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)`,
        [
          role.id,
          role.name,
          role.description,
          JSON.stringify(role.permissions),
          role.builtIn,
          role.createdAt,
          role.updatedAt,
        ],
      );
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new RoleNameTakenError(role.name);
      }

      throw error;
    }
  }

  async update(role: Role): Promise<void> {
    try {
      const changed = await this.db.execute(
        `UPDATE roles SET name = $1, description = $2, permissions = $3::jsonb, updated_at = $4
         WHERE id = $5`,
        [role.name, role.description, JSON.stringify(role.permissions), role.updatedAt, role.id],
      );

      if (changed === 0) {
        throw new RoleNotFoundError(role.id);
      }
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new RoleNameTakenError(role.name);
      }

      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    if (!isUuid(id)) {
      throw new RoleNotFoundError(id);
    }

    const changed = await this.db.execute('DELETE FROM roles WHERE id = $1', [id]);

    if (changed === 0) {
      throw new RoleNotFoundError(id);
    }
  }

  async findById(id: string): Promise<RoleWithUsage | null> {
    if (!isUuid(id)) {
      return null;
    }

    const row = await this.db.queryOne<RoleRow>(`${SELECT_WITH_USAGE} WHERE r.id = $1`, [id]);

    return row === null ? null : this.toUsage(row);
  }

  async findByName(name: string): Promise<Role | null> {
    const row = await this.db.queryOne<RoleRow>(
      'SELECT * FROM roles WHERE LOWER(name) = LOWER($1)',
      [name.trim()],
    );

    return row === null ? null : this.toDomain(row);
  }

  async findAll(): Promise<RoleWithUsage[]> {
    const rows = await this.db.query<RoleRow>(
      `${SELECT_WITH_USAGE} ORDER BY r.built_in DESC, LOWER(r.name) ASC`,
    );

    return rows.map((row) => this.toUsage(row));
  }

  async countAssignedUsers(roleId: string): Promise<number> {
    const row = await this.db.queryOne<{ count: string | number }>(
      'SELECT COUNT(*) AS count FROM user_roles WHERE role_id = $1',
      [roleId],
    );

    return Number(row?.count ?? 0);
  }

  private toUsage(row: RoleRow): RoleWithUsage {
    return { role: this.toDomain(row), userCount: Number(row.user_count ?? 0) };
  }

  private toDomain(row: RoleRow): Role {
    return Role.reconstitute(
      {
        name: row.name,
        description: row.description,
        permissions: Array.isArray(row.permissions) ? row.permissions : [],
        builtIn: row.built_in,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
      },
      row.id,
    );
  }
}
