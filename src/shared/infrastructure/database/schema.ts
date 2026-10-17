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
    CREATE TABLE IF NOT EXISTS patients (
      id                     TEXT PRIMARY KEY,
      rut                    TEXT NOT NULL UNIQUE,
      nombres                TEXT NOT NULL,
      apellido_paterno       TEXT NOT NULL,
      apellido_materno       TEXT NOT NULL,
      fecha_nacimiento       TEXT NOT NULL,
      sexo                   TEXT NOT NULL,
      email                  TEXT,
      telefono               TEXT,
      direccion_region       TEXT,
      direccion_comuna       TEXT,
      direccion_calle        TEXT,
      direccion_numero       TEXT,
      direccion_departamento TEXT,
      prevision_tipo         TEXT,
      prevision_tramo        TEXT,
      prevision_plan         TEXT,
      contacto_nombre        TEXT,
      contacto_telefono      TEXT,
      contacto_parentesco    TEXT,
      notas                  TEXT,
      numero_historia        TEXT,
      created_at             TEXT NOT NULL
    );
  `);

  // Sequential clinical record number (`HC-000123`), assigned on create and
  // backfilled for pre-existing rows by `PatientNumberBootstrapService`.
  addColumnIfMissing(db, 'patients', 'numero_historia', 'TEXT');
  connection.exec(
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_numero_historia ON patients (numero_historia) WHERE numero_historia IS NOT NULL;',
  );

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

  // Configurable side menu. The *route* lives in code (the frontend route
  // registry); this table only holds the presentation: label, icon, order,
  // visibility and the permission required to see each entry.
  connection.exec(`
    CREATE TABLE IF NOT EXISTS menu_items (
      id                  TEXT PRIMARY KEY,
      parent_id           TEXT REFERENCES menu_items(id) ON DELETE CASCADE,
      kind                TEXT NOT NULL DEFAULT 'item',
      label               TEXT,
      icon                TEXT,
      route_key           TEXT,
      external_url        TEXT,
      position            INTEGER NOT NULL,
      required_permission TEXT,
      enabled             INTEGER NOT NULL DEFAULT 1,
      created_at          TEXT NOT NULL,
      updated_at          TEXT NOT NULL,
      created_by          TEXT REFERENCES users(id) ON DELETE SET NULL,
      updated_by          TEXT REFERENCES users(id) ON DELETE SET NULL
    );
  `);

  connection.exec(`
    CREATE TABLE IF NOT EXISTS clinic_assets (
      id         TEXT PRIMARY KEY,
      variant    TEXT NOT NULL,
      mime       TEXT NOT NULL,
      width      INTEGER NOT NULL,
      height     INTEGER NOT NULL,
      bytes      BLOB NOT NULL,
      size       INTEGER NOT NULL,
      hash       TEXT NOT NULL,
      version    INTEGER NOT NULL,
      active     INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      created_by TEXT REFERENCES users(id)
    );
  `);

  connection.exec(`
    CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles (role_id);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens (user_id);
    CREATE INDEX IF NOT EXISTS idx_password_history_user_id ON password_history (user_id);
    CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys (user_id);
    CREATE INDEX IF NOT EXISTS idx_menu_items_parent ON menu_items (parent_id, position);
    CREATE INDEX IF NOT EXISTS idx_assets_variant ON clinic_assets (variant, active, version DESC);
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
