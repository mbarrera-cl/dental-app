import { Injectable } from '@nestjs/common';
import { UserRepositoryPort } from '../../../users/application/ports/user-repository.port.js';
import type { User } from '../../../users/domain/user.entity.js';
import { InvalidRefreshTokenError } from '../../domain/auth.errors.js';
import { RefreshTokenRepositoryPort } from '../ports/refresh-token.repository.port.js';
import { SessionService, hashRefreshToken, type AuthSessionResult } from '../session.service.js';

/**
 * Anti-race grace window: a refresh token rotated seconds ago may be
 * presented again (two tabs refreshing concurrently) and still gets a new
 * pair. Replays after the window are treated as theft: every session of the
 * user dies.
 */
export const REFRESH_GRACE_WINDOW_MS = 30_000;

export interface RefreshCommand {
  refreshToken: string | null;
}

@Injectable()
export class RefreshUseCase {
  constructor(
    private readonly refreshTokens: RefreshTokenRepositoryPort,
    private readonly users: UserRepositoryPort,
    private readonly session: SessionService,
  ) {}

  async execute({ refreshToken }: RefreshCommand): Promise<AuthSessionResult> {
    if (refreshToken === null || refreshToken === '') {
      throw new InvalidRefreshTokenError();
    }

    const record = await this.refreshTokens.findByHash(hashRefreshToken(refreshToken));

    if (record === null) {
      throw new InvalidRefreshTokenError();
    }

    const now = new Date();

    if (record.expiresAt.getTime() <= now.getTime()) {
      throw new InvalidRefreshTokenError();
    }

    if (record.revokedAt !== null) {
      const revokedAgoMs = now.getTime() - record.revokedAt.getTime();

      if (revokedAgoMs > REFRESH_GRACE_WINDOW_MS) {
        // Reuse detected: assume the token leaked and kill every session.
        await this.refreshTokens.revokeAllForUser(record.userId);

        throw new InvalidRefreshTokenError();
      }

      // Within the grace window: a concurrent rotation, not an attack.
      return this.issueForUser(record.userId);
    }

    await this.refreshTokens.revoke(record.id, now);

    return this.issueForUser(record.userId);
  }

  private async issueForUser(userId: string): Promise<AuthSessionResult> {
    const user = await this.loadActiveUser(userId);

    return {
      session: await this.session.issueFor(user),
      profile: await this.session.describe(user),
    };
  }

  private async loadActiveUser(userId: string): Promise<User> {
    const user = await this.users.findById(userId);

    if (user === null || user.status !== 'active' || !user.hasPassword) {
      await this.refreshTokens.revokeAllForUser(userId);

      throw new InvalidRefreshTokenError();
    }

    return user;
  }
}
