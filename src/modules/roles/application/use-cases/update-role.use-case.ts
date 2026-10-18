import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { ADMIN_CRITICAL_PERMISSIONS } from '../../../../shared/security/permissions.js';
import { ADMIN_ROLE_NAME } from '../../domain/role.entity.js';
import {
  EmptyRoleUpdateError,
  RoleNameReservedError,
  RoleNameTakenError,
  RoleNotFoundError,
  RoleProtectedError,
} from '../../domain/role.errors.js';
import { RoleRepositoryPort, type RoleWithUsage } from '../ports/role-repository.port.js';

export interface UpdateRoleCommand {
  id: string;
  name?: string;
  description?: string;
  permissions?: string[];
}

@Injectable()
export class UpdateRoleUseCase implements UseCase<UpdateRoleCommand, RoleWithUsage> {
  constructor(private readonly roleRepository: RoleRepositoryPort) {}

  async execute(command: UpdateRoleCommand): Promise<RoleWithUsage> {
    if (command.name === undefined && command.description === undefined && command.permissions === undefined) {
      throw new EmptyRoleUpdateError();
    }

    const current = await this.roleRepository.findById(command.id);

    if (current === null) {
      throw new RoleNotFoundError(command.id);
    }

    const role = current.role;

    // Built-in roles keep their name frozen so the bootstrapper can find them
    // (and seeding never duplicates them). Only the built-in administrator is
    // additionally forced to keep every administration permission, so nobody
    // can lock the system out of its own panel; every other built-in role
    // (e.g. `dentista`) is fully editable by the administrator.
    if (role.isProtected) {
      if (command.name !== undefined && command.name.trim() !== role.name) {
        throw new RoleProtectedError(role.name, 'its name cannot be changed');
      }

      if (role.name === ADMIN_ROLE_NAME && command.permissions !== undefined) {
        const missing = ADMIN_CRITICAL_PERMISSIONS.filter((key) => !command.permissions!.includes(key));

        if (missing.length > 0) {
          throw new RoleProtectedError(
            role.name,
            `it must keep every administration permission (missing: ${missing.join(', ')})`,
          );
        }
      }
    }

    if (command.name !== undefined && command.name.trim().toLowerCase() !== role.name.toLowerCase()) {
      if (command.name.trim().toLowerCase() === ADMIN_ROLE_NAME) {
        throw new RoleNameReservedError();
      }

      const existing = await this.roleRepository.findByName(command.name);

      if (existing !== null && existing.id !== role.id) {
        throw new RoleNameTakenError(command.name);
      }
    }

    if (command.name !== undefined) {
      role.rename(command.name);
    }

    if (command.description !== undefined) {
      role.changeDescription(command.description);
    }

    if (command.permissions !== undefined) {
      role.changePermissions(command.permissions);
    }

    await this.roleRepository.update(role);

    return { role, userCount: await this.roleRepository.countAssignedUsers(role.id) };
  }
}
