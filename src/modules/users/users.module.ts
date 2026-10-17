import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../shared/infrastructure/database/database.module.js';
import { PermissionResolver } from '../../shared/security/permission-resolver.js';
import { SecurityModule } from '../../shared/security/security.module.js';
import { UserAccessReaderPort } from '../../shared/security/user-access.reader.port.js';
import { RolesModule } from '../roles/roles.module.js';
import { SettingsModule } from '../settings/settings.module.js';
import { PasswordHistoryPort } from './application/ports/password-history.port.js';
import { UserRepositoryPort } from './application/ports/user-repository.port.js';
import { CreateUserUseCase } from './application/use-cases/create-user.use-case.js';
import { DeleteUserUseCase } from './application/use-cases/delete-user.use-case.js';
import { GetUserUseCase } from './application/use-cases/get-user.use-case.js';
import { ListUsersUseCase } from './application/use-cases/list-users.use-case.js';
import { SetUserPasswordUseCase } from './application/use-cases/set-user-password.use-case.js';
import { UpdateUserPermissionsUseCase } from './application/use-cases/update-user-permissions.use-case.js';
import { UpdateUserUseCase } from './application/use-cases/update-user.use-case.js';
import { PostgresPasswordHistoryRepository } from './infrastructure/adapters/persistence/postgres-password-history.repository.js';
import { PostgresUserAccessReader } from './infrastructure/adapters/persistence/postgres-user-access.reader.js';
import { PostgresUserRepository } from './infrastructure/adapters/persistence/postgres-user.repository.js';
import { UsersController } from './infrastructure/http/users.controller.js';

/**
 * Composition root for the users context: picks concrete adapters for the
 * ports and registers use cases. This is the only place that knows which
 * implementations are wired together. It also owns permission resolution:
 * roles and direct permissions are part of the user aggregate's data.
 */
@Module({
  imports: [DatabaseModule, SecurityModule, RolesModule, SettingsModule],
  controllers: [UsersController],
  providers: [
    CreateUserUseCase,
    GetUserUseCase,
    ListUsersUseCase,
    UpdateUserUseCase,
    DeleteUserUseCase,
    SetUserPasswordUseCase,
    UpdateUserPermissionsUseCase,
    PermissionResolver,
    // Swap these bindings for other database adapters (Postgres, MongoDB, ...).
    { provide: UserRepositoryPort, useClass: PostgresUserRepository },
    { provide: PasswordHistoryPort, useClass: PostgresPasswordHistoryRepository },
    { provide: UserAccessReaderPort, useClass: PostgresUserAccessReader },
  ],
  exports: [UserRepositoryPort, PasswordHistoryPort, UserAccessReaderPort, PermissionResolver],
})
export class UsersModule {}
