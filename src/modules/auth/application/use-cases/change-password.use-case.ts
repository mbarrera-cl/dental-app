import { Injectable } from '@nestjs/common';
import { PasswordHasher } from '../../../../shared/security/password-hasher.js';
import { AuthenticationRequiredError } from '../../../../shared/security/authentication.errors.js';
import { UserRepositoryPort } from '../../../users/application/ports/user-repository.port.js';
import { AccountDisabledError } from '../../domain/auth.errors.js';
import { LoginAttemptsService } from '../login-attempts.service.js';
import { PasswordChangeService } from '../password-change.service.js';
import { RefreshTokenRepositoryPort } from '../ports/refresh-token.repository.port.js';
import { SessionService, type AuthSessionResult } from '../session.service.js';

export interface ChangePasswordCommand {
  userId: string;
  currentPassword: string;
  newPassword: string;
}

/**
 * Authenticated password change. Verifies the current password (failures
 * feed the lockout policy), applies policy + history to the new one and
 * revokes *every other* session: all refresh tokens die, then the caller
 * receives a fresh pair so this client stays signed in.
 */
@Injectable()
export class ChangePasswordUseCase {
  constructor(
    private readonly users: UserRepositoryPort,
    private readonly hasher: PasswordHasher,
    private readonly attempts: LoginAttemptsService,
    private readonly passwordChange: PasswordChangeService,
    private readonly refreshTokens: RefreshTokenRepositoryPort,
    private readonly session: SessionService,
  ) {}

  async execute({
    userId,
    currentPassword,
    newPassword,
  }: ChangePasswordCommand): Promise<AuthSessionResult> {
    const now = new Date();
    const user = await this.users.findById(userId);

    if (user === null || user.passwordHash === null) {
      throw new AuthenticationRequiredError();
    }

    if (user.status === 'disabled') {
      throw new AccountDisabledError();
    }

    const valid = await this.hasher.verify(currentPassword, user.passwordHash);

    if (!valid) {
      return this.attempts.registerFailure(user, now);
    }

    user.clearLoginFailures();
    await this.passwordChange.change(user, newPassword);
    await this.refreshTokens.revokeAllForUser(user.id);

    return {
      session: await this.session.issueFor(user),
      profile: await this.session.describe(user),
    };
  }
}
