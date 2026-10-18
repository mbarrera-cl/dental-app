import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { RoleAssignedError, RoleNotFoundError, RoleProtectedError } from '../../domain/role.errors.js';
import { RoleRepositoryPort } from '../ports/role-repository.port.js';

export interface DeleteRoleCommand {
  id: string;
}

@Injectable()
export class DeleteRoleUseCase implements UseCase<DeleteRoleCommand, void> {
  constructor(private readonly roleRepository: RoleRepositoryPort) {}

  async execute({ id }: DeleteRoleCommand): Promise<void> {
    const current = await this.roleRepository.findById(id);

    if (current === null) {
      throw new RoleNotFoundError(id);
    }

    if (current.role.isProtected) {
      throw new RoleProtectedError(current.role.name, 'it cannot be deleted');
    }

    if (current.userCount > 0) {
      throw new RoleAssignedError(current.role.name, current.userCount);
    }

    await this.roleRepository.delete(id);
  }
}
