import { Injectable } from '@nestjs/common';
import { PasswordHasher } from '../../../shared/security/password-hasher.js';
import { PasswordPolicyService } from '../../../shared/security/password-policy.js';
import { PasswordPolicyViolationError, PasswordReusedError } from '../../../shared/security/password.errors.js';
import { PasswordHistoryPort } from '../../users/application/ports/password-history.port.js';
import { UserRepositoryPort } from '../../users/application/ports/user-repository.port.js';
import type { User } from '../../users/domain/user.entity.js';
import { SettingsService } from '../../settings/application/settings.service.js';

/**
 * Applies a password change: validates the candidate against the
 * configurable policy and the last-N history, persists the new scrypt hash
 * and records the replaced one. Session revocation and token renewal are
 * the caller's responsibility.
 */
@Injectable()
export class PasswordChangeService {
  constructor(
    private readonly users: UserRepositoryPort,
    private readonly hasher: PasswordHasher,
    private readonly policy: PasswordPolicyService,
    private readonly settings: SettingsService,
    private readonly history: PasswordHistoryPort,
  ) {}

  async change(user: User, newPassword: string): Promise<void> {
    const violations = await this.policy.validate(newPassword);

    if (violations.length > 0) {
      throw new PasswordPolicyViolationError(violations);
    }

    const historyCount = await this.settings.getNumber('passwordPolicy.historyCount');

    if (historyCount > 0) {
      await this.assertNotReused(user, newPassword, historyCount);
    }

    const replacedHash = user.passwordHash;

    user.setPassword(await this.hasher.hash(newPassword), { mustChange: false });
    await this.users.update(user);

    if (replacedHash !== null && historyCount > 0) {
      await this.history.append(user.id, replacedHash, new Date());
      await this.history.trim(user.id, historyCount);
    }
  }

  private async assertNotReused(user: User, candidate: string, historyCount: number): Promise<void> {
    const recent = await this.history.listRecent(user.id, historyCount);
    const storedHashes = [user.passwordHash, ...recent].filter(
      (hash): hash is string => hash !== null,
    );

    for (const stored of storedHashes) {
      if (await this.hasher.verify(candidate, stored)) {
        throw new PasswordReusedError(historyCount);
      }
    }
  }
}
