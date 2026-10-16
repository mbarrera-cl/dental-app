import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { RoleRepositoryPort } from '../../../roles/application/ports/role-repository.port.js';
import { Email } from '../../domain/email.vo.js';
import type { User, UserStatus } from '../../domain/user.entity.js';
import {
  EmptyUserUpdateError,
  LastAdminError,
  UserAlreadyExistsError,
  UserNotFoundError,
} from '../../domain/user.errors.js';
import { UserRepositoryPort } from '../ports/user-repository.port.js';
import { assertKnownRoles } from '../role-check.js';

export interface UpdateUserCommand {
  id: string;
  name?: string;
  email?: string;
  /** Complete replacement of the assigned roles. */
  roles?: readonly string[];
  status?: UserStatus;
}

@Injectable()
export class UpdateUserUseCase implements UseCase<UpdateUserCommand, User> {
  constructor(
    private readonly userRepository: UserRepositoryPort,
    private readonly roles: RoleRepositoryPort,
  ) {}

  async execute({ id, name, email, roles, status }: UpdateUserCommand): Promise<User> {
    const user = await this.userRepository.findById(id);

    if (user === null) {
      throw new UserNotFoundError(id);
    }

    if (
      name === undefined &&
      email === undefined &&
      roles === undefined &&
      status === undefined
    ) {
      throw new EmptyUserUpdateError();
    }

    if (email !== undefined) {
      // Validate and normalize up front so the duplicate check runs on the
      // normalized value — and before the aggregate is mutated.
      const nextEmail = Email.create(email);
      const existing = await this.userRepository.findByEmail(nextEmail.value);

      if (existing !== null && existing.id !== user.id) {
        throw new UserAlreadyExistsError(nextEmail.value);
      }

      user.changeEmail(nextEmail);
    }

    if (name !== undefined) {
      user.changeName(name);
    }

    const roleIds = roles === undefined ? undefined : await assertKnownRoles(this.roles, roles);

    // "Last admin" protection: disabling the account or dropping the admin
    // role would leave the system with nobody able to administer it.
    if (status === 'disabled' || roleIds !== undefined) {
      await this.assertLastAdminSurvives(user.id, {
        demotes: roleIds !== undefined && !(await this.keepsAdminRole(roleIds)),
        disables: status === 'disabled',
      });
    }

    if (status !== undefined) {
      user.changeStatus(status);
    }

    await this.userRepository.update(user);

    if (roleIds !== undefined) {
      await this.userRepository.setRoles(id, roleIds);
    }

    return user;
  }

  private async keepsAdminRole(roleIds: readonly string[]): Promise<boolean> {
    const adminRoleId = await this.userRepository.findAdminRoleId();

    return adminRoleId !== null && roleIds.includes(adminRoleId);
  }

  private async assertLastAdminSurvives(
    userId: string,
    change: { demotes: boolean; disables: boolean },
  ): Promise<void> {
    if (!change.demotes && !change.disables) {
      return;
    }

    const isActiveAdmin = await this.userRepository.isActiveAdmin(userId);

    if (!isActiveAdmin) {
      return;
    }

    if ((await this.userRepository.countActiveAdmins()) > 1) {
      return;
    }

    throw new LastAdminError(change.demotes ? 'demote' : 'disable');
  }
}
