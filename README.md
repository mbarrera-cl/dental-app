# hexa — dental clinic platform

hexa is a dental clinic management platform for the Chilean market. The backend
is a production-minded **NestJS 12 API built with hexagonal architecture**
(ports & adapters): the business logic lives in the center, completely
independent of NestJS, HTTP and databases, and everything else is a swappable
adapter around it. The frontend is an **Angular 22 microfrontend workspace** — a
shell plus `patients`, `users` and `dashboard` remotes composed at runtime with
Native Federation.

What ships working today:

- **Patient records (ficha)** — the Chilean fields done right: validated RUT as
  the business key (módulo 11 check digit, normalized to `12345678-5`),
  region/commune address, FONASA ⇄ ISAPRE coverage, emergency contact. Full CRUD
  plus lookup by RUT, and a sequential **N° de Historia Clínica** (`HC-000001`)
  assigned on creation.
- **Dental clinical record (ficha clínica, HCU-form.033)** — the SNS-MSP dental
  history: header autofilled from the patient, age category, motivo/enfermedad
  actual, antecedentes, signos vitales and examen estomatognático; an
  **append-only odontogram** (permanent 18–48 + primary 55–85, 5 surfaces + root,
  red = pending / blue = completed, recession/mobility grades, void-with-audit)
  and the **derived indices** (CPO/ceo, simplified oral hygiene) recomputed
  server-side from the findings.
- **Authentication & RBAC** — JWT access tokens plus a rotating refresh token in
  an httpOnly cookie, configurable roles and per-user permissions, and a
  runtime-configurable password policy with history.
- **Staff accounts** — users CRUD guarded by permissions; the built-in `admin`
  role is re-synced with the permission catalog on every boot.
- **Dashboard** — live summary: total patients and the most recent ones.
- **Settings** — typed, runtime-configurable settings.

