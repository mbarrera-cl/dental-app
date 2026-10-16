import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { PasswordHasher } from '../../../../shared/security/password-hasher.js';
import { PasswordPolicyService } from '../../../../shared/security/password-policy.js';
import { PasswordPolicyViolationError } from '../../../../shared/security/password.errors.js';
import { RoleRepositoryPort } from '../../../roles/application/ports/role-repository.port.js';
import { User, type UserStatus } from '../../domain/user.entity.js';
import { UserAlreadyExistsError } from '../../domain/user.errors.js';
import { UserRepositoryPort } from '../ports/user-repository.port.js';
import { assertKnownRoles } from '../role-check.js';

export interface CreateUserCommand {
  email: string;
  name: string;
  /** Optional initial password; without one the user cannot log in yet. */
  password?: string;
  /** Role ids to assign right after creation. */
  roles?: readonly string[];
  status?: UserStatus;
}

@Injectable()
export class CreateUserUseCase implements UseCase<CreateUserCommand, User> {
  constructor(
    private readonly userRepository: UserRepositoryPort,
    private readonly roles: RoleRepositoryPort,
    private readonly hasher: PasswordHasher,
    private readonly policy: PasswordPolicyService,
  ) {}

  async execute({ email, name, password, roles, status }: CreateUserCommand): Promise<User> {
    // Build the entity first so domain invariants (email format, name) are
    // validated before the repository is touched.
    const user = User.create({ email, name, status });

    const existing = await this.userRepository.findByEmail(user.email);

    if (existing !== null) {
      throw new UserAlreadyExistsError(user.email);
    }

    // Fail before persisting anything: unknown role ids and policy-breaking
    // passwords must not leave a half-created account behind.
    const roleIds = roles === undefined ? [] : await assertKnownRoles(this.roles, roles);

    if (password !== undefined) {
      const violations = await this.policy.validate(password);

      if (violations.length > 0) {
        throw new PasswordPolicyViolationError(violations);
      }

      user.setPassword(await this.hasher.hash(password), { mustChange: false });
    }

    // Note: this check-then-save flow is illustrative. With a real database,
    // enforce uniqueness with a constraint and catch the violation.
    await this.userRepository.save(user);

    if (roleIds.length > 0) {
      await this.userRepository.setRoles(user.id, roleIds);
    }

    return user;
  }
}
