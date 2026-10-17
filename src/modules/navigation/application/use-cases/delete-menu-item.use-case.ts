import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { MenuItemNotFoundError } from '../../domain/menu-item.errors.js';
import { MenuRepositoryPort } from '../ports/menu-repository.port.js';

export interface DeleteMenuItemCommand {
  id: string;
}

/** Deletes an entry together with its children (foreign key cascade). */
@Injectable()
export class DeleteMenuItemUseCase implements UseCase<DeleteMenuItemCommand, void> {
  constructor(private readonly menu: MenuRepositoryPort) {}

  async execute(command: DeleteMenuItemCommand): Promise<void> {
    const item = await this.menu.findById(command.id);

    if (item === null) {
      throw new MenuItemNotFoundError(command.id);
    }

    await this.menu.delete(command.id);
  }
}
