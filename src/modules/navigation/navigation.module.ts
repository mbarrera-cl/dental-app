import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../shared/infrastructure/database/database.module.js';
import { MenuRepositoryPort } from './application/ports/menu-repository.port.js';
import { CreateMenuItemUseCase } from './application/use-cases/create-menu-item.use-case.js';
import { DeleteMenuItemUseCase } from './application/use-cases/delete-menu-item.use-case.js';
import { GetMyNavigationUseCase } from './application/use-cases/get-my-navigation.use-case.js';
import { ListMenuItemsUseCase } from './application/use-cases/list-menu-items.use-case.js';
import { ReorderMenuItemsUseCase } from './application/use-cases/reorder-menu-items.use-case.js';
import { ResetMenuUseCase } from './application/use-cases/reset-menu.use-case.js';
import { UpdateMenuItemUseCase } from './application/use-cases/update-menu-item.use-case.js';
import { PostgresMenuRepository } from './infrastructure/adapters/persistence/postgres-menu.repository.js';
import { NavigationBootstrapService } from './infrastructure/bootstrap/navigation-bootstrap.service.js';
import { NavigationController } from './infrastructure/http/navigation.controller.js';

/**
 * Composition root for the navigation context: the configurable side menu
 * (stored in SQLite) and the per-principal filtered tree the shell renders.
 */
@Module({
  imports: [DatabaseModule],
  controllers: [NavigationController],
  providers: [
    GetMyNavigationUseCase,
    ListMenuItemsUseCase,
    CreateMenuItemUseCase,
    UpdateMenuItemUseCase,
    DeleteMenuItemUseCase,
    ReorderMenuItemsUseCase,
    ResetMenuUseCase,
    NavigationBootstrapService,
    { provide: MenuRepositoryPort, useClass: PostgresMenuRepository },
  ],
})
export class NavigationModule {}
