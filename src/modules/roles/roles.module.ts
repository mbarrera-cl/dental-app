import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../shared/infrastructure/database/database.module.js';
import { RoleRepositoryPort } from './application/ports/role-repository.port.js';
import { CreateRoleUseCase } from './application/use-cases/create-role.use-case.js';
import { DeleteRoleUseCase } from './application/use-cases/delete-role.use-case.js';
import { GetRoleUseCase } from './application/use-cases/get-role.use-case.js';
import { ListRolesUseCase } from './application/use-cases/list-roles.use-case.js';
import { UpdateRoleUseCase } from './application/use-cases/update-role.use-case.js';
import { SqliteRoleRepository } from './infrastructure/adapters/persistence/sqlite-role.repository.js';
import { PermissionsController } from './infrastructure/http/permissions.controller.js';
import { RolesController } from './infrastructure/http/roles.controller.js';

/**
 * Composition root for the roles context. The repository binding is exported
 * so the bootstrapper (and, later, other contexts) can read roles.
 */
@Module({
  imports: [DatabaseModule],
  controllers: [RolesController, PermissionsController],
  providers: [
    CreateRoleUseCase,
    GetRoleUseCase,
    ListRolesUseCase,
    UpdateRoleUseCase,
    DeleteRoleUseCase,
    { provide: RoleRepositoryPort, useClass: SqliteRoleRepository },
  ],
  exports: [RoleRepositoryPort],
})
export class RolesModule {}
