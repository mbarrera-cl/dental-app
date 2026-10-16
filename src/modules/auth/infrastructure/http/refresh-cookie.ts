import type { Request, Response } from 'express';

export const REFRESH_COOKIE_NAME = 'hexa_refresh';

/** Scoped so the refresh token only travels to the auth endpoints. */
export const REFRESH_COOKIE_PATH = '/auth';

interface CookieEnvironment {
  secure: boolean;
  sameSite: 'lax' | 'strict' | 'none';
}

/**
 * Cookie flags come from the environment so deployments can adapt them:
 * `COOKIE_SAMESITE=lax|strict|none` and `COOKIE_SECURE=true|false`
 * (`Secure` defaults to on in production). Cross-site production setups need
 * `SameSite=None; Secure`.
 */
function cookieEnvironment(): CookieEnvironment {
  const sameSite = (process.env.COOKIE_SAMESITE ?? 'lax').toLowerCase();
  const secure =
    process.env.COOKIE_SECURE !== undefined
      ? process.env.COOKIE_SECURE === 'true'
      : process.env.NODE_ENV === 'production';

  return {
    secure,
    sameSite: sameSite === 'strict' || sameSite === 'none' ? sameSite : 'lax',
  };
}

export function setRefreshCookie(response: Response, token: string, expiresAt: Date): void {
  const { secure, sameSite } = cookieEnvironment();

  response.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure,
    sameSite,
    path: REFRESH_COOKIE_PATH,
    expires: expiresAt,
  });
}

export function clearRefreshCookie(response: Response): void {
  const { secure, sameSite } = cookieEnvironment();

  response.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure,
    sameSite,
    path: REFRESH_COOKIE_PATH,
  });
}

/** Minimal cookie-header parser: no `cookie-parser` dependency needed. */
export function readRefreshCookie(request: Request): string | null {
  const header = request.headers.cookie;

  if (header === undefined) {
    return null;
  }

  for (const part of header.split(';')) {
    const separator = part.indexOf('=');

    if (separator === -1) {
      continue;
    }

    const name = part.slice(0, separator).trim();

    if (name === REFRESH_COOKIE_NAME) {
      return decodeURIComponent(part.slice(separator + 1).trim());
    }
  }

  return null;
}
