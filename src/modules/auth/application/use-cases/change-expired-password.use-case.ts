import { Injectable } from '@nestjs/common';
import { PasswordHasher } from '../../../../shared/security/password-hasher.js';
import { UserRepositoryPort } from '../../../users/application/ports/user-repository.port.js';
import { assertLoginAllowed, loadUserWithPassword } from '../credential-flows.js';
import { LoginAttemptsService } from '../login-attempts.service.js';
import { PasswordChangeService } from '../password-change.service.js';
import { SessionService, type AuthSessionResult } from '../session.service.js';

export interface ChangeExpiredPasswordCommand {
  email: string;
  currentPassword: string;
  newPassword: string;
}

/**
 * Public flow for expired or admin-reset passwords: the user proves the
 * current credentials, picks a new password and is signed in automatically.
 * Failures count toward the lockout policy, exactly like login.
 */
@Injectable()
export class ChangeExpiredPasswordUseCase {
  constructor(
    private readonly users: UserRepositoryPort,
    private readonly hasher: PasswordHasher,
    private readonly attempts: LoginAttemptsService,
    private readonly passwordChange: PasswordChangeService,
    private readonly session: SessionService,
  ) {}

  async execute({
    email,
    currentPassword,
    newPassword,
  }: ChangeExpiredPasswordCommand): Promise<AuthSessionResult> {
    const now = new Date();
    const { user, passwordHash } = await loadUserWithPassword(this.users, email);

    assertLoginAllowed(user, now);

    const valid = await this.hasher.verify(currentPassword, passwordHash);

    if (!valid) {
      return this.attempts.registerFailure(user, now);
    }

    await this.passwordChange.change(user, newPassword);
    user.recordLoginSuccess(now);
    await this.users.update(user);

    return {
      session: await this.session.issueFor(user),
      profile: await this.session.describe(user),
    };
  }
}
