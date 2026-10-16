import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest } from './authenticated-request.js';
import type { Principal } from './principal.js';

/**
 * Injects the authenticated principal into a controller handler:
 *
 * ```ts
 * @Get('me')
 * me(@CurrentPrincipal() principal: Principal) { ... }
 * ```
 */
export const CurrentPrincipal = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Principal => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    return request.user as Principal;
  },
);
