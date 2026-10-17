import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticationRequiredError } from './authentication.errors.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { JwtService } from './jwt.js';
import { PermissionResolver } from './permission-resolver.js';
import { IS_PUBLIC_METADATA } from './public.decorator.js';
import type { Principal } from './principal.js';

/** Attaches handler metadata exactly like the decorators do. */
function handlerWith(metadataKey: string, value: unknown): () => void {
  const handler = (): void => {};
  Reflect.defineMetadata(metadataKey, value, handler);

  return handler;
}

const openHandler = handlerWith(IS_PUBLIC_METADATA, true);
const strictHandler = (): void => {};

interface FakeRequest {
  headers: Record<string, string | undefined>;
  user?: Principal;
}

function contextFor(handler: () => void, request: FakeRequest): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => class {},
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  const jwt = new JwtService();
  const principal: Principal = {
    type: 'user',
    userId: 'user-1',
    permissions: new Set(['users:read']),
    roles: [],
  };
  const resolver = {
    resolveUser: async (userId: string) => (userId === 'user-1' ? principal : null),
  } as unknown as PermissionResolver;
  const guard = new JwtAuthGuard(new Reflector(), jwt, resolver);

  it('lets @Public routes through without credentials', async () => {
    const request: FakeRequest = { headers: {} };

    await expect(guard.canActivate(contextFor(openHandler, request))).resolves.toBe(true);
    expect(request.user).toBeUndefined();
  });

  it('rejects protected routes without a token', async () => {
    await expect(guard.canActivate(contextFor(strictHandler, { headers: {} }))).rejects.toThrow(
      AuthenticationRequiredError,
    );
  });

  it('rejects invalid or expired tokens', async () => {
    await expect(
      guard.canActivate(
        contextFor(strictHandler, { headers: { authorization: 'Bearer nope' } }),
      ),
    ).rejects.toThrow(AuthenticationRequiredError);
  });

  it('attaches the resolved principal for a valid token', async () => {
    const request: FakeRequest = {
      headers: { authorization: `Bearer ${jwt.signAccessToken('user-1', 60)}` },
    };

    await expect(guard.canActivate(contextFor(strictHandler, request))).resolves.toBe(true);
    expect(request.user).toBe(principal);
  });

  it('rejects tokens of principals that no longer resolve', async () => {
    const token = jwt.signAccessToken('deleted-user', 60);

    await expect(
      guard.canActivate(contextFor(strictHandler, { headers: { authorization: `Bearer ${token}` } })),
    ).rejects.toThrow(AuthenticationRequiredError);
  });

  it('rejects X-Api-Key when no authenticator is bound', async () => {
    await expect(
      guard.canActivate(contextFor(strictHandler, { headers: { 'x-api-key': 'hexa_whatever' } })),
    ).rejects.toThrow(AuthenticationRequiredError);
  });
});
