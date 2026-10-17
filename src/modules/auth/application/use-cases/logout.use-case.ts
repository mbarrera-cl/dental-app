import { Injectable } from '@nestjs/common';
import { RefreshTokenRepositoryPort } from '../ports/refresh-token.repository.port.js';
import { hashRefreshToken } from '../session.service.js';

export interface LogoutCommand {
  refreshToken: string | null;
}

/**
 * Ends the current session. The row is hard-deleted: a logged-out token can
 * never be replayed into the rotation grace window. Returns the owner id when
 * a session was actually ended, so the HTTP adapter can audit the event.
 */
@Injectable()
export class LogoutUseCase {
  constructor(private readonly refreshTokens: RefreshTokenRepositoryPort) {}

  async execute({ refreshToken }: LogoutCommand): Promise<string | null> {
    if (refreshToken === null || refreshToken === '') {
      return null;
    }

    const record = await this.refreshTokens.findByHash(hashRefreshToken(refreshToken));

    if (record === null) {
      return null;
    }

    await this.refreshTokens.delete(record.id);

    return record.userId;
  }
}
