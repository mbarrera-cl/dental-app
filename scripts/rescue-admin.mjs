#!/usr/bin/env node
/**
 * Emergency rescue of the administrator account, straight through PostgreSQL
 * (no HTTP, no session needed): restores or creates the account, grants the
 * built-in `admin` role, clears any lock/disablement and sets a fresh
 * password — printed exactly once. The `admin` role permissions are synced
 * with the catalog on the next backend boot.
 *
 * Usage:
 *   node --env-file=.env scripts/rescue-admin.mjs
 *   node --env-file=.env.postgres scripts/rescue-admin.mjs ada@example.com
 *   ADMIN_PASSWORD='...' node --env-file=.env scripts/rescue-admin.mjs
 */
import { randomBytes, randomUUID, scrypt } from 'node:crypto';
import { promisify } from 'node:util';
import pg from 'pg';

const { Pool } = pg;
const scryptAsync = promisify(scrypt);

/** Must match `src/shared/security/password-hasher.ts`. */
const SCRYPT = { cost: 16384, blockSize: 8, parallelization: 1, keyLength: 64, saltLength: 16 };

const databaseUrl = process.env.DATABASE_URL?.trim();
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

if (!databaseUrl) {
  console.error('DATABASE_URL is required (PostgreSQL connection string).');
  process.exit(1);
}

const pool = new Pool({ connectionString: databaseUrl });
const client = await pool.connect();

try {
  const schema = await client.query(
    "SELECT 1 AS found FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users'",
  );

  if (schema.rowCount === 0) {
    console.error('The database has no schema yet. Boot the API once so it creates the tables.');
    process.exit(1);
  }

  const passwordHash = await hash(password);

  // 1. The built-in admin role (created by the identity bootstrap on boot).
  let role = await client.query(
    "SELECT id FROM roles WHERE LOWER(name) = LOWER('admin') LIMIT 1",
  );

  if (role.rowCount === 0) {
    const roleId = randomUUID();
    await client.query(
      `INSERT INTO roles (id, name, description, permissions, built_in, created_at, updated_at)
       VALUES ($1, 'admin', 'Built-in administrator (recreated by rescue).', '[]'::jsonb, TRUE, NOW(), NOW())`,
      [roleId],
    );
    role = { rows: [{ id: roleId }] };
    console.log('Recreated the built-in "admin" role; its permissions sync on the next boot.');
  }

  // 2. The account: restored (active, unlocked, fresh password) or created.
  const existing = await client.query('SELECT id FROM users WHERE email = $1', [email]);
  let userId;

  if (existing.rowCount === 0) {
    userId = randomUUID();
    await client.query(
      `INSERT INTO users
         (id, email, name, created_at, password_hash, status, failed_login_attempts,
          locked_until, password_changed_at, must_change_password, last_login_at)
       VALUES ($1, $2, 'Administrator', NOW(), $3, 'active', 0, NULL, NOW(), FALSE, NULL)`,
      [userId, email, passwordHash],
    );
  } else {
    userId = existing.rows[0].id;
    await client.query(
      `UPDATE users
          SET password_hash = $1, status = 'active', failed_login_attempts = 0,
              locked_until = NULL, password_changed_at = NOW(), must_change_password = FALSE
        WHERE id = $2`,
      [passwordHash, userId],
    );
  }

  // 3. The admin role on the account (keeps any other roles intact).
  await client.query(
    'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [userId, role.rows[0].id],
  );

  console.log(
    existing.rowCount === 0
      ? `Created administrator "${email}" with a fresh password:`
      : `Restored administrator "${email}" with a fresh password:`,
  );
  console.log(`\n  ${password}\n`);
  console.log('Store it now: it will not be shown again. Change it after signing in.');
} finally {
  client.release();
  await pool.end();
}
