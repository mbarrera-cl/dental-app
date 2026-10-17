import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { MenuItem } from '../../domain/menu-item.entity.js';
import {
  MenuItemNotFoundError,
  MenuParentNotGroupError,
  MenuReorderDuplicateError,
  MenuReorderSelfParentError,
} from '../../domain/menu-item.errors.js';
import { buildMenuTree, type MenuTreeNode } from '../../domain/menu-tree.js';
import { MenuRepositoryPort } from '../ports/menu-repository.port.js';

export interface ReorderMenuEntry {
  id: string;
  parentId: string | null;
  position: number;
}

export interface ReorderMenuItemsCommand {
  updates: readonly ReorderMenuEntry[];
  actorId?: string | null;
}

/**
 * Applies a drag & drop batch: moves and positions are validated (parents
 * must be groups, ids unique and known, depth is structurally capped at two
 * levels) and then *every* parent's children are re-numbered `0..n` by their
 * new positions, so stored gaps or ties can never survive a reorder.
 */
@Injectable()
export class ReorderMenuItemsUseCase implements UseCase<ReorderMenuItemsCommand, MenuTreeNode[]> {
  constructor(private readonly menu: MenuRepositoryPort) {}

  async execute(command: ReorderMenuItemsCommand): Promise<MenuTreeNode[]> {
    const items = await this.menu.findAll();
    const byId = new Map(items.map((item) => [item.id, item]));

    this.assertPayloadIsValid(command.updates, byId);

    const actorId = command.actorId ?? null;

    for (const update of command.updates) {
      byId.get(update.id)!.moveTo(update.parentId, update.position, actorId);
    }

    this.normalizePositions(items);
    await this.menu.saveMany(items);

    return buildMenuTree(items);
  }

  private assertPayloadIsValid(
    updates: readonly ReorderMenuEntry[],
    byId: ReadonlyMap<string, MenuItem>,
  ): void {
    const seen = new Set<string>();

    for (const update of updates) {
      if (seen.has(update.id)) {
        throw new MenuReorderDuplicateError(update.id);
      }

      seen.add(update.id);

      if (!byId.has(update.id)) {
        throw new MenuItemNotFoundError(update.id);
      }
    }

    for (const update of updates) {
      if (update.parentId === null) {
        continue;
      }

      if (update.parentId === update.id) {
        throw new MenuReorderSelfParentError(update.id);
      }

      const parent = byId.get(update.parentId);

      if (parent === undefined || parent.kind !== 'group') {
        throw new MenuParentNotGroupError(update.parentId);
      }
    }
  }

  /** Re-numbers every sibling list `0..n` keeping the (stable) position order. */
  private normalizePositions(items: readonly MenuItem[]): void {
    const parents: (string | null)[] = [
      null,
      ...items.filter((item) => item.kind === 'group').map((item) => item.id),
    ];

    for (const parentId of parents) {
      items
        .filter((item) => item.parentId === parentId)
        .sort((left, right) => left.position - right.position)
        .forEach((item, position) => {
          item.setPosition(position);
        });
    }
  }
}
