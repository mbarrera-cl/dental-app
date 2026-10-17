import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { MenuItem, type MenuKind } from '../../domain/menu-item.entity.js';
import { MenuParentNotGroupError } from '../../domain/menu-item.errors.js';
import { MenuRepositoryPort } from '../ports/menu-repository.port.js';

export interface CreateMenuItemCommand {
  kind: MenuKind;
  label?: string | null;
  icon?: string | null;
  routeKey?: string | null;
  externalUrl?: string | null;
  parentId?: string | null;
  requiredPermission?: string | null;
  enabled?: boolean;
  actorId?: string | null;
}

/**
 * Creates an entry at the end of its parent's list. Entity construction
 * validates kind, destinations, permission key and lengths; the parent (when
 * given) must exist and be a group.
 */
@Injectable()
export class CreateMenuItemUseCase implements UseCase<CreateMenuItemCommand, MenuItem> {
  constructor(private readonly menu: MenuRepositoryPort) {}

  async execute(command: CreateMenuItemCommand): Promise<MenuItem> {
    const item = MenuItem.create({ ...command, createdBy: command.actorId ?? null });

    if (item.parentId !== null) {
      await this.assertParentIsGroup(item.parentId);
    }

    item.setPosition(((await this.menu.maxPosition(item.parentId)) ?? -1) + 1);
    await this.menu.save(item);

    return item;
  }

  private async assertParentIsGroup(parentId: string): Promise<void> {
    const parent = await this.menu.findById(parentId);

    if (parent === null || parent.kind !== 'group') {
      throw new MenuParentNotGroupError(parentId);
    }
  }
}
