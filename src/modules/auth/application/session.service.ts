import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { JwtService } from '../../../shared/security/jwt.js';
import { PermissionResolver } from '../../../shared/security/permission-resolver.js';
import type { RoleRef } from '../../../shared/security/principal.js';
import { SettingsService } from '../../settings/application/settings.service.js';
import type { User } from '../../users/domain/user.entity.js';
import { RefreshTokenRepositoryPort } from './ports/refresh-token.repository.port.js';

export interface IssuedSession {
  accessToken: string;
  /** Access token lifetime in seconds (the client schedules renewal with it). */
  expiresInSeconds: number;
  /** Opaque token; only sent to the client through the httpOnly cookie. */
  refreshToken: string;
  refreshExpiresAt: Date;
}

/** Profile + permission breakdown shared by login, refresh and `GET /auth/me`. */
export interface AuthProfile {
  user: { id: string; email: string; name: string; status: 'active' | 'disabled' };
  roles: RoleRef[];
  permissions: { fromRoles: string[]; direct: string[]; effective: string[] };
}

export interface AuthSessionResult {
  session: IssuedSession;
  profile: AuthProfile;
}

/** Hex SHA-256 of a refresh token — the only representation we store. */
export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Issues and describes sessions. Every flow that signs a user in (login,
 * refresh rotation, password changes) goes through here, so token format,
 * TTLs and cookie payloads stay consistent.
 */
@Injectable()
export class SessionService {
  constructor(
    private readonly jwt: JwtService,
    private readonly settings: SettingsService,
    private readonly refreshTokens: RefreshTokenRepositoryPort,
    private readonly permissionResolver: PermissionResolver,
  ) {}

  async issueFor(user: User): Promise<IssuedSession> {
    const now = new Date();
    const accessTtlMinutes = await this.settings.getNumber('session.accessTokenTtlMinutes');
    const refreshTtlDays = await this.settings.getNumber('session.refreshTokenTtlDays');
    const refreshToken = randomBytes(32).toString('base64url');
    const refreshExpiresAt = new Date(now.getTime() + refreshTtlDays * 24 * 60 * 60 * 1000);

    await this.refreshTokens.save({
      id: randomUUID(),
      userId: user.id,
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt: refreshExpiresAt,
      revokedAt: null,
      createdAt: now,
    });

    return {
      accessToken: this.jwt.signAccessToken(user.id, accessTtlMinutes * 60, now),
      expiresInSeconds: accessTtlMinutes * 60,
      refreshToken,
      refreshExpiresAt,
    };
  }

  async describe(user: User): Promise<AuthProfile> {
    const breakdown = await this.permissionResolver.describe(user.id);

    return {
      user: { id: user.id, email: user.email, name: user.name, status: user.status },
      roles: breakdown?.roles ?? [],
      permissions: {
        fromRoles: breakdown?.fromRoles ?? [],
        direct: breakdown?.direct ?? [],
        effective: breakdown?.effective ?? [],
      },
    };
  }
}
