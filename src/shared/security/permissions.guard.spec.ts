import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticationRequiredError } from './authentication.errors.js';
import { PermissionDeniedError } from './permission.errors.js';
import { PermissionsGuard } from './permissions.guard.js';
import type { Principal } from './principal.js';
import { REQUIRED_PERMISSIONS_METADATA } from './require-permissions.decorator.js';

/** Attaches handler metadata exactly like `@RequirePermissions` does. */
function handlerWith(metadataKey: string, value: unknown): () => void {
  const handler = (): void => {};
  Reflect.defineMetadata(metadataKey, value, handler);

  return handler;
}

const strictHandler = handlerWith(REQUIRED_PERMISSIONS_METADATA, ['users:read', 'users:update']);
const openHandler = (): void => {};

function contextFor(handler: () => void, principal?: Principal): ExecutionContext {
  const request = { user: principal };

  return {
    getHandler: () => handler,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('PermissionsGuard', () => {
  const guard = new PermissionsGuard(new Reflector());
  const principal = (permissions: string[]): Principal => ({
    type: 'user',
    userId: 'user-1',
    permissions: new Set(permissions),
    roles: [],
  });

  it('allows routes without permission metadata', () => {
    expect(guard.canActivate(contextFor(openHandler))).toBe(true);
  });

  it('allows a principal holding every required permission', () => {
    const context = contextFor(strictHandler, principal(['users:read', 'users:update']));

    expect(guard.canActivate(context)).toBe(true);
  });

  it('rejects with details when a permission is missing', () => {
    const context = contextFor(strictHandler, principal(['users:read']));

    expect(() => guard.canActivate(context)).toThrow(PermissionDeniedError);

    try {
      guard.canActivate(context);
    } catch (error) {
      expect((error as PermissionDeniedError).details).toEqual({ missing: ['users:update'] });
    }
  });

  it('rejects when there is no principal at all', () => {
    expect(() => guard.canActivate(contextFor(strictHandler))).toThrow(AuthenticationRequiredError);
  });
});
