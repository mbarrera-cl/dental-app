import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../shared/infrastructure/database/database.module.js';
import { PasswordHistoryPort } from './application/ports/password-history.port.js';
import { UserRepositoryPort } from './application/ports/user-repository.port.js';
import { CreateUserUseCase } from './application/use-cases/create-user.use-case.js';
import { DeleteUserUseCase } from './application/use-cases/delete-user.use-case.js';
import { GetUserUseCase } from './application/use-cases/get-user.use-case.js';
import { ListUsersUseCase } from './application/use-cases/list-users.use-case.js';
import { UpdateUserUseCase } from './application/use-cases/update-user.use-case.js';
import { SqlitePasswordHistoryRepository } from './infrastructure/adapters/persistence/sqlite-password-history.repository.js';
import { SqliteUserRepository } from './infrastructure/adapters/persistence/sqlite-user.repository.js';
import { UsersController } from './infrastructure/http/users.controller.js';

/**
 * Composition root for the users context: picks concrete adapters for the
 * ports and registers use cases. This is the only place that knows which
 * implementations are wired together.
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
    // Swap these bindings for other database adapters (Postgres, MongoDB, ...).
    { provide: UserRepositoryPort, useClass: SqliteUserRepository },
    { provide: PasswordHistoryPort, useClass: SqlitePasswordHistoryRepository },
  ],
  exports: [UserRepositoryPort, PasswordHistoryPort],
})
export class UsersModule {}
