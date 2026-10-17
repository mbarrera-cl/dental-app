import { Injectable } from '@nestjs/common';
import {
  PostgresDatabase,
  isUniqueViolation,
  isUuid,
} from '../../../../../shared/infrastructure/database/postgres-database.js';
import { ADMIN_ROLE_NAME } from '../../../../roles/domain/role.entity.js';
import { UserRepositoryPort } from '../../../application/ports/user-repository.port.js';
import { Email } from '../../../domain/email.vo.js';
import { User, type UserStatus } from '../../../domain/user.entity.js';
import { UserAlreadyExistsError, UserNotFoundError } from '../../../domain/user.errors.js';

interface UserRow {
  id: string;
  email: string;
  name: string;
  created_at: Date;
  password_hash: string | null;
  status: string;
  failed_login_attempts: number;
  locked_until: Date | null;
  password_changed_at: Date | null;
  must_change_password: boolean;
  last_login_at: Date | null;
}

@Injectable()
export class PostgresUserRepository extends UserRepositoryPort {
  constructor(private readonly db: PostgresDatabase) {
    super();
  }

  async save(user: User): Promise<void> {
    try {
      await this.db.execute(
        `INSERT INTO users (
           id, email, name, created_at, password_hash, status,
           failed_login_attempts, locked_until, password_changed_at,
           must_change_password, last_login_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          user.id,
          user.email,
          user.name,
          user.createdAt,
          user.passwordHash,
          user.status,
          user.failedLoginAttempts,
          user.lockedUntil,
          user.passwordChangedAt,
          user.mustChangePassword,
          user.lastLoginAt,
        ],
      );
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new UserAlreadyExistsError(user.email);
      }

      throw error;
    }
  }

  async update(user: User): Promise<void> {
    const changed = await this.db.execute(
      `UPDATE users SET
         email = $1, name = $2, password_hash = $3, status = $4,
         failed_login_attempts = $5, locked_until = $6, password_changed_at = $7,
         must_change_password = $8, last_login_at = $9
       WHERE id = $10`,
      [
        user.email,
        user.name,
        user.passwordHash,
        user.status,
        user.failedLoginAttempts,
        user.lockedUntil,
        user.passwordChangedAt,
        user.mustChangePassword,
        user.lastLoginAt,
        user.id,
      ],
    );

    if (changed === 0) {
      throw new UserNotFoundError(user.id);
    }
  }

  async delete(id: string): Promise<void> {
    if (!isUuid(id)) {
      throw new UserNotFoundError(id);
    }

    const changed = await this.db.execute('DELETE FROM users WHERE id = $1', [id]);

    if (changed === 0) {
      throw new UserNotFoundError(id);
    }
  }

  async findById(id: string): Promise<User | null> {
    if (!isUuid(id)) {
      return null;
    }

    const row = await this.db.queryOne<UserRow>('SELECT * FROM users WHERE id = $1', [id]);

    return row === null ? null : this.toDomain(row);
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.db.queryOne<UserRow>('SELECT * FROM users WHERE email = $1', [email]);

    return row === null ? null : this.toDomain(row);
  }

  async findAll(): Promise<User[]> {
    const rows = await this.db.query<UserRow>(
      'SELECT * FROM users ORDER BY created_at ASC, id ASC',
    );

    return rows.map((row) => this.toDomain(row));
  }

  async existsActiveAdmin(): Promise<boolean> {
    const row = await this.db.queryOne<{ found: number }>(
      `SELECT 1 AS found
       FROM users u
       JOIN user_roles ur ON ur.user_id = u.id
       JOIN roles r ON r.id = ur.role_id
       WHERE LOWER(r.name) = LOWER($1)
         AND u.status = 'active' AND u.password_hash IS NOT NULL
       LIMIT 1`,
      [ADMIN_ROLE_NAME],
    );

    return row !== null;
  }

  async listUserIdsWithoutRoles(): Promise<string[]> {
    const rows = await this.db.query<{ id: string }>(
      `SELECT u.id FROM users u
       WHERE NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id)
       ORDER BY u.created_at ASC, u.id ASC`,
    );

    return rows.map((row) => row.id);
  }

  async assignRoleToUsers(roleId: string, userIds: readonly string[]): Promise<void> {
    await this.db.transaction(async (client) => {
      for (const userId of userIds) {
        await client.query(
          `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [userId, roleId],
        );
      }
    });
  }

  async setRoles(userId: string, roleIds: readonly string[]): Promise<void> {
    await this.replaceLinks(
      'DELETE FROM user_roles WHERE user_id = $1',
      'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      userId,
      roleIds,
    );
  }

  async setDirectPermissions(userId: string, permissionKeys: readonly string[]): Promise<void> {
    await this.replaceLinks(
      'DELETE FROM user_permissions WHERE user_id = $1',
      `INSERT INTO user_permissions (user_id, permission_key, granted_at)
       VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      userId,
      permissionKeys,
      () => new Date(),
    );
  }

  async findAdminRoleId(): Promise<string | null> {
    const row = await this.db.queryOne<{ id: string }>(
      'SELECT id FROM roles WHERE LOWER(name) = LOWER($1)',
      [ADMIN_ROLE_NAME],
    );

    return row?.id ?? null;
  }

  async isActiveAdmin(userId: string): Promise<boolean> {
    const row = await this.db.queryOne<{ found: number }>(
      `SELECT 1 AS found
       FROM users u
       JOIN user_roles ur ON ur.user_id = u.id
       JOIN roles r ON r.id = ur.role_id
       WHERE u.id = $1 AND LOWER(r.name) = LOWER($2)
         AND u.status = 'active' AND u.password_hash IS NOT NULL
       LIMIT 1`,
      [userId, ADMIN_ROLE_NAME],
    );

    return row !== null;
  }

  async countActiveAdmins(): Promise<number> {
    const row = await this.db.queryOne<{ total: string | number }>(
      `SELECT COUNT(DISTINCT u.id) AS total
       FROM users u
       JOIN user_roles ur ON ur.user_id = u.id
       JOIN roles r ON r.id = ur.role_id
       WHERE LOWER(r.name) = LOWER($1)
         AND u.status = 'active' AND u.password_hash IS NOT NULL`,
      [ADMIN_ROLE_NAME],
    );

    return Number(row?.total ?? 0);
  }

  private async replaceLinks(
    deleteSql: string,
    insertSql: string,
    userId: string,
    values: readonly string[],
    extraColumn: (() => Date) | null = null,
  ): Promise<void> {
    await this.db.transaction(async (client) => {
      await client.query(deleteSql, [userId]);

      for (const value of values) {
        const params: unknown[] = [userId, value];

        if (extraColumn !== null) {
          params.push(extraColumn());
        }

        await client.query(insertSql, params);
      }
    });
  }

  private toDomain(row: UserRow): User {
    return User.reconstitute(
      {
        email: Email.create(row.email),
        name: row.name,
        createdAt: new Date(row.created_at),
        passwordHash: row.password_hash,
        status: (row.status === 'disabled' ? 'disabled' : 'active') as UserStatus,
        failedLoginAttempts: Number(row.failed_login_attempts),
        lockedUntil: row.locked_until === null ? null : new Date(row.locked_until),
        passwordChangedAt:
          row.password_changed_at === null ? null : new Date(row.password_changed_at),
        mustChangePassword: row.must_change_password,
        lastLoginAt: row.last_login_at === null ? null : new Date(row.last_login_at),
      },
      row.id,
    );
  }
}
