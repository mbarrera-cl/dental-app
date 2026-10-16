# Hexagonal NestJS API — Boilerplate

A production-minded starter for NestJS 12 APIs built with **hexagonal architecture**
(ports & adapters): the business logic lives in the center, completely independent of
NestJS, HTTP and databases, and everything else is a swappable adapter around it.

## Stack

| Concern            | Choice                                              |
| ------------------ | --------------------------------------------------- |
| Framework          | NestJS 12 (Express)                                 |
| Language           | TypeScript 6, strict, native ESM (`nodenext`)       |
| Validation         | `class-validator` / `class-transformer` at the edge |
| API docs           | Swagger / OpenAPI at `/docs`                        |
| Testing            | Vitest (unit + e2e with supertest)                  |
| Linting/formatting | oxlint (type-aware) + Prettier                      |

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
  - *driven* adapters implement ports (`InMemoryUserRepository` implements the
    repository port).
  - This is the only layer aware of NestJS specifics like modules, pipes, filters —
    and the only layer that gets deleted/replaced when technology changes.

## Directory layout

```
src/
├── main.ts                          # HTTP bootstrap (delegates to configureApp)
├── app.module.ts                    # Root module — imports feature modules
├── shared/                          # Cross-cutting building blocks
│   ├── domain/                      # Entity, ValueObject, DomainError base classes
│   ├── application/                 # UseCase contract
│   └── infrastructure/              # configureApp + DomainExceptionFilter
└── modules/
    └── users/                       # One folder per bounded context
        ├── domain/                  # User entity, Email value object, domain errors
        ├── application/
        │   ├── ports/               # UserRepositoryPort (driven port)
        │   └── use-cases/           # CreateUser, GetUser, ListUsers
        └── infrastructure/
            ├── adapters/            # InMemoryUserRepository (driven adapter)
            └── http/                # UsersController + request/response DTOs
```

## Request flow: `POST /users`

1. `UsersController.create` receives the request; `CreateUserRequestDto` is validated
   by the global `ValidationPipe` (rejects unknown fields, wrong types, bad emails).
2. The controller maps the DTO to a `CreateUserCommand` and calls
   `CreateUserUseCase.execute`.
3. The use case builds the `User` aggregate — the `Email` value object validates and
   normalizes the address — then checks `UserRepositoryPort.findByEmail`.
4. `UserAlreadyExistsError` (a `DomainError` with `kind: 'conflict'`) would be thrown
   here; the `DomainExceptionFilter` at the edge turns it into `409 Conflict`.
5. The bound adapter (`InMemoryUserRepository`) persists the user.
6. The controller maps the `User` to `UserResponseDto` and returns `201`.

## Getting started

Requires **Node.js 22+** (uses native ESM).

```bash
npm install
npm run start:dev
```

- API: <http://localhost:3000>
- Swagger UI: <http://localhost:3000/docs>

### Endpoints

| Method | Path         | Success | Failure                                     |
| ------ | ------------ | ------- | ------------------------------------------- |
| POST   | `/users`     | `201`   | `400` invalid payload · `409` email taken   |
| GET    | `/users`     | `200`   |                                             |
| GET    | `/users/:id` | `200`   | `404` unknown user                          |

```bash
curl -s -X POST http://localhost:3000/users \
  -H 'Content-Type: application/json' \
  -d '{"email":"ada@example.com","name":"Ada Lovelace"}'
```

## Scripts

| Script                | Purpose                                |
| --------------------- | -------------------------------------- |
| `npm run start:dev`   | Watch mode (dev server)                |
| `npm run build`       | Compile to `dist/`                     |
| `npm run start:prod`  | Run the compiled build                 |
| `npm test`            | Unit tests (domain + use cases)        |
| `npm run test:e2e`    | End-to-end tests (HTTP, supertest)     |
| `npm run test:cov`    | Unit tests with coverage               |
| `npm run lint`        | oxlint (type-aware)                    |
| `npm run format`      | Prettier                               |

## Swapping the in-memory repository for a real database

The in-memory adapter is deliberate: the app runs and tests without any infrastructure.
To move to a real database, add an adapter that extends the port and rebind it in the
composition root — no other file changes:

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

  // findByEmail, findById, findAll ...
}
```

```ts
// src/modules/users/users.module.ts
{ provide: UserRepositoryPort, useClass: TypeOrmUserRepository },
```

A few guidelines when writing real adapters:

- Translate domain objects ⇄ persistence models in a mapper inside the adapter
  (`reconstitute` / getters are the domain-side entry points).
- Enforce uniqueness with a database constraint and translate the driver error into
  `UserAlreadyExistsError` instead of relying on check-then-save.
- Keep `@nestjs/*`, ORM and driver imports inside `infrastructure/`.

## Adding a new use case

1. (If needed) extend the port and its adapters with the persistence operations.
2. Create `application/use-cases/<name>.use-case.ts` with a command/query interface
   and an `@Injectable()` class implementing `UseCase<Input, Output>`.
3. Register the class in the feature module's `providers`.
4. Expose it from a controller (driving adapter), mapping DTOs ⇄ commands.
5. Unit test it without Nest: `new TheUseCase(fakeRepository)`.

## Testing strategy

- **Domain & use cases** (`src/**/*.spec.ts`) — plain classes, no Nest container,
  no HTTP. Fast and deterministic. The in-memory adapter doubles as a test double.
- **e2e** (`test/**/*.e2e-spec.ts`) — boots the real `AppModule` through
  `configureApp`, so pipes, filters and module wiring are exercised over HTTP.
  Swap a provider with `.overrideProvider(...)` when a test needs a different adapter.

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
- **ESM:** relative imports include the `.js` extension (`nodenext` resolution).
- **One module per bounded context** under `src/modules/<context>`, each with its own
  `domain` / `application` / `infrastructure` folders and composition root.
