import { Injectable } from '@nestjs/common';
import { SettingsService } from '../../settings/application/settings.service.js';
import { UserRepositoryPort } from '../../users/application/ports/user-repository.port.js';
import type { User } from '../../users/domain/user.entity.js';
import { AccountLockedError, InvalidCredentialsError } from '../domain/auth.errors.js';

/**
 * Failed-credential bookkeeping shared by every flow that verifies a
 * password (login, change-expired-password, change-password): counts the
 * failure and locks the account once the configurable threshold is reached.
 */
@Injectable()
export class LoginAttemptsService {
  constructor(
    private readonly users: UserRepositoryPort,
    private readonly settings: SettingsService,
  ) {}

  /** Records the failure and always throws the appropriate error. */
  async registerFailure(user: User, now: Date): Promise<never> {
    user.registerFailedLogin();

    const maxAttempts = await this.settings.getNumber('login.maxFailedAttempts');

    if (maxAttempts > 0 && user.failedLoginAttempts >= maxAttempts) {
      const lockMinutes = await this.settings.getNumber('login.lockDurationMinutes');
      const lockedUntil = new Date(now.getTime() + lockMinutes * 60 * 1000);

      user.lockUntil(lockedUntil);
      await this.users.update(user);

      throw new AccountLockedError(lockedUntil);
    }

    await this.users.update(user);

    throw new InvalidCredentialsError();
  }
}
