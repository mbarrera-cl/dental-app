import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { buildMenuTree, type MenuTreeNode } from '../../domain/menu-tree.js';
import { MenuRepositoryPort } from '../ports/menu-repository.port.js';

/** Full menu tree (including disabled entries), for the configuration editor. */
@Injectable()
export class ListMenuItemsUseCase implements UseCase<void, MenuTreeNode[]> {
  constructor(private readonly menu: MenuRepositoryPort) {}

  async execute(): Promise<MenuTreeNode[]> {
    return buildMenuTree(await this.menu.findAll());
  }
}
