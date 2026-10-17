import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import type { MenuItem } from '../../domain/menu-item.entity.js';
import { EmptyMenuItemUpdateError, MenuItemNotFoundError } from '../../domain/menu-item.errors.js';
import { MenuRepositoryPort } from '../ports/menu-repository.port.js';

export interface UpdateMenuItemCommand {
  id: string;
  /** `undefined` = leave untouched; `null` = clear (fall back to i18n). */
  label?: string | null;
  icon?: string | null;
  /** Both destinations are replaced as a pair when either is present. */
  routeKey?: string | null;
  externalUrl?: string | null;
  requiredPermission?: string | null;
  enabled?: boolean;
  actorId?: string | null;
}

/**
 * Partial update: every field is tri-state (absent = untouched, `null` =
 * cleared, value = set). Moving between parents is *not* part of this use
 * case — that is the reorder endpoint's job.
 */
@Injectable()
export class UpdateMenuItemUseCase implements UseCase<UpdateMenuItemCommand, MenuItem> {
  constructor(private readonly menu: MenuRepositoryPort) {}

  async execute(command: UpdateMenuItemCommand): Promise<MenuItem> {
    const item = await this.menu.findById(command.id);

    if (item === null) {
      throw new MenuItemNotFoundError(command.id);
    }

    const actorId = command.actorId ?? null;
    let changed = false;

    if (command.label !== undefined) {
      item.rename(command.label, actorId);
      changed = true;
    }

    if (command.icon !== undefined) {
      item.changeIcon(command.icon, actorId);
      changed = true;
    }

    if (command.routeKey !== undefined || command.externalUrl !== undefined) {
      item.changeDestination(command.routeKey ?? null, command.externalUrl ?? null, actorId);
      changed = true;
    }

    if (command.requiredPermission !== undefined) {
      item.requirePermission(command.requiredPermission, actorId);
      changed = true;
    }

    if (command.enabled !== undefined) {
      item.setEnabled(command.enabled, actorId);
      changed = true;
    }

    if (!changed) {
      throw new EmptyMenuItemUpdateError();
    }

    await this.menu.update(item);

    return item;
  }
}
