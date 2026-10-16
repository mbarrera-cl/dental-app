import { Injectable } from '@nestjs/common';
import { PasswordHasher } from '../../../../shared/security/password-hasher.js';
import { SettingsService } from '../../../settings/application/settings.service.js';
import { UserRepositoryPort } from '../../../users/application/ports/user-repository.port.js';
import { assertLoginAllowed, loadUserWithPassword } from '../credential-flows.js';
import { PasswordChangeRequiredError } from '../../domain/auth.errors.js';
import { LoginAttemptsService } from '../login-attempts.service.js';
import { SessionService, type AuthSessionResult } from '../session.service.js';

export interface LoginCommand {
  email: string;
  password: string;
}

/**
 * Interactive login: verifies credentials, enforces account state (disabled,
 * locked, password expired/reset) and returns a fresh token pair plus the
 * profile. Failures feed the configurable lockout policy.
 */
@Injectable()
export class LoginUseCase {
  constructor(
    private readonly users: UserRepositoryPort,
    private readonly hasher: PasswordHasher,
    private readonly settings: SettingsService,
    private readonly session: SessionService,
    private readonly attempts: LoginAttemptsService,
  ) {}

  async execute({ email, password }: LoginCommand): Promise<AuthSessionResult> {
    const now = new Date();
    const { user, passwordHash } = await loadUserWithPassword(this.users, email);

    assertLoginAllowed(user, now);

    const valid = await this.hasher.verify(password, passwordHash);

    if (!valid) {
      return this.attempts.registerFailure(user, now);
    }

    const expirationDays = await this.settings.getNumber('passwordPolicy.expirationDays');

    if (user.requiresPasswordChangeAt(now, expirationDays)) {
      // Credentials were right: reset the counter but issue no session.
      user.clearLoginFailures();
      await this.users.update(user);

      throw new PasswordChangeRequiredError(user.mustChangePassword ? 'reset' : 'expired');
    }

    user.recordLoginSuccess(now);
    await this.users.update(user);

    return {
      session: await this.session.issueFor(user),
      profile: await this.session.describe(user),
    };
  }
}
