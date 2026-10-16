import { Injectable } from '@nestjs/common';
import { SqliteDatabase } from '../../../../../shared/infrastructure/database/sqlite-database.js';
import { ADMIN_ROLE_NAME } from '../../../../roles/domain/role.entity.js';
import { UserRepositoryPort } from '../../../application/ports/user-repository.port.js';
import { Email } from '../../../domain/email.vo.js';
import { User, type UserStatus } from '../../../domain/user.entity.js';
import { UserAlreadyExistsError, UserNotFoundError } from '../../../domain/user.errors.js';

/** SQLite status code for a violated UNIQUE constraint (SQLITE_CONSTRAINT_UNIQUE). */
const SQLITE_CONSTRAINT_UNIQUE = 2067;

interface UserRow {
  id: string;
  email: string;
  name: string;
  created_at: string;
  password_hash: string | null;
  status: string;
  failed_login_attempts: number;
  locked_until: string | null;
  password_changed_at: string | null;
  must_change_password: number;
  last_login_at: string | null;
}

/**
 * Driven adapter backed by SQLite. It maps rows ⇄ domain objects, translates
 * driver errors into domain errors, and keeps every SQL statement in this
 * file — use cases and entities never see SQL.
 *
 * The `users` and `user_roles` tables are created by the shared schema
 * (`ensureSchema`); `user_roles` is written here because role assignments
 * belong to the user side.
 */
@Injectable()
export class SqliteUserRepository extends UserRepositoryPort {
  private readonly db: SqliteDatabase;

  constructor(database: SqliteDatabase) {
    super();
    this.db = database;
  }

  async save(user: User): Promise<void> {
    try {
      this.db.connection
        .prepare(
          `INSERT INTO users (
             id, email, name, created_at, password_hash, status,
             failed_login_attempts, locked_until, password_changed_at,
             must_change_password, last_login_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          user.id,
          user.email,
          user.name,
          user.createdAt.toISOString(),
          user.passwordHash,
          user.status,
          user.failedLoginAttempts,
          toIso(user.lockedUntil),
          toIso(user.passwordChangedAt),
          user.mustChangePassword ? 1 : 0,
          toIso(user.lastLoginAt),
        );
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new UserAlreadyExistsError(user.email);
      }

      throw error;
    }
  }

  async update(user: User): Promise<void> {
    const result = this.db.connection
      .prepare(
        `UPDATE users SET
           email = ?, name = ?, password_hash = ?, status = ?,
           failed_login_attempts = ?, locked_until = ?, password_changed_at = ?,
           must_change_password = ?, last_login_at = ?
         WHERE id = ?`,
      )
      .run(
        user.email,
        user.name,
        user.passwordHash,
        user.status,
        user.failedLoginAttempts,
        toIso(user.lockedUntil),
        toIso(user.passwordChangedAt),
        user.mustChangePassword ? 1 : 0,
        toIso(user.lastLoginAt),
        user.id,
      );

    if (result.changes === 0) {
      throw new UserNotFoundError(user.id);
    }
  }

  async delete(id: string): Promise<void> {
    const result = this.db.connection.prepare('DELETE FROM users WHERE id = ?').run(id);

    if (result.changes === 0) {
      throw new UserNotFoundError(id);
    }
  }

  async findById(id: string): Promise<User | null> {
    const row = this.db.connection.prepare('SELECT * FROM users WHERE id = ?').get(id) as unknown as
      | UserRow
      | undefined;

    return row === undefined ? null : this.toDomain(row);
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = this.db.connection
      .prepare('SELECT * FROM users WHERE email = ?')
      .get(email) as unknown as UserRow | undefined;

    return row === undefined ? null : this.toDomain(row);
  }

  async findAll(): Promise<User[]> {
    const rows = this.db.connection
      .prepare('SELECT * FROM users ORDER BY rowid ASC')
      .all() as unknown as UserRow[];

    return rows.map((row) => this.toDomain(row));
  }

  async existsActiveAdmin(): Promise<boolean> {
    const row = this.db.connection
      .prepare(
        `SELECT 1 AS found
         FROM users u
         JOIN user_roles ur ON ur.user_id = u.id
         JOIN roles r ON r.id = ur.role_id
         WHERE r.name = ? AND u.status = 'active' AND u.password_hash IS NOT NULL
         LIMIT 1`,
      )
      .get(ADMIN_ROLE_NAME) as unknown as { found: number } | undefined;

    return row !== undefined;
  }

  async listUserIdsWithoutRoles(): Promise<string[]> {
    const rows = this.db.connection
      .prepare(
        `SELECT u.id FROM users u
         WHERE NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id)`,
      )
      .all() as unknown as Array<{ id: string }>;

    return rows.map((row) => row.id);
  }

  async assignRoleToUsers(roleId: string, userIds: readonly string[]): Promise<void> {
    const insert = this.db.connection.prepare(
      'INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)',
    );

    this.db.connection.exec('BEGIN');

    try {
      for (const userId of userIds) {
        insert.run(userId, roleId);
      }

      this.db.connection.exec('COMMIT');
    } catch (error) {
      this.db.connection.exec('ROLLBACK');
      throw error;
    }
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
        lockedUntil: toDate(row.locked_until),
        passwordChangedAt: toDate(row.password_changed_at),
        mustChangePassword: row.must_change_password === 1,
        lastLoginAt: toDate(row.last_login_at),
      },
      row.id,
    );
  }
}

function toIso(date: Date | null): string | null {
  return date === null ? null : date.toISOString();
}

function toDate(value: string | null): Date | null {
  return value === null ? null : new Date(value);
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Error &&
    'errcode' in error &&
    (error as { errcode?: number }).errcode === SQLITE_CONSTRAINT_UNIQUE
  );
}
