#!/usr/bin/env node
/**
 * Emergency rescue of the administrator account, straight through SQLite (no
 * HTTP, no session needed): restores or creates the account, grants the
 * built-in `admin` role, clears any lock/disablement and sets a fresh
 * password — printed exactly once. The `admin` role permissions are synced
 * with the catalog on the next backend boot.
 *
 * Usage:
 *   node scripts/rescue-admin.mjs                    # admin@hexa.local
 *   node scripts/rescue-admin.mjs ada@example.com    # rescue any account
 *   ADMIN_PASSWORD='...' node scripts/rescue-admin.mjs
 */
import { randomBytes, randomUUID, scrypt } from 'node:crypto';
import { existsSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

/** Must match `src/shared/security/password-hasher.ts`. */
const SCRYPT = { cost: 16384, blockSize: 8, parallelization: 1, keyLength: 64, saltLength: 16 };

const dbPath = process.env.DATABASE_PATH ?? 'data/hexa.sqlite';
const email = (process.argv[2] ?? process.env.ADMIN_EMAIL ?? 'admin@hexa.local').trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD ?? randomBytes(18).toString('base64url');

async function hash(value) {
  const salt = randomBytes(SCRYPT.saltLength);
  const derived = await scryptAsync(value, salt, SCRYPT.keyLength, {
    N: SCRYPT.cost,
    r: SCRYPT.blockSize,
    p: SCRYPT.parallelization,
  });

  return [
    'scrypt',
    SCRYPT.cost,
    SCRYPT.blockSize,
    SCRYPT.parallelization,
    salt.toString('base64'),
    derived.toString('base64'),
  ].join('$');
}

if (!existsSync(dbPath)) {
  console.error(`Database not found at ${dbPath}. Boot the API once or set DATABASE_PATH.`);
  process.exit(1);
}

const db = new DatabaseSync(dbPath);

try {
  const schema = db
    .prepare("SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = 'users'")
    .get();

  if (schema === undefined) {
    console.error('The database has no schema yet. Boot the API once so it creates the tables.');
    process.exit(1);
  }

  const now = new Date().toISOString();
  const passwordHash = await hash(password);

  // 1. The built-in admin role (created by the identity bootstrap on boot).
  let role = db.prepare("SELECT id FROM roles WHERE name = 'admin'").get();

  if (role === undefined) {
    role = { id: randomUUID() };
    db.prepare(
      'INSERT INTO roles (id, name, description, permissions, built_in, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)',
    ).run(
      role.id,
      'admin',
      'Built-in administrator (recreated by rescue).',
      '[]',
      now,
      now,
    );
    console.log('Recreated the built-in "admin" role; its permissions sync on the next boot.');
  }

  // 2. The account: restored (active, unlocked, fresh password) or created.
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  let userId;

  if (existing === undefined) {
    userId = randomUUID();
    db.prepare(
      `INSERT INTO users
         (id, email, name, created_at, password_hash, status, failed_login_attempts,
          locked_until, password_changed_at, must_change_password, last_login_at)
       VALUES (?, ?, ?, ?, ?, 'active', 0, NULL, ?, 0, NULL)`,
    ).run(userId, email, 'Administrator', now, passwordHash, now);
  } else {
    userId = existing.id;
    db.prepare(
      `UPDATE users
          SET password_hash = ?, status = 'active', failed_login_attempts = 0,
              locked_until = NULL, password_changed_at = ?, must_change_password = 0
        WHERE id = ?`,
    ).run(passwordHash, now, userId);
  }

  // 3. The admin role on the account (keeps any other roles intact).
  db.prepare('INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)').run(userId, role.id);

  console.log(
    existing === undefined
      ? `Created administrator "${email}" with a fresh password:`
      : `Restored administrator "${email}" with a fresh password:`,
  );
  console.log(`\n  ${password}\n`);
  console.log('Store it now: it will not be shown again. Change it after signing in.');
} finally {
  db.close();
}
