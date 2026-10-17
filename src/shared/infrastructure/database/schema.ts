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

  // Append-only trail of configuration changes (who/when/what), written by
  // `SettingsAuditService`. Actor emails are resolved at read time by
  // joining `users`, so no account data is duplicated here.
  connection.exec(`
    CREATE TABLE IF NOT EXISTS settings_audit (
      id         TEXT PRIMARY KEY,
      at         TEXT NOT NULL,
      actor_id   TEXT NOT NULL,
      actor_type TEXT NOT NULL,
      changes    TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_settings_audit_at ON settings_audit (at DESC);
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

  // Dental clinical record (ficha clínica): the HCU form sections live in
  // `clinical_records`, the interactive odontogram is an append-only log of
  // findings (`clinical_findings`) and `clinical_events` doubles as the
  // clinical timeline and the audit log.
  connection.exec(`
    CREATE TABLE IF NOT EXISTS clinical_records (
      id                     TEXT PRIMARY KEY,
      patient_id             TEXT NOT NULL UNIQUE REFERENCES patients(id) ON DELETE CASCADE,
      categoria              TEXT NOT NULL,
      embarazada             INTEGER NOT NULL DEFAULT 0,
      motivo_consulta        TEXT,
      enfermedad_actual      TEXT,
      antecedentes           TEXT NOT NULL DEFAULT '{}',
      signos_vitales         TEXT NOT NULL DEFAULT '{}',
      examen_estomatognatico TEXT NOT NULL DEFAULT '{}',
      indicadores            TEXT NOT NULL DEFAULT '{}',
      status                 TEXT NOT NULL DEFAULT 'borrador',
      created_by             TEXT REFERENCES users(id) ON DELETE SET NULL,
      updated_by             TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at             TEXT NOT NULL,
      updated_at             TEXT NOT NULL,
      finalized_at           TEXT,
      finalized_by           TEXT REFERENCES users(id) ON DELETE SET NULL
    );
  `);

  connection.exec(`
    CREATE TABLE IF NOT EXISTS clinical_findings (
      id         TEXT PRIMARY KEY,
      record_id  TEXT NOT NULL REFERENCES clinical_records(id) ON DELETE CASCADE,
      tooth      INTEGER NOT NULL,
      surfaces   TEXT NOT NULL DEFAULT '[]',
      symbol     TEXT NOT NULL,
      state      TEXT NOT NULL,
      recesion   INTEGER,
      movilidad  INTEGER,
      note       TEXT,
      created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL,
      voided_at  TEXT,
      voided_by  TEXT REFERENCES users(id) ON DELETE SET NULL
    );
  `);

  connection.exec(`
    CREATE TABLE IF NOT EXISTS clinical_events (
      id         TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL,
      record_id  TEXT NOT NULL REFERENCES clinical_records(id) ON DELETE CASCADE,
      actor_id   TEXT REFERENCES users(id) ON DELETE SET NULL,
      action     TEXT NOT NULL,
      summary    TEXT,
      payload    TEXT,
      created_at TEXT NOT NULL
    );
  `);

  // Dental fee catalog (Arancel UCO): priced procedures measured in UCO units.
  // `active` is a soft-delete flag so history referencing a procedure keeps
  // resolving. `units` is stored as REAL (decimal UCO units).
  connection.exec(`
    CREATE TABLE IF NOT EXISTS uco_procedures (
      id         TEXT PRIMARY KEY,
      code       TEXT NOT NULL UNIQUE,
      chapter    TEXT NOT NULL,
      name       TEXT NOT NULL,
      units      REAL NOT NULL,
      active     INTEGER NOT NULL DEFAULT 1,
      created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // Quotations / budgets: a snapshot of the patient + the agreed items. Totals
  // are recomputed on the server at save time (never trusted from the client).
  // A sanctioned (closed) quote is immutable; editing requires duplicating it.
  connection.exec(`
    CREATE TABLE IF NOT EXISTS quotes (
      id                  TEXT PRIMARY KEY,
      folio               TEXT NOT NULL UNIQUE,
      patient_id          TEXT NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
      patient_name        TEXT NOT NULL,
      patient_rut         TEXT NOT NULL,
      patient_email       TEXT,
      status              TEXT NOT NULL,
      valid_until         TEXT,
      notes               TEXT,
      subtotal            INTEGER NOT NULL,
      discount_total      INTEGER NOT NULL,
      total               INTEGER NOT NULL,
      version             INTEGER NOT NULL DEFAULT 1,
      replaces_quote_id   TEXT REFERENCES quotes(id) ON DELETE SET NULL,
      created_by          TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_by_name     TEXT NOT NULL,
      created_at          TEXT NOT NULL,
      updated_by          TEXT REFERENCES users(id) ON DELETE SET NULL,
      updated_by_name     TEXT NOT NULL,
      updated_at          TEXT NOT NULL,
      sanctioned_by       TEXT REFERENCES users(id) ON DELETE SET NULL,
      sanctioned_by_name  TEXT,
      sanctioned_at       TEXT
    );
  `);

  // Soft delete (papelera): a trashed quote keeps its folio and history and can
  // be restored. `GET /quotes` hides it unless `deleted=only|all` asks for it.
  addColumnIfMissing(db, 'quotes', 'deleted_at', 'TEXT');
  addColumnIfMissing(db, 'quotes', 'deleted_by', 'TEXT REFERENCES users(id) ON DELETE SET NULL');
  addColumnIfMissing(db, 'quotes', 'deleted_by_name', 'TEXT');

  connection.exec(`
    CREATE TABLE IF NOT EXISTS quote_items (
      id                     TEXT PRIMARY KEY,
      quote_id               TEXT NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
      position               INTEGER NOT NULL,
      uco_code               TEXT REFERENCES uco_procedures(code) ON DELETE SET NULL,
      description            TEXT NOT NULL,
      pieza_dental           TEXT,
      quantity               INTEGER NOT NULL,
      unit_price             INTEGER NOT NULL,
      discount_percent       INTEGER NOT NULL DEFAULT 0,
      subtotal               INTEGER NOT NULL,
      discount_amount        INTEGER NOT NULL DEFAULT 0,
      net_amount             INTEGER NOT NULL,
      status                 TEXT NOT NULL,
      status_changed_by      TEXT REFERENCES users(id) ON DELETE SET NULL,
      status_changed_by_name TEXT,
      status_changed_at      TEXT
    );
  `);

  connection.exec(`
    CREATE TABLE IF NOT EXISTS quote_versions (
      id            TEXT PRIMARY KEY,
      quote_id      TEXT NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
      version       INTEGER NOT NULL,
      action        TEXT NOT NULL,
      snapshot_json TEXT NOT NULL,
      actor_id      TEXT REFERENCES users(id) ON DELETE SET NULL,
      actor_name    TEXT NOT NULL,
      created_at    TEXT NOT NULL
    );
  `);

  connection.exec(`
    CREATE TABLE IF NOT EXISTS quote_counters (
      year        INTEGER PRIMARY KEY,
      last_number INTEGER NOT NULL DEFAULT 0
    );
  `);

  // Dental fee catalog (Arancel UCO): priced procedures measured in UCO units.
  // `active` is a soft-delete flag so history referencing a procedure keeps
  // resolving. `units` is stored as REAL (decimal UCO units).
  connection.exec(`
    CREATE TABLE IF NOT EXISTS uco_procedures (
      id         TEXT PRIMARY KEY,
      code       TEXT NOT NULL UNIQUE,
      chapter    TEXT NOT NULL,
      name       TEXT NOT NULL,
      units      REAL NOT NULL,
      active     INTEGER NOT NULL DEFAULT 1,
      created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // Platform activity trail: one row per relevant action (who, when, what).
  // Written by the `activity` module. Append-only by design: the only write
  // paths are the recorder and the (audited) retention/purge job. `actor_id`
  // intentionally has no foreign key so history survives user deletion.
  connection.exec(`
    CREATE TABLE IF NOT EXISTS activity_log (
      id            TEXT PRIMARY KEY,
      at            TEXT NOT NULL,
      actor_id      TEXT,
      actor_type    TEXT NOT NULL,
      actor_label   TEXT,
      action        TEXT NOT NULL,
      module        TEXT NOT NULL,
      subject_type  TEXT,
      subject_id    TEXT,
      subject_label TEXT,
      outcome       TEXT NOT NULL,
      status_code   INTEGER,
      method        TEXT NOT NULL,
      path          TEXT NOT NULL,
      route         TEXT,
      ip            TEXT,
      user_agent    TEXT,
      metadata      TEXT NOT NULL DEFAULT '{}'
    );
  `);

  connection.exec(`
    CREATE INDEX IF NOT EXISTS idx_activity_at ON activity_log (at DESC);
    CREATE INDEX IF NOT EXISTS idx_activity_actor ON activity_log (actor_id, at DESC);
    CREATE INDEX IF NOT EXISTS idx_activity_action ON activity_log (action, at DESC);
    CREATE INDEX IF NOT EXISTS idx_activity_subject ON activity_log (subject_type, subject_id, at DESC);
  `);

  connection.exec(`
    CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles (role_id);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens (user_id);
    CREATE INDEX IF NOT EXISTS idx_password_history_user_id ON password_history (user_id);
    CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys (user_id);
    CREATE INDEX IF NOT EXISTS idx_menu_items_parent ON menu_items (parent_id, position);
    CREATE INDEX IF NOT EXISTS idx_assets_variant ON clinic_assets (variant, active, version DESC);
    CREATE INDEX IF NOT EXISTS idx_clinical_findings_record ON clinical_findings (record_id, tooth);
    CREATE INDEX IF NOT EXISTS idx_clinical_events_record ON clinical_events (record_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_uco_code ON uco_procedures (code);
    CREATE INDEX IF NOT EXISTS idx_quotes_patient ON quotes (patient_id);
    CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes (status);
    CREATE INDEX IF NOT EXISTS idx_quotes_deleted ON quotes (deleted_at);
    CREATE INDEX IF NOT EXISTS idx_quotes_folio ON quotes (folio);
    CREATE INDEX IF NOT EXISTS idx_quote_items_quote ON quote_items (quote_id, position);
    CREATE INDEX IF NOT EXISTS idx_quote_versions_quote ON quote_versions (quote_id, version);
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
