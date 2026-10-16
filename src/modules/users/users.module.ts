import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../shared/infrastructure/database/database.module.js';
import { UserRepositoryPort } from './application/ports/user-repository.port.js';
import { CreateUserUseCase } from './application/use-cases/create-user.use-case.js';
import { DeleteUserUseCase } from './application/use-cases/delete-user.use-case.js';
import { GetUserUseCase } from './application/use-cases/get-user.use-case.js';
import { ListUsersUseCase } from './application/use-cases/list-users.use-case.js';
import { UpdateUserUseCase } from './application/use-cases/update-user.use-case.js';
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
    // Swap this binding for another database adapter (Postgres, MongoDB, ...).
    { provide: UserRepositoryPort, useClass: SqliteUserRepository },
  ],
})
export class UsersModule {}