Coming next: the **treatment plan + clinical timeline** (the audit events are
already recorded), radiographs, an auto-generated PDF of the HCU form and the
digital-signature locking UI. See [Roadmap](#roadmap).

## Stack

| Concern            | Choice                                             |
| ------------------ | -------------------------------------------------- |
| Backend            | NestJS 12 (Express)                                |
| Language           | TypeScript 6, strict, native ESM (`nodenext`)      |
| Database           | SQLite via `node:sqlite` (built into Node 24+)     |
| Auth               | JWT (HS256) + rotating refresh cookie              |
| Validation         | `class-validator` / `class-transformer` at the edge |
| API docs           | Swagger / OpenAPI at `/docs`                       |
| Testing            | Vitest (unit, adapter integration, e2e supertest)  |
| Linting/formatting | oxlint (type-aware) + Prettier                     |
| Frontend           | Angular 22 · Native Federation · spartan/ui · Transloco |

## The architecture

```
              ┌───────────────────────────────────────────────────┐
              │                  infrastructure                   │
              │  ┌─────────────────────┐  ┌─────────────────────┐ │
              │  │  driving adapters   │  │  driven adapters    │ │
              │  │  (HTTP controllers) │  │  (repositories)     │ │
              │  └──────────┬──────────┘  └──────────▲──────────┘ │
              └─────────────┼────────────────────────┼────────────┘
                            │ calls                  │ implements ports
              ┌─────────────▼────────────────────────┴────────────┐
              │                    application                    │
              │        use cases ──► ports (interfaces)           │
              └─────────────────────────┬─────────────────────────┘
                                        │ calls
              ┌─────────────────────────▼─────────────────────────┐
              │                      domain                       │
              │    entities · value objects · domain errors       │
              └───────────────────────────────────────────────────┘

        The dependency rule: source code dependencies point inward only.
```

- **domain** — pure TypeScript. Entities, value objects and domain errors. No imports
  from NestJS, HTTP or any library. This is where all business invariants live.
- **application** — the use cases (one class per use case, `execute()` in, domain
  object out) and the **ports**: interfaces describing what the application needs
  (e.g. `UserRepositoryPort`). Depends only on the domain.
- **infrastructure** —
  - *driving* adapters translate the outside world into use case calls
    (`UsersController` maps HTTP → command).
  - *driven* adapters implement ports (`SqliteUserRepository` implements the
    repository port).
  - This is the only layer aware of NestJS specifics like modules, pipes, filters —
    and the only layer that gets deleted/replaced when technology changes.

## Directory layout

```
src/
├── main.ts                          # HTTP bootstrap (delegates to configureApp)
├── app.module.ts                    # Root module — feature modules + global guards
├── shared/                          # Cross-cutting building blocks
│   ├── domain/                      # Entity, ValueObject, DomainError base classes
│   ├── application/                 # UseCase contract
│   ├── security/                    # JWT + permissions guards, decorators, permission catalog
│   └── infrastructure/
│       ├── app-setup.ts             # configureApp: pipes, filters, Swagger
│       ├── bootstrap/               # Identity bootstrap: admin account + role sync on boot
│       ├── http/                    # DomainExceptionFilter
│       └── database/                # SqliteDatabase + DatabaseModule (ensureSchema)
└── modules/                         # One folder per bounded context
    ├── apikeys/                     # Programmatic API keys (scoped to their owner)
    ├── auth/                        # Login, refresh rotation, logout, password flows
    ├── clinical/                    # Dental clinical record (ficha HCU): odontogram + indices
    ├── patients/                    # Dental patients (Chilean RUT + health data)
    │   ├── domain/                  # Patient entity, Rut/Telefono/Previsión VOs …
    │   ├── application/             # PatientRepositoryPort + use cases (+ specs)
    │   └── infrastructure/          # Sqlite/InMemory repositories, controller, DTOs
    ├── roles/                       # Configurable roles over the permission catalog
    ├── settings/                    # Typed runtime settings (e.g. password policy)
    └── users/                       # Staff accounts
        ├── domain/                  # User entity, Email value object, domain errors
        ├── application/
        │   ├── ports/               # UserRepositoryPort (driven port)
        │   └── use-cases/           # Create, Get, List, Update, Delete + specs
        └── infrastructure/
            ├── adapters/            # SqliteUserRepository (+ integration spec)
            │                        # InMemoryUserRepository (test double)
            └── http/                # UsersController + request/response DTOs
```

## Request flow: `POST /users`

0. The global `JwtAuthGuard` authenticates the request (Bearer access token) and
   the permissions guard checks `users:create` — a request without a valid session
   and the permission never reaches the controller (`401` / `403`).
1. `UsersController.create` receives the request; `CreateUserRequestDto` is validated
   by the global `ValidationPipe` (rejects unknown fields, wrong types, bad emails).
2. The controller maps the DTO to a `CreateUserCommand` and calls
   `CreateUserUseCase.execute`.
3. The use case builds the `User` aggregate — the `Email` value object validates and
   normalizes the address — then checks `UserRepositoryPort.findByEmail`.
4. `UserAlreadyExistsError` (a `DomainError` with `kind: 'conflict'`) would be thrown
   here; the `DomainExceptionFilter` at the edge turns it into `409 Conflict`.
5. The bound adapter (`SqliteUserRepository`) inserts the row. If the unique
   constraint fires anyway, the adapter translates the driver error into the same
   `UserAlreadyExistsError`.
6. The controller maps the `User` to `UserResponseDto` and returns `201`.

`POST /patients` walks the same path: the `Rut` value object validates the módulo 11
check digit and normalizes the RUT to `12345678-5`, the `Prevision` value object
enforces the FONASA ⇄ ISAPRE invariants, `PatientAlreadyExistsError` becomes a
`409 Conflict`, and the SQLite adapter translates the `UNIQUE` violation on `rut` the
same way.

## Getting started

Requires **Node.js 24+** (native ESM and the stable `node:sqlite` module).

```bash
npm install
npm run start:dev
```

- API: <http://localhost:3000>
- Swagger UI: <http://localhost:3000/docs>

**Sign in first.** Every endpoint except the `/auth` ones requires a session, so
the API seeds a guaranteed administrator on boot:
`admin@hexa.local` / `Admin123!` (override with `ADMIN_EMAIL` / `ADMIN_PASSWORD`
— change it in production). See [Authentication & RBAC](#authentication--rbac).

**CORS:** the API allows the microfrontend dev servers
(`http://localhost:4200`, `:4201`, `:4202`, `:4203`, `:4204`) by default.
Override the allow-list with a comma-separated env var:
`CORS_ORIGIN=https://app.example.com,https://admin.example.com` (credentials
are enabled, so `*` is not allowed).

## Authentication & RBAC

- **Access token** — JWT (HS256) signed with `JWT_SECRET` (a dev fallback is used
  outside production), sent as `Authorization: Bearer <token>`. The frontend keeps
  it in memory only.
- **Refresh token** — httpOnly cookie (`hexa_refresh`, scoped to `/auth`), rotated
  on every `POST /auth/refresh` with replay detection; `POST /auth/logout` revokes
  it. Cookie flags are configurable via `COOKIE_SAMESITE` and `COOKIE_SECURE`.
- **Password policy** — length, character classes and history reuse are runtime
  settings (seeded by default, adjustable through `PATCH /settings`).
- **RBAC** — permissions are declared per endpoint with
  `@RequirePermissions('patients:read')` from the code catalog and resolved per
  request as the union of the principal's roles plus direct grants. The built-in
  `admin` role is protected and always kept in sync with the catalog.

```bash
# Sign in: the response carries the access token; the refresh token lands in a cookie
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@hexa.local","password":"Admin123!"}' | jq -r .accessToken)

# Call any protected endpoint with it
curl -s http://localhost:3000/patients -H "Authorization: Bearer $TOKEN"
```

### Permission catalog

Permissions are grouped in categories (one per module, plus a UI-only
`dashboard` category) and declared in code:

| Category    | Permissions                                                                                                  |
| ----------- | ------------------------------------------------------------------------------------------------------------ |
| `users`     | `users:read` · `users:create` · `users:update` · `users:delete` · `users:reset-password` · `users:permissions` |
| `patients`  | `patients:read` · `patients:create` · `patients:update` · `patients:delete`                                   |
| `clinical`  | `clinical:read` · `clinical:create` · `clinical:update`                                                       |
| `roles`     | `roles:read` · `roles:create` · `roles:update` · `roles:delete`                                               |
| `settings`  | `settings:read` · `settings:update`                                                                           |
| `apikeys`   | `apikeys:self` · `apikeys:read` · `apikeys:manage`                                                            |
| `dashboard` | `dashboard:read`                                                                                              |

The **effective permissions** of a principal are the union of its roles plus
direct grants, resolved per request by the global guards
(`@RequirePermissions` = allOf, `@RequireAnyPermissions` = anyOf, `@Public()`
opts a route out). Roles are 100% data-driven — the admin panel creates and
edits them against the same catalog.

**Seeded roles:**

- `admin` — built-in and protected: synced with the full catalog on every
  boot, its name is frozen and it must keep every administration permission
  (`ADMIN_CRITICAL_PERMISSIONS`), so the system cannot lock itself out.
- `editor` — viewer plus user creation and editing (no deletions, no
  roles/settings administration).
- `viewer` — dashboard, user list and own API keys.

**Workflow — adding a permission (3 steps):**

1. Add the key to the category in the owning module
   (`src/modules/<context>/permissions.ts`); the aggregator picks it up.
2. Protect the endpoint with `@RequirePermissions('<key>')` (or
   `@RequireAnyPermissions`).
3. Add its label under `permissions.items` in
   `frontend/projects/ui/src/lib/i18n/translations` (es + en).

The boot-time sync grants new keys to `admin` automatically and the permission
matrix shows them in every role editor.

### Settings (runtime configuration)

Every value lives in the `settings` table and is editable from the admin panel.
The registry (`src/modules/settings/domain/settings-registry.ts`) is the single
source of truth: type, bounds, default and description.

| Group            | Setting                        | Default | Meaning                              |
| ---------------- | ------------------------------ | ------- | ------------------------------------ |
| `passwordPolicy` | `minLength` / `maxLength`      | 8 / 128 | Length bounds                        |
| `passwordPolicy` | `requireUppercase` … `requireSymbol` | true | Character-class rules                |
| `passwordPolicy` | `historyCount`                 | 3       | Passwords that cannot be reused (0 = off) |
| `passwordPolicy` | `expirationDays`               | 90      | Password expiry (0 = never)          |
| `login`          | `maxFailedAttempts`            | 5       | Lockout threshold (0 = off)          |
| `login`          | `lockDurationMinutes`          | 15      | Lockout window                       |
| `session`        | `accessTokenTtlMinutes`        | 15      | Access token lifetime                |
| `session`        | `refreshTokenTtlDays`          | 7       | Refresh token lifetime               |
| `apiKeys`        | `defaultExpirationDays`        | 0       | Default key expiry (0 = never)       |
| `apiKeys`        | `maxKeysPerUser`               | 10      | Active keys per user                 |

**Adding a setting:** one entry in `SETTING_DEFINITIONS` (+ an i18n label).
`GET /settings` returns it and the admin panel renders the right control with
no frontend change; `PATCH /settings` validates type, bounds and unknown keys.

### API keys

Personal credentials that act **as their owner**: on every request the key's
scopes are intersected with the owner's *current* effective permissions, so
changing a role or disabling the account applies instantly. Secrets
(`hexa_<fingerprint>_<random>`) carry 256 bits of entropy and are stored as
SHA-256 hashes — no scrypt needed — and shown exactly once.

```bash
# Create a key scoped to the dashboard (omit `scopes` to inherit everything)
curl -s -X POST http://localhost:3000/apikeys \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"ci","scopes":["dashboard:read"],"expiresInDays":90}'

# Use it like a bearer token
curl -s http://localhost:3000/permissions -H 'X-Api-Key: hexa_ab12cd34_...'
```

With `apikeys:self` any user manages their own keys; `apikeys:read` lists any
user's keys (`?userId=`, `?all=true`) and `apikeys:manage` creates, rotates and
revokes on behalf of others. Rotation keeps identity and scopes but kills the
old secret immediately; `apiKeys.maxKeysPerUser` counts only active keys.

### Environment variables

| Variable                          | Default                        | Purpose                                                                |
| --------------------------------- | ------------------------------ | ---------------------------------------------------------------------- |
| `JWT_SECRET`                      | dev fallback (with a warning)  | HS256 signing key — **required in production**                         |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD`  | `admin@hexa.local` / `Admin123!` | Bootstrap admin (created only when no active admin exists)           |
| `COOKIE_SAMESITE`                 | `lax`                          | Refresh cookie SameSite; cross-site prod → `none`                      |
| `COOKIE_SECURE`                   | `true` in production           | Force `Secure` on the refresh cookie                                   |
| `CORS_ORIGIN`                     | the dev servers `:4200`–`:4204` | Comma-separated allow-list (credentials enabled: no `*`)              |
| `DATABASE_PATH`                   | `data/hexa.sqlite`             | SQLite file                                                            |
| `PORT`                            | `3000`                         | API port                                                               |

### Security notes & trade-offs

- The refresh cookie is httpOnly and scoped to `/auth`; mutating endpoints use
  `Bearer`/`X-Api-Key` headers (immune to CSRF) and `SameSite` adds defense in
  depth. The access token lives in memory only.
- Refresh replay detection keeps a 30-second grace window so concurrent tabs
  do not raise false positives — a documented trade-off, real reuse still
  revokes the family.
- scrypt runs async with moderate parameters; API keys use SHA-256 because
  their entropy is 256 bits.
- If you lock yourself out: the protected `admin` role, the last-admin rule
  and `npm run admin:rescue` (direct SQL, prints a fresh password once) are
  the escape hatches.

### Scripts

```bash
./scripts/auth-demo.sh          # curl walkthrough: cookie rotation + Bearer + X-Api-Key
npm run admin:rescue            # forced admin reset (SQL direct), password printed once
npm run admin:rescue ada@example.com
```

### Endpoints

Everything below requires an authenticated session **except** the public auth
routes. Authorization is per permission; the seeded admin holds all of them.

#### Auth

| Method | Path                            | Public | Success                | Failure                                                   |
| ------ | ------------------------------- | ------ | ---------------------- | --------------------------------------------------------- |
| POST   | `/auth/login`                   | ✓      | `200` session + cookie | `401` bad credentials · `403` disabled · `423` locked     |
| POST   | `/auth/refresh`                 | ✓      | `200` rotated session  | `401` missing/expired/replayed cookie                     |
| POST   | `/auth/logout`                  | ✓      | `204`                  |                                                           |
| POST   | `/auth/change-expired-password` | ✓      | `200` session + cookie | `401` bad credentials                                     |
| GET    | `/auth/me`                      |        | `200` profile          | `401` not authenticated                                   |
| POST   | `/auth/change-password`         |        | `200` session + cookie | `401` current password wrong                              |

#### Users

| Method | Path                       | Permission            | Success | Failure                                                                        |
| ------ | -------------------------- | --------------------- | ------- | ------------------------------------------------------------------------------ |
| POST   | `/users`                   | `users:create`        | `201`   | `400` invalid payload · `409` email taken                                       |
| GET    | `/users`                   | `users:read`          | `200`   |                                                                                  |
| GET    | `/users/:id`               | `users:read`          | `200`   | `404` unknown user                                                               |
| PATCH  | `/users/:id`               | `users:update`        | `200`   | `400` invalid/empty payload · `404` unknown · `409` email taken / last admin    |
| DELETE | `/users/:id`               | `users:delete`        | `204`   | `404` unknown user · `409` last admin                                            |
| POST   | `/users/:id/password`      | `users:reset-password` | `200`  | `400` policy violation · `404` unknown user · `409` reused password             |
| PUT    | `/users/:id/permissions`   | `users:permissions`   | `200`   | `400` unknown permission key · `404` unknown user                                |

`POST /users/:id/password` takes `{ "password": "…" }` or `{ "generate": true }`
(the generated value comes back **once**), unlocks the account and forces a
change at next login. `PUT /users/:id/permissions` replaces the direct grants
(`users:permissions`). Both are rules the panel uses; deleting, disabling or
demoting the last active admin is rejected with `409 LastAdminError`.

```bash
# Create
curl -s -X POST http://localhost:3000/users \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"email":"ada@example.com","name":"Ada Lovelace"}'

# Read
curl -s http://localhost:3000/users -H "Authorization: Bearer $TOKEN"
curl -s http://localhost:3000/users/<id> -H "Authorization: Bearer $TOKEN"

# Update
curl -s -X PATCH http://localhost:3000/users/<id> \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Ada King"}'

# Delete
curl -s -X DELETE http://localhost:3000/users/<id> -H "Authorization: Bearer $TOKEN"
```

#### Roles, settings, permissions and API keys

| Method | Path                    | Permission                                    | Success | Failure                                             |
| ------ | ----------------------- | --------------------------------------------- | ------- | --------------------------------------------------- |
| GET    | `/roles` · `/roles/:id` | `roles:read`                                  | `200`   | `404` unknown role                                   |
| POST   | `/roles`                | `roles:create`                                | `201`   | `400` invalid · `409` name taken/reserved            |
| PATCH  | `/roles/:id`            | `roles:update`                                | `200`   | `400` invalid · `404` unknown · `409` admin protected |
| DELETE | `/roles/:id`            | `roles:delete`                                | `204`   | `404` unknown · `409` assigned/admin protected       |
| GET    | `/permissions`          | any session                                   | `200`   |                                                      |
| GET    | `/settings`             | `settings:read`                               | `200`   |                                                      |
| PATCH  | `/settings`             | `settings:update`                             | `200`   | `400` unknown key / invalid value / empty body       |
| GET    | `/apikeys`              | `apikeys:self` (own) · `apikeys:read` (`?userId=`, `?all=true`) | `200` | `403` without permission |
| POST   | `/apikeys`              | `apikeys:self` (own) · `apikeys:manage` (others) | `201` | `400` bad scopes/expiry · `404` owner · `409` key limit |
| POST   | `/apikeys/:id/rotate`   | owner · `apikeys:manage`                      | `200`   | `404` unknown · `409` revoked                        |
| DELETE | `/apikeys/:id`          | owner · `apikeys:manage`                      | `204`   | `404` unknown · `409` already revoked                |

#### Patients

The RUT is the **business key**: it is validated with the módulo 11 check digit,
normalized to its canonical form (`12345678-5`, no dots, uppercase `K`) and unique in
the database. The technical id stays a UUID.

| Method | Path                  | Success | Failure                                                        |
| ------ | --------------------- | ------- | -------------------------------------------------------------- |
| POST   | `/patients`           | `201`   | `400` invalid payload · `409` RUT taken                        |
| GET    | `/patients`           | `200`   |                                                                |
| GET    | `/patients/:id`       | `200`   | `404` unknown patient                                          |
| GET    | `/patients/rut/:rut`  | `200`   | `400` malformed RUT · `404` RUT not registered                 |
| PATCH  | `/patients/:id`       | `200`   | `400` invalid/empty payload · `404` unknown · `409` RUT taken  |
| DELETE | `/patients/:id`       | `204`   | `404` unknown patient                                          |

```bash
# Create (any spelling of the RUT is normalized: dots, no hyphen, lowercase k)
curl -s -X POST http://localhost:3000/patients \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "rut": "12.345.678-5",
    "nombres": "Camila",
    "apellidoPaterno": "Rojas",
    "apellidoMaterno": "Pérez",
    "fechaNacimiento": "1990-05-17",
    "sexo": "femenino",
    "telefono": "+56 9 1234 5678",
    "direccion": { "region": "RM", "comuna": "Providencia", "calle": "Av. Providencia", "numero": "1234" },
    "prevision": { "tipo": "FONASA", "tramo": "B" },
    "contactoEmergencia": { "nombre": "María Pérez", "telefono": "+56 9 8765 4321", "parentesco": "Madre" }
  }'

# Read (by UUID or by RUT)
curl -s http://localhost:3000/patients -H "Authorization: Bearer $TOKEN"
curl -s http://localhost:3000/patients/rut/12.345.678-5 -H "Authorization: Bearer $TOKEN"

# Update: omitted fields are untouched, `null` clears an optional group
curl -s -X PATCH http://localhost:3000/patients/<id> \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"prevision": {"tipo": "ISAPRE", "plan": "Colmena"}}'

# Delete
curl -s -X DELETE http://localhost:3000/patients/<id> -H "Authorization: Bearer $TOKEN"
```

A full curl walkthrough (happy paths + 400/404/409 cases + a direct SQLite check)
lives in `scripts/crud-demo.sh` — run it against a live server:

```bash
./scripts/crud-demo.sh
```

All demo scripts sign in as the bootstrap administrator first (override with
`ADMIN_EMAIL` / `ADMIN_PASSWORD`).

To seed demo data (default 100 records, idempotent — existing emails/RUTs are skipped):

```bash
npm run seed                  # 100 users on http://localhost:3000
npm run seed -- 25            # custom count
npm run seed:patients         # 100 Chilean patients (deterministic valid RUTs)
npm run seed:patients -- 50   # custom count
```

#### Dental clinical record (ficha dental, HCU-form.033)

The record is opened per patient (`POST /patients/:id/clinical-record`, one per
patient) and everything else hangs from the record id. The odontogram is an
**append-only log**: findings are never edited in place, mistakes are voided
with actor + timestamp, and the current chart is a projection of the latest
non-voided action per tooth, surfaces and symbol. The derived indices never
store state either — they are recomputed from the findings on every read.

| Method | Path                                              | Success | Failure                                                                    |
| ------ | ------------------------------------------------- | ------- | -------------------------------------------------------------------------- |
| POST   | `/patients/:patientId/clinical-record`            | `201`   | `400` invalid payload · `404` unknown patient · `409` record already open  |
| GET    | `/patients/:patientId/clinical-record`            | `200`   | `404` unknown patient or no record yet                                     |
| GET    | `/clinical-records/:id`                           | `200`   | `404` unknown record                                                       |
| PATCH  | `/clinical-records/:id`                           | `200`   | `400` invalid/empty payload · `404` unknown · `423` finalized              |
| GET    | `/clinical-records/:id/findings`                  | `200`   | `404` unknown record                                                       |
| POST   | `/clinical-records/:id/findings`                  | `201`   | `400` invalid finding · `404` unknown · `423` finalized                    |
| POST   | `/clinical-records/:id/findings/:findingId/void`  | `201`   | `404` unknown · `409` already voided · `423` finalized                     |
| GET    | `/clinical-records/:id/indices`                   | `200`   | `404` unknown record                                                       |
| GET    | `/clinical-records/:id/events`                    | `200`   | `404` unknown record                                                       |

```bash
# Open the ficha of a patient (categoria is optional — suggested from the age)
curl -s -X POST http://localhost:3000/patients/<id>/clinical-record \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"categoria": "mayor-20"}'

# Record a caries on the occlusal surface of tooth 36 (red, pending)
curl -s -X POST http://localhost:3000/clinical-records/<recordId>/findings \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"tooth": 36, "surfaces": ["O"], "symbol": "caries", "recesion": 1}'

# Derived CPO/ceo + hygiene totals (never stored)
curl -s http://localhost:3000/clinical-records/<recordId>/indices \
  -H "Authorization: Bearer $TOKEN"
```

## Database

- **Driver:** `node:sqlite` (built into Node — nothing to install). The single
  connection lives in `SqliteDatabase` (`src/shared/infrastructure/database`) and is
  provided to adapters by `DatabaseModule`.
- **Location:** `DATABASE_PATH` env var, default `data/hexa.sqlite` (git-ignored).
  The directory is created on first boot; WAL mode is enabled.
- **Schema:** `SqliteDatabase.ensureSchema` creates all tables with
  `CREATE TABLE IF NOT EXISTS` — `users`, `roles`, `user_roles`, `user_permissions`,
  `refresh_tokens`, `password_history`, `api_keys`, `patients`,
  `clinical_records`, `clinical_findings`, `clinical_events`, `uco_procedures`,
  `quotes`, `quote_items`, `quote_versions`, `quote_counters`, `settings` and
  `bootstrap_state` — replace with real migrations when the schema grows.
- **Error translation:** SQLite's `UNIQUE constraint failed` (errcode `2067`) is
  translated into the matching domain error *in the adapter*
  (`UserAlreadyExistsError`, `PatientAlreadyExistsError`), so the use case and the
  domain only speak domain errors.
- **Inspect it:**
  ```bash
  sqlite3 data/hexa.sqlite 'SELECT id, email, name FROM users;'
  sqlite3 data/hexa.sqlite 'SELECT rut, nombres, apellido_paterno FROM patients;'
  sqlite3 data/hexa.sqlite 'SELECT name FROM roles;'
  ```

## Frontend — Angular 22 microfrontends

The `frontend/` folder contains an Angular 22 workspace with a **shell** (host)
and four **remotes** composed at runtime with **Native Federation** — each app
is built and served independently:

| App         | Port | Role   | Contents                                                                          |
| ----------- | ---- | ------ | --------------------------------------------------------------------------------- |
| `shell`     | 4200 | host   | Layout, login, navigation, language switcher, account (own API keys)              |
| `patients`  | 4203 | remote | Patient CRUD (list + search, RUT form) + **ficha clínica**: record form, odontogram and indices tabs |
| `users`     | 4201 | remote | Account management: roles, status, direct permissions, password resets            |
| `dashboard` | 4202 | remote | Live summary: total patients + the 5 most recent                                  |
| `admin`     | 4204 | remote | Admin panel: role editor with the permission matrix, dynamic settings, API keys   |
| `quotes`    | 4205 | remote | Quotations: list, editor with live totals, per-item acceptance, sanction and A4 print |

Shared code lives in three libraries:

- **`projects/ui`** — spartan/ui (the Angular shadcn/ui port) components generated
  with the spartan CLI and imported through path aliases (`@ui/button`, `@ui/dialog`,
  `@ui/table`, …), plus the Tailwind v4 theme and the i18n dictionaries.
- **`projects/data-access`** — typed HTTP clients (`UsersApi`, `PatientsApi`,
  `ClinicalApi`, `AuthApi`, `RolesApi`, `SettingsApi`, `PermissionsApi`,
  `ApiKeysApi`, `UcoApi`, `QuotesApi`), the domain models shared by the remotes — including the ficha
  clínica constants and chart projection (`clinical.model.ts`) — the RUT/phone
  helpers that mirror the backend value objects (módulo 11 validation, canonical
  formatting) and `mapApiError`, which translates backend error names
  (`PatientAlreadyExistsError`, `ClinicalRecordLockedError`, …) into i18n keys.
- **`projects/auth`** — session store (signals), JWT interceptor with single-flight
  refresh-and-retry, route/permission guards and the permission matrix shared by
  the admin views.

**i18n:** Transloco with Spanish (default) and English, switchable from the shell
header. Dictionaries are compiled into the bundles (no cross-origin fetches between
ports) and Transloco is shared as a federation singleton, so switching the language
in the shell re-renders the remotes too. The selection is persisted in
`localStorage` (`hexa.lang`).

### Running everything

One command (backend + microfrontends):

```bash
./scripts/dev-all.sh           # builds the backend and starts :3000, :4200–:4205
./scripts/dev-all.sh --skip-build
```

Or in separate terminals:

```bash
npm run start:dev              # backend on :3000
cd frontend
npm install                    # first time only
npm run start:all              # shell + patients + users + dashboard + admin (concurrently)
```

Open <http://localhost:4200> — the shell lazily loads each remote from its own dev
server through `loadRemoteModule` (see `projects/shell/src/app/app.routes.ts`). Each
remote also runs standalone (`npm run start:patients` → :4203,
`npm run start:users` → :4201, `npm run start:admin` → :4204) thanks to its own
`app.config.ts` + `bootstrap.ts`.

More scripts (inside `frontend/`):

```bash
npm run build:all              # production builds of shell + remotes
npm run test:all               # vitest (libs + apps)
```

### Adding another remote

```bash
cd frontend
npm i -D @angular-architects/native-federation   # already installed
ng g @angular-architects/native-federation:init --project <name> --port <port>
```

Then: expose `./routes` in the new `federation.config.mjs`, register the remote URL
in `projects/shell/src/main.ts` and add the lazy route in `app.routes.ts`.

## Quotations (cotizaciones) and the UCO fee catalog

The `quotes` module prices dental work over the **Arancel UCO**: a catalog of
procedures measured in UCO units (`/uco`, seeded with a reference list and
editable from `/admin/uco`) and **quotations** (`/quotes`) that snapshot the
patient, compute totals server-side (`cantidad × valor − % línea`, no taxes),
track the acceptance state **per line** (`generado` / `aprobado` / `rechazado`)
and record a **sanction** (approve/reject, `quotes:approve`) that locks the
document. Editing a sanctioned quote requires duplicating it into a new version
(fresh folio + `replacesQuoteId`), and every save appends to the version trail.
The A4 document (`/quotes/:id/print`) prints with the clinic identity from the
settings.

## Roadmap

The ficha clínica already covers sections 1–9 of the HCU form (record,
odontogram and indices). What follows:

1. **Plan de tratamiento y timeline dental** — every chart action already
   records a clinical event (`GET /clinical-records/:id/events`); the next step
   is the treatment-plan entries and the paginated timeline viewer (double-click
   a tooth to see its history).
2. **Radiografías** — imaging attached to the record (X-ray upload + viewer).
3. **Cierre de la ficha** — digital signature with the locking UI (the
   `finalizada` status is already enforced by the API with `423`) and an
   auto-generated PDF of the HCU form.

## Swapping the persistence adapter

`UserRepositoryPort` is the seam. To move to Postgres/MongoDB/anything, add an adapter
that extends the port and rebind it in the composition root — no other file changes:

```ts
// src/modules/users/infrastructure/adapters/persistence/typeorm-user.repository.ts
@Injectable()
export class TypeOrmUserRepository extends UserRepositoryPort {
  constructor(private readonly repository: Repository<UserModel>) {
    super();
  }

  async save(user: User): Promise<void> {
    await this.repository.save(UserPersistenceMapper.toModel(user));
  }

  // update, delete, findById, findByEmail, findAll ...
}
```

```ts
// src/modules/users/users.module.ts
{ provide: UserRepositoryPort, useClass: TypeOrmUserRepository },
```

Guidelines when writing adapters:

- Translate domain objects ⇄ persistence models in a mapper inside the adapter
  (`reconstitute` / getters are the domain-side entry points).
- Translate driver errors into domain errors (e.g. unique violation →
  `UserAlreadyExistsError`) so inner layers stay storage-agnostic.
- Keep ORM and driver imports inside `infrastructure/`.
- `InMemoryUserRepository` stays around as a fast test double for use case unit tests.

## Adding a new use case

1. (If needed) extend the port and its adapters with the persistence operations.
2. Create `application/use-cases/<name>.use-case.ts` with a command/query interface
   and an `@Injectable()` class implementing `UseCase<Input, Output>`.
3. Register the class in the feature module's `providers`.
4. Expose it from a controller (driving adapter), mapping DTOs ⇄ commands — and
   protect it with `@RequirePermissions` when it should not be open to every
   authenticated user.
5. Unit test it without Nest: `new TheUseCase(realAdapterOrFake)`.

## Testing strategy

- **Domain & use cases** (`src/**/*.spec.ts`) — plain classes, no Nest container, no
  HTTP, no database. Fast and deterministic; the in-memory adapter doubles as a test
  double.
- **Adapter integration** (`sqlite-user.repository.spec.ts`,
  `sqlite-patient.repository.spec.ts`) — runs the real SQLite adapters against a
  `:memory:` database, including error translation.
- **REST e2e** (`test/**/*.e2e-spec.ts` — auth, users, patients, identity,
  API keys and the clinical record) — boots the real `AppModule` through
  `configureApp` and swaps the `SqliteDatabase` provider for a fresh `:memory:`
  instance per test (`overrideProvider`), so pipes, filters, routing, guards and
  SQL are all exercised over HTTP without touching the file database. The auth
  spec covers login → refresh rotation → replay rejection, lockout, password
  policy and `must_change_password`; the API keys spec covers the `X-Api-Key`
  lifecycle (create → use → rotate → revoke), scope intersection and cross-user
  rules; the clinical spec covers the record lifecycle, the append-only
  odontogram with void + lock (`423`) and the derived indices.

## Conventions & decisions

- **Ports are abstract classes.** They double as DI tokens (`provide: UserRepositoryPort`),
  so no string/symbol token registries are needed.
- **Domain errors carry a `kind`** (`validation`, `not_found`, `conflict`, `unexpected`);
  `DomainExceptionFilter` maps kinds to HTTP statuses. The domain never knows about HTTP.
- **Validation happens twice, on purpose:** DTOs (class-validator) guard the transport,
  entities/value objects guard the business rules — even if a use case is called from a
  queue consumer instead of HTTP.
- **DTOs never cross layer boundaries.** They exist only in `infrastructure/http`;
  use cases take simple command/query objects and return domain objects.
- **Permissions are declared per endpoint** with `@RequirePermissions('<key>')` (allOf)
  or `@RequireAnyPermissions(...)` (anyOf) from the code catalog; the global guards
  resolve them per request from roles ∪ direct grants, and routes that must stay open
  are marked `@Public()`. See the 3-step workflow in
  [Permission catalog](#permission-catalog).
- **ESM:** relative imports include the `.js` extension (`nodenext` resolution).
- **One module per bounded context** under `src/modules/<context>`, each with its own
  `domain` / `application` / `infrastructure` folders and composition root.
