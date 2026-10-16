import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { assertPasswordNotReused } from '../../../../shared/security/password-history.js';
import { PasswordHasher } from '../../../../shared/security/password-hasher.js';
import { generatePassword } from '../../../../shared/security/password-generator.js';
import { PasswordPolicyService } from '../../../../shared/security/password-policy.js';
import { PasswordPolicyViolationError } from '../../../../shared/security/password.errors.js';
import { SettingsService } from '../../../settings/application/settings.service.js';
import { EmptyPasswordResetError, UserNotFoundError } from '../../domain/user.errors.js';
import { PasswordHistoryPort } from '../ports/password-history.port.js';
import { UserRepositoryPort } from '../ports/user-repository.port.js';

export interface SetUserPasswordCommand {
  id: string;
  /** New password typed by the administrator. */
  password?: string;
  /** Generate a random one that satisfies the policy (returned once). */
  generate?: boolean;
}

export interface SetUserPasswordResult {
  /** Plain password, present only when it was generated. */
  password: string | null;
}

/**
 * Administrative password reset. The typed/generated candidate goes through
 * the same policy and history checks as self-service changes, the account is
 * unlocked and the user must pick a personal password on next login.
 */
@Injectable()
export class SetUserPasswordUseCase
  implements UseCase<SetUserPasswordCommand, SetUserPasswordResult>
{
  constructor(
    private readonly users: UserRepositoryPort,
    private readonly hasher: PasswordHasher,
    private readonly policy: PasswordPolicyService,
    private readonly settings: SettingsService,
    private readonly history: PasswordHistoryPort,
  ) {}

  async execute({
    id,
    password,
    generate,
  }: SetUserPasswordCommand): Promise<SetUserPasswordResult> {
    const user = await this.users.findById(id);

    if (user === null) {
      throw new UserNotFoundError(id);
    }

    const candidate = await this.candidateFor(password, generate);
    const violations = await this.policy.validate(candidate);

    if (violations.length > 0) {
      throw new PasswordPolicyViolationError(violations);
    }

    const historyCount = await this.settings.getNumber('passwordPolicy.historyCount');

    if (historyCount > 0) {
      await assertPasswordNotReused(this.hasher, this.history, user, candidate, historyCount);
    }

    const replacedHash = user.passwordHash;

    // A reset unlocks the account (a locked-out user cannot log in to change
    // anything) and forces a personal password on next login.
    user.setPassword(await this.hasher.hash(candidate), { mustChange: true });
    user.clearLoginFailures();
    await this.users.update(user);

    if (replacedHash !== null && historyCount > 0) {
      await this.history.append(user.id, replacedHash, new Date());
      await this.history.trim(user.id, historyCount);
    }

    return { password: generate === true ? candidate : null };
  }

  private async candidateFor(
    password: string | undefined,
    generate: boolean | undefined,
  ): Promise<string> {
    if (generate === true) {
      return generatePassword(await this.policy.describe());
    }

    if (typeof password === 'string' && password.length > 0) {
      return password;
    }

    throw new EmptyPasswordResetError();
  }
}
