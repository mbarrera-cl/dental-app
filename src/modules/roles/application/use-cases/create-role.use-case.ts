import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { ADMIN_ROLE_NAME, Role } from '../../domain/role.entity.js';
import { RoleNameReservedError, RoleNameTakenError } from '../../domain/role.errors.js';
import { RoleRepositoryPort } from '../ports/role-repository.port.js';

export interface CreateRoleCommand {
  name: string;
  description?: string;
  permissions: string[];
}

@Injectable()
export class CreateRoleUseCase implements UseCase<CreateRoleCommand, Role> {
  constructor(private readonly roleRepository: RoleRepositoryPort) {}

  async execute(command: CreateRoleCommand): Promise<Role> {
    // Entity construction validates the name and every permission key first.
    const role = Role.create(command);

    if (role.name.toLowerCase() === ADMIN_ROLE_NAME) {
      throw new RoleNameReservedError();
    }

    const existing = await this.roleRepository.findByName(role.name);

    if (existing !== null) {
      throw new RoleNameTakenError(role.name);
    }

    await this.roleRepository.save(role);

    return role;
  }
}
