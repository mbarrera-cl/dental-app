import { Module } from '@nestjs/common';
import { UserRepositoryPort } from './application/ports/user-repository.port.js';
import { CreateUserUseCase } from './application/use-cases/create-user.use-case.js';
import { GetUserUseCase } from './application/use-cases/get-user.use-case.js';
import { ListUsersUseCase } from './application/use-cases/list-users.use-case.js';
import { InMemoryUserRepository } from './infrastructure/adapters/persistence/in-memory-user.repository.js';
import { UsersController } from './infrastructure/http/users.controller.js';

/**
 * Composition root for the users context: picks concrete adapters for the
 * ports and registers use cases. This is the only place that knows which
 * implementations are wired together.
 */
@Module({
  controllers: [UsersController],
  providers: [
    CreateUserUseCase,
    GetUserUseCase,
    ListUsersUseCase,
    // Swap this binding for a database-backed adapter (TypeORM, Prisma, ...).
    { provide: UserRepositoryPort, useClass: InMemoryUserRepository },
  ],
})
export class UsersModule {}
