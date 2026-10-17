import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { buildDefaultMenuItems } from '../../domain/default-menu.js';
import { buildMenuTree, type MenuTreeNode } from '../../domain/menu-tree.js';
import { MenuRepositoryPort } from '../ports/menu-repository.port.js';

/**
 * Anti-lockout: replaces the whole menu with the default seed in a single
 * transaction, so a broken configuration is always one request away from a
 * usable sidebar. Route access itself never depends on the menu (guards and
 * URLs keep working regardless).
 */
@Injectable()
export class ResetMenuUseCase implements UseCase<void, MenuTreeNode[]> {
  constructor(private readonly menu: MenuRepositoryPort) {}

  async execute(): Promise<MenuTreeNode[]> {
    await this.menu.replaceAll(buildDefaultMenuItems());

    return buildMenuTree(await this.menu.findAll());
  }
}
