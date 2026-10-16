import { Injectable } from '@nestjs/common';
import { SqliteDatabase } from '../../../../../shared/infrastructure/database/sqlite-database.js';
import { UserRepositoryPort } from '../../../application/ports/user-repository.port.js';
import { Email } from '../../../domain/email.vo.js';
import { User } from '../../../domain/user.entity.js';
import { UserAlreadyExistsError, UserNotFoundError } from '../../../domain/user.errors.js';

/** SQLite status code for a violated UNIQUE constraint (SQLITE_CONSTRAINT_UNIQUE). */
const SQLITE_CONSTRAINT_UNIQUE = 2067;

interface UserRow {
  id: string;
  email: string;
  name: string;
  created_at: string;
}

/**
 * Driven adapter backed by SQLite. It maps rows ⇄ domain objects, translates
 * driver errors into domain errors, and keeps every SQL statement in this
 * file — use cases and entities never see SQL.
 */
@Injectable()
export class SqliteUserRepository extends UserRepositoryPort {
  private readonly db: SqliteDatabase;

  constructor(database: SqliteDatabase) {
    super();
    this.db = database;

    this.db.connection.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id         TEXT PRIMARY KEY,
        email      TEXT NOT NULL UNIQUE,
        name       TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
  }

  async save(user: User): Promise<void> {
    try {
      this.db.connection
        .prepare('INSERT INTO users (id, email, name, created_at) VALUES (?, ?, ?, ?)')
        .run(user.id, user.email, user.name, user.createdAt.toISOString());
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new UserAlreadyExistsError(user.email);
      }

      throw error;
    }
  }

  async update(user: User): Promise<void> {
    const result = this.db.connection
      .prepare('UPDATE users SET email = ?, name = ? WHERE id = ?')
      .run(user.email, user.name, user.id);

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

  private toDomain(row: UserRow): User {
    return User.reconstitute(
      {
        email: Email.create(row.email),
        name: row.name,
        createdAt: new Date(row.created_at),
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
