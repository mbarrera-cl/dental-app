#!/usr/bin/env node
/**
 * Seeds the users API with demo records (goes through the REST API, so the
 * full hexagon — validation, use cases, SQLite adapter — is exercised).
 *
 * Usage: node scripts/seed-users.mjs [count] [baseUrl]
 *   node scripts/seed-users.mjs 100 http://localhost:3000
 *
 * Requires a running server. Signs in as the bootstrap administrator first
 * (override with ADMIN_EMAIL / ADMIN_PASSWORD). Re-running is safe: existing
 * emails (409) are reported as "skipped".
 */
const count = Number.parseInt(process.argv[2] ?? '100', 10);
const baseUrl = process.argv[3] ?? process.env.BASE_URL ?? 'http://localhost:3000';
const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@hexa.local';
const adminPassword = process.env.ADMIN_PASSWORD ?? 'Admin123!';

/** Signs in as the administrator and returns the `Authorization` header. */
async function login() {
  const response = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: adminEmail, password: adminPassword }),
  });

  if (!response.ok) {
    console.error(
      `Could not sign in as ${adminEmail} (${response.status}). ` +
        'Set ADMIN_EMAIL/ADMIN_PASSWORD if you changed the bootstrap admin.',
    );
    process.exit(1);
  }

  const { accessToken } = await response.json();

  return `Bearer ${accessToken}`;
}

const FIRST_NAMES = [
  'Ada',
  'Grace',
  'Alan',
  'Katherine',
  'Linus',
  'Margaret',
  'Dennis',
  'Barbara',
  'Brian',
  'Radia',
];

const LAST_NAMES = [
  'Lovelace',
  'Hopper',
  'Turing',
  'Johnson',
  'Torvalds',
  'Hamilton',
  'Ritchie',
  'Liskov',
  'Kernighan',
  'Perlman',
];

async function main() {
  const authorization = await login();
  let created = 0;
  let skipped = 0;
  const failures = [];

  for (let i = 0; i < count; i++) {
    const first = FIRST_NAMES[i % FIRST_NAMES.length];
    const last = LAST_NAMES[Math.floor(i / FIRST_NAMES.length) % LAST_NAMES.length];
    const payload = {
      email: `${first.toLowerCase()}.${last.toLowerCase()}@example.com`,
      name: `${first} ${last}`,
    };

    const response = await fetch(`${baseUrl}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authorization },
      body: JSON.stringify(payload),
    });

    if (response.status === 201) {
      created++;
    } else if (response.status === 409) {
      skipped++;
    } else {
      failures.push({ email: payload.email, status: response.status, body: await response.text() });
    }
  }

  console.log(`Seeded ${created}/${count} users (skipped: ${skipped}) at ${baseUrl}`);

  if (failures.length > 0) {
    console.error('Failures:');
    for (const failure of failures.slice(0, 5)) {
      console.error(` - ${failure.email} → ${failure.status} ${failure.body}`);
    }
    process.exitCode = 1;
  }
}

await main();
