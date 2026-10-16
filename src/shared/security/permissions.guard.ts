import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticationRequiredError } from './authentication.errors.js';
import type { AuthenticatedRequest } from './authenticated-request.js';
import { PermissionDeniedError } from './permission.errors.js';
import { REQUIRED_PERMISSIONS_METADATA } from './require-permissions.decorator.js';

/**
 * Global authorization guard (`APP_GUARD`, runs after `JwtAuthGuard`).
 * Routes annotated with `@RequirePermissions(...)` demand **all** listed
 * keys; everything else is open to any authenticated principal.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<readonly string[]>(
      REQUIRED_PERMISSIONS_METADATA,
      [context.getHandler(), context.getClass()],
    );

    if (required === undefined || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const principal = request.user;

    // Defensive: only reachable if the guards run out of order.
    if (principal === undefined) {
      throw new AuthenticationRequiredError();
    }

    const missing = required.filter((key) => !principal.permissions.has(key));

    if (missing.length > 0) {
      throw new PermissionDeniedError(missing);
    }

    return true;
  }
}
