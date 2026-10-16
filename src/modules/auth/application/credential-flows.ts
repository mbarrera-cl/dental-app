import { Email } from '../../users/domain/email.vo.js';
import type { User } from '../../users/domain/user.entity.js';
import { UserRepositoryPort } from '../../users/application/ports/user-repository.port.js';
import { AccountDisabledError, AccountLockedError, InvalidCredentialsError } from '../domain/auth.errors.js';

export interface CredentialedUser {
  user: User;
  /** Guaranteed non-null password hash (users without one cannot log in). */
  passwordHash: string;
}

/**
 * Loads a user for an email-based credential flow. Unknown emails, missing
 * passwords and malformed emails all fail with the same generic error.
 */
export async function loadUserWithPassword(
  users: UserRepositoryPort,
  email: string,
): Promise<CredentialedUser> {
  let normalized: string;

  try {
    normalized = Email.create(email).value;
  } catch {
    throw new InvalidCredentialsError();
  }

  const user = await users.findByEmail(normalized);

  if (user === null || user.passwordHash === null) {
    throw new InvalidCredentialsError();
  }

  return { user, passwordHash: user.passwordHash };
}

/**
 * Rejects disabled and locked accounts before verifying credentials. An
 * *expired* lock is cleared so the user starts with a fresh counter (it is
 * persisted by whichever flow updates the aggregate next).
 */
export function assertLoginAllowed(user: User, now: Date): void {
  if (user.status === 'disabled') {
    throw new AccountDisabledError();
  }

  if (user.lockedUntil !== null && user.isLockedAt(now)) {
    throw new AccountLockedError(user.lockedUntil);
  }

  if (user.lockedUntil !== null) {
    user.clearLoginFailures();
  }
}
