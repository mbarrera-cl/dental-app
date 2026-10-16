import type { SqliteDatabase } from './sqlite-database.js';

/**
 * Creates the full database schema (idempotently) and upgrades existing
 * databases in place.
 *
 * The boilerplate intentionally ships no migration framework: `CREATE TABLE
 * IF NOT EXISTS` covers new tables, and `addColumnIfMissing` covers columns
 * added to pre-existing tables. `SqliteDatabase` calls this on construction,
 * so every instance — the file-backed database and the `:memory:` ones used
 * by tests — is always up to date.
 */
export function ensureSchema(db: SqliteDatabase): void {
  const connection = db.connection;

  connection.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id         TEXT PRIMARY KEY,
      email      TEXT NOT NULL UNIQUE,
      name       TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  // Columns added by the authentication feature; pre-existing databases get
  // them added in place.
  addColumnIfMissing(db, 'users', 'password_hash', 'TEXT');
  addColumnIfMissing(db, 'users', 'status', "TEXT NOT NULL DEFAULT 'active'");
  addColumnIfMissing(db, 'users', 'failed_login_attempts', 'INTEGER NOT NULL DEFAULT 0');
  addColumnIfMissing(db, 'users', 'locked_until', 'TEXT');
  addColumnIfMissing(db, 'users', 'password_changed_at', 'TEXT');
  addColumnIfMissing(db, 'users', 'must_change_password', 'INTEGER NOT NULL DEFAULT 0');
  addColumnIfMissing(db, 'users', 'last_login_at', 'TEXT');

  connection.exec(`
    CREATE TABLE IF NOT EXISTS roles (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL UNIQUE COLLATE NOCASE,
      description TEXT NOT NULL DEFAULT '',
      permissions TEXT NOT NULL DEFAULT '[]',
      built_in    INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL
    );
  `);

  connection.exec(`
    CREATE TABLE IF NOT EXISTS user_roles (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      PRIMARY KEY (user_id, role_id)
    );
  `);

  connection.exec(`
    CREATE TABLE IF NOT EXISTS user_permissions (
      user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      permission_key TEXT NOT NULL,
      granted_at     TEXT NOT NULL,
      PRIMARY KEY (user_id, permission_key)
    );
  `);

  connection.exec(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      revoked_at TEXT,
      created_at TEXT NOT NULL
    );
  `);

  connection.exec(`
    CREATE TABLE IF NOT EXISTS password_history (
      id            TEXT PRIMARY KEY,
      user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      password_hash TEXT NOT NULL,
      created_at    TEXT NOT NULL
    );
  `);

  connection.exec(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id           TEXT PRIMARY KEY,
      user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name         TEXT NOT NULL,
      prefix       TEXT NOT NULL,
      key_hash     TEXT NOT NULL UNIQUE,
      scopes       TEXT,
      expires_at   TEXT,
      last_used_at TEXT,
      revoked_at   TEXT,
      created_at   TEXT NOT NULL
    );
  `);

  connection.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // Tiny key/value store for one-shot bootstrapping markers (this is *not*
  // part of the configurable settings registry).
  connection.exec(`
    CREATE TABLE IF NOT EXISTS bootstrap_state (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  connection.exec(`
    CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles (role_id);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens (user_id);
    CREATE INDEX IF NOT EXISTS idx_password_history_user_id ON password_history (user_id);
    CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys (user_id);
  `);
}

/**
 * Adds `column` to `table` unless it already exists — SQLite has no
 * `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`. Table and column names are
 * internal constants, never user input.
 */
export function addColumnIfMissing(
  db: SqliteDatabase,
  table: string,
  column: string,
  definition: string,
): void {
  const columns = db.connection.prepare(`PRAGMA table_info(${table})`).all() as unknown as Array<{
    name: string;
  }>;

  if (columns.some((existing) => existing.name === column)) {
    return;
  }

  db.connection.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}
