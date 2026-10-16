import { createHmac, timingSafeEqual } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';

export const JWT_SECRET_ENV = 'JWT_SECRET';

/** Documented development fallback; production must set `JWT_SECRET`. */
const DEV_SECRET = 'hexa-dev-secret-do-not-use-in-production';

export interface AccessTokenClaims {
  /** User id. */
  sub: string;
  /** Issued at (unix seconds). */
  iat: number;
  /** Expires at (unix seconds). */
  exp: number;
}

/**
 * HS256 JWTs signed with `node:crypto` — no third-party dependency. The
 * token carries identity only (`sub`, `iat`, `exp`): permissions are
 * resolved per request, so revocations and role changes apply instantly.
 */
@Injectable()
export class JwtService {
  private readonly logger = new Logger(JwtService.name);

  private readonly secret: string;

  constructor() {
    const configured = process.env[JWT_SECRET_ENV]?.trim();

    if (configured !== undefined && configured !== '') {
      this.secret = configured;

      return;
    }

    this.secret = DEV_SECRET;

    const message = `${JWT_SECRET_ENV} is not set — using the built-in development secret`;
    if (process.env.NODE_ENV === 'production') {
      this.logger.warn(`${message}. Set ${JWT_SECRET_ENV} in production!`);
    } else {
      this.logger.log(message);
    }
  }

  signAccessToken(userId: string, ttlSeconds: number, now: Date = new Date()): string {
    const issuedAt = Math.floor(now.getTime() / 1000);
    const claims: AccessTokenClaims = { sub: userId, iat: issuedAt, exp: issuedAt + ttlSeconds };
    const header = { alg: 'HS256', typ: 'JWT' };
    const signingInput = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(claims))}`;

    return `${signingInput}.${this.sign(signingInput)}`;
  }

  /** Returns the claims, or `null` for malformed, tampered or expired tokens. */
  verifyAccessToken(token: string, now: Date = new Date()): AccessTokenClaims | null {
    const parts = token.split('.');

    if (parts.length !== 3) {
      return null;
    }

    const [header, payload, signature] = parts;

    if (header === undefined || payload === undefined || signature === undefined) {
      return null;
    }

    if (!this.verifySignature(`${header}.${payload}`, signature)) {
      return null;
    }

    let claims: unknown;

    try {
      claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    } catch {
      return null;
    }

    if (typeof claims !== 'object' || claims === null) {
      return null;
    }

    const { sub, iat, exp } = claims as Partial<AccessTokenClaims>;

    if (
      typeof sub !== 'string' ||
      typeof iat !== 'number' ||
      typeof exp !== 'number' ||
      exp * 1000 <= now.getTime()
    ) {
      return null;
    }

    return { sub, iat, exp };
  }

  private sign(signingInput: string): string {
    return createHmac('sha256', this.secret).update(signingInput).digest('base64url');
  }

  private verifySignature(signingInput: string, signature: string): boolean {
    const expected = Buffer.from(this.sign(signingInput), 'base64url');
    const provided = Buffer.from(signature, 'base64url');

    return expected.length === provided.length && timingSafeEqual(expected, provided);
  }
}

function base64Url(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}
