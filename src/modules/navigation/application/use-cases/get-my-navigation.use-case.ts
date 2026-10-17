import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { visibleMenuTree, type MenuTreeNode } from '../../domain/menu-tree.js';
import { MenuRepositoryPort } from '../ports/menu-repository.port.js';

export interface GetMyNavigationQuery {
  /** Effective permissions of the caller (roles + direct grants, or key scopes). */
  permissions: ReadonlySet<string>;
}

/**
 * Menu tree as seen by a principal: disabled entries are dropped, entries
 * demanding a permission the principal lacks are dropped, and groups without
 * visible children are pruned.
 */
@Injectable()
export class GetMyNavigationUseCase implements UseCase<GetMyNavigationQuery, MenuTreeNode[]> {
  constructor(private readonly menu: MenuRepositoryPort) {}

  async execute(query: GetMyNavigationQuery): Promise<MenuTreeNode[]> {
    return visibleMenuTree(await this.menu.findAll(), query.permissions);
  }
}
