import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../shared/infrastructure/database/database.module.js';
import { PermissionResolver } from '../../shared/security/permission-resolver.js';
import { UserAccessReaderPort } from '../../shared/security/user-access.reader.port.js';
import { PasswordHistoryPort } from './application/ports/password-history.port.js';
import { UserRepositoryPort } from './application/ports/user-repository.port.js';
import { CreateUserUseCase } from './application/use-cases/create-user.use-case.js';
import { DeleteUserUseCase } from './application/use-cases/delete-user.use-case.js';
import { GetUserUseCase } from './application/use-cases/get-user.use-case.js';
import { ListUsersUseCase } from './application/use-cases/list-users.use-case.js';
import { UpdateUserUseCase } from './application/use-cases/update-user.use-case.js';
import { SqlitePasswordHistoryRepository } from './infrastructure/adapters/persistence/sqlite-password-history.repository.js';
import { SqliteUserAccessReader } from './infrastructure/adapters/persistence/sqlite-user-access.reader.js';
import { SqliteUserRepository } from './infrastructure/adapters/persistence/sqlite-user.repository.js';
import { UsersController } from './infrastructure/http/users.controller.js';

/**
 * Composition root for the users context: picks concrete adapters for the
 * ports and registers use cases. This is the only place that knows which
 * implementations are wired together. It also owns permission resolution:
 * roles and direct permissions are part of the user aggregate's data.
 */
@Module({
  imports: [DatabaseModule],
  controllers: [UsersController],
  providers: [
    CreateUserUseCase,
    GetUserUseCase,
    ListUsersUseCase,
    UpdateUserUseCase,
    DeleteUserUseCase,
    PermissionResolver,
    // Swap these bindings for other database adapters (Postgres, MongoDB, ...).
    { provide: UserRepositoryPort, useClass: SqliteUserRepository },
    { provide: PasswordHistoryPort, useClass: SqlitePasswordHistoryRepository },
    { provide: UserAccessReaderPort, useClass: SqliteUserAccessReader },
  ],
  exports: [UserRepositoryPort, PasswordHistoryPort, UserAccessReaderPort, PermissionResolver],
})
export class UsersModule {}
