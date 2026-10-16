import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types.js';

/**
 * Credentials for the administrator created by the identity bootstrap in
 * every e2e app. Call `useE2eAdminCredentials()` before `app.init()` so the
 * account is predictable, and `clearE2eAdminCredentials()` after each test.
 */
export const E2E_ADMIN_EMAIL = 'admin@e2e.local';
export const E2E_ADMIN_PASSWORD = 'E2e-Admin-123!';

export function useE2eAdminCredentials(): void {
  process.env.ADMIN_EMAIL = E2E_ADMIN_EMAIL;
  process.env.ADMIN_PASSWORD = E2E_ADMIN_PASSWORD;
}

export function clearE2eAdminCredentials(): void {
  delete process.env.ADMIN_EMAIL;
  delete process.env.ADMIN_PASSWORD;
}

/** Signs in as the bootstrap administrator; returns the `Authorization` header value. */
export async function loginAsAdmin(app: INestApplication<App>): Promise<string> {
  const response = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email: E2E_ADMIN_EMAIL, password: E2E_ADMIN_PASSWORD })
    .expect(200);

  return `Bearer ${(response.body as { accessToken: string }).accessToken}`;
}

interface HeadersCarrier {
  headers: Record<string, string | string[] | undefined>;
}

/** Extracts the `hexa_refresh=...` cookie pair from a response's Set-Cookie header. */
export function refreshCookieOf(response: HeadersCarrier): string {
  const raw = response.headers['set-cookie'];
  const cookies = raw === undefined ? [] : Array.isArray(raw) ? raw : [raw];
  const cookie = cookies.find((value) => value.startsWith('hexa_refresh='));

  if (cookie === undefined) {
    throw new Error('The response does not contain the refresh cookie');
  }

  return cookie.split(';')[0] as string;
}
