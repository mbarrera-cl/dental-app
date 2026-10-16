import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { PermissionUnknownError } from '../../../../shared/security/permission.errors.js';
import { isPermissionKey } from '../../../../shared/security/permissions.js';
import type { User } from '../../domain/user.entity.js';
import { UserNotFoundError } from '../../domain/user.errors.js';
import { UserRepositoryPort } from '../ports/user-repository.port.js';

export interface UpdateUserPermissionsCommand {
  id: string;
  /** Complete replacement of the direct (non-role) permissions. */
  permissions: readonly string[];
}

@Injectable()
export class UpdateUserPermissionsUseCase
  implements UseCase<UpdateUserPermissionsCommand, User>
{
  constructor(private readonly userRepository: UserRepositoryPort) {}

  async execute({ id, permissions }: UpdateUserPermissionsCommand): Promise<User> {
    const user = await this.userRepository.findById(id);

    if (user === null) {
      throw new UserNotFoundError(id);
    }

    const unique = [...new Set(permissions)];
    const unknown = unique.filter((key) => !isPermissionKey(key));

    if (unknown.length > 0) {
      throw new PermissionUnknownError(unknown);
    }

    await this.userRepository.setDirectPermissions(id, unique);

    return user;
  }
}
