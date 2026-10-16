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
  plus lookup by RUT.
- **Authentication & RBAC** — JWT access tokens plus a rotating refresh token in
  an httpOnly cookie, configurable roles and per-user permissions, and a
  runtime-configurable password policy with history.
- **Staff accounts** — users CRUD guarded by permissions; the built-in `admin`
  role is re-synced with the permission catalog on every boot.
- **Dashboard** — live summary: total patients and the most recent ones.
- **Settings** — typed, runtime-configurable settings.

Coming next: the **interactive odontogram** (FDI dental chart — 5 surfaces + root
per tooth, pending/completed findings) mounted inside the patient record, fed by
a unified clinical timeline and an auto-generated treatment plan. See
[Roadmap](#roadmap).

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
(`http://localhost:4200`, `:4201`, `:4202`, `:4203`) by default. Override the
allow-list with a comma-separated env var:
`CORS_ORIGIN=https://app.example.com,https://admin.example.com`.

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

| Method | Path         | Success | Failure                                                                |
| ------ | ------------ | ------- | ---------------------------------------------------------------------- |
| POST   | `/users`     | `201`   | `400` invalid payload · `409` email taken                              |
| GET    | `/users`     | `200`   |                                                                        |
| GET    | `/users/:id` | `200`   | `404` unknown user                                                     |
| PATCH  | `/users/:id` | `200`   | `400` invalid/empty payload · `404` unknown user · `409` email taken   |
| DELETE | `/users/:id` | `204`   | `404` unknown user                                                     |

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

> ⚠️ `scripts/crud-demo.sh` and the seed scripts below predate the authentication
> milestone: they call the API anonymously and will receive `401` until they are
> updated to sign in first.

To seed demo data (default 100 records, idempotent — existing emails/RUTs are skipped):

```bash
npm run seed                  # 100 users on http://localhost:3000
npm run seed -- 25            # custom count
npm run seed:patients         # 100 Chilean patients (deterministic valid RUTs)
npm run seed:patients -- 50   # custom count
```

## Database

- **Driver:** `node:sqlite` (built into Node — nothing to install). The single
  connection lives in `SqliteDatabase` (`src/shared/infrastructure/database`) and is
  provided to adapters by `DatabaseModule`.
- **Location:** `DATABASE_PATH` env var, default `data/hexa.sqlite` (git-ignored).
  The directory is created on first boot; WAL mode is enabled.
- **Schema:** `SqliteDatabase.ensureSchema` creates all tables with
  `CREATE TABLE IF NOT EXISTS` — `users`, `roles`, `user_roles`, `user_permissions`,
  `refresh_tokens`, `password_history`, `api_keys`, `patients`, `settings` and
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

The `frontend/` folder contains an Angular 22 workspace with a **shell** (host) and
three **remotes** composed at runtime with **Native Federation** — each app is built
and served independently:

| App         | Port | Role   | Contents                                                         |
| ----------- | ---- | ------ | ---------------------------------------------------------------- |
| `shell`     | 4200 | host   | Layout, navigation, language switcher, shared toaster             |
| `patients`  | 4203 | remote | Full patient CRUD: list + search, create, edit, delete + RUT form |
| `users`     | 4201 | remote | Full users CRUD: list + search, create, edit, delete              |
| `dashboard` | 4202 | remote | Live summary: total patients + the 5 most recent                  |

Shared code lives in three libraries:

- **`projects/ui`** — spartan/ui (the Angular shadcn/ui port) components generated
  with the spartan CLI and imported through path aliases (`@ui/button`, `@ui/dialog`,
  `@ui/table`, …), plus the Tailwind v4 theme and the i18n dictionaries.
- **`projects/data-access`** — typed `UsersApi` / `PatientsApi` / `AuthApi`
  (HttpClient) over the REST API, the RUT/phone helpers that mirror the backend
  value objects (módulo 11 validation, canonical formatting) and `mapApiError`,
  which translates backend error names (`PatientAlreadyExistsError`, …) into i18n
  keys.
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
./scripts/dev-all.sh           # builds the backend and starts :3000, :4200, :4201, :4202, :4203
./scripts/dev-all.sh --skip-build
```

Or in separate terminals:

```bash
npm run start:dev              # backend on :3000
cd frontend
npm install                    # first time only
npm run start:all              # shell + patients + users + dashboard (concurrently)
```

Open <http://localhost:4200> — the shell lazily loads each remote from its own dev
server through `loadRemoteModule` (see `projects/shell/src/app/app.routes.ts`). Each
remote also runs standalone (`npm run start:patients` → :4203,
`npm run start:users` → :4201) thanks to its own `app.config.ts` + `bootstrap.ts`.

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

## Roadmap

The next milestone turns the patient record into the clinical workspace:

1. **Ficha del paciente + historial clínico** — route `/patients/:id` with tabs
   (Datos / Historial / Odontograma / Plan) and a unified, paginated clinical event
   feed (record changes today; chart actions later).
2. **Odontograma interactivo** — the FDI chart: adult (32) and primary (20)
   dentition, a per-tooth SVG with 5 surfaces + root, red = pending / blue =
   completed findings, and the classic symbols (absent ✕, endodontics sigmoid,
   crown/post circle). Designed to be instantiated only inside the patient record.
3. **Plan de tratamiento y timeline dental** — every chart action generates a
   treatment-plan entry and a clinical event; double-clicking a tooth shows its
   history.

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
- **REST e2e** (`test/**/*.e2e-spec.ts` — users, patients, auth and identity flows) —
  boots the real `AppModule` through `configureApp` and swaps the `SqliteDatabase`
  provider for a fresh `:memory:` instance per test (`overrideProvider`), so pipes,
  filters, routing, guards and SQL are all exercised over HTTP without touching the
  file database.

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
- **Permissions are declared per endpoint** with `@RequirePermissions('<key>')` from the
  code catalog; the global guards resolve them per request from roles ∪ direct grants,
  and routes that must stay open are marked `@Public()`. Adding a permission is a
  one-line catalog change plus the decorator.
- **ESM:** relative imports include the `.js` extension (`nodenext` resolution).
- **One module per bounded context** under `src/modules/<context>`, each with its own
  `domain` / `application` / `infrastructure` folders and composition root.
