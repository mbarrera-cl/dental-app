import { Inject, Injectable, Optional, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiKeyAuthenticatorPort } from './api-key-authenticator.port.js';
import { AuthenticationRequiredError } from './authentication.errors.js';
import type { AuthenticatedRequest } from './authenticated-request.js';
import { JwtService } from './jwt.js';
import { IS_PUBLIC_METADATA } from './public.decorator.js';
import { PermissionResolver } from './permission-resolver.js';
import type { Principal } from './principal.js';

const API_KEY_HEADER = 'x-api-key';
const BEARER_PREFIX = 'Bearer ';

/**
 * Global authentication guard (`APP_GUARD`): every route requires a valid
 * principal unless annotated with `@Public()`. Accepts `Authorization:
 * Bearer <jwt>` for interactive sessions and `X-Api-Key` when the api keys
 * module has bound its authenticator. On success attaches the principal to
 * the request; permissions are resolved here, per request.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly permissionResolver: PermissionResolver,
    @Optional()
    @Inject(ApiKeyAuthenticatorPort)
    private readonly apiKeyAuthenticator: ApiKeyAuthenticatorPort | null = null,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // MCP capability handlers run in the RPC pipeline where authentication is
    // performed once by the transport controller; there is no HTTP request.
    if (context.getType() !== 'http') {
      return true;
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_METADATA, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic === true) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    // The controller may run after the global APP_GUARD already authenticated
    // this request (e.g. the MCP transport controller).
    if (request.user !== undefined) {
      return true;
    }

    const principal = await this.authenticate(request);

    if (principal === null) {
      throw new AuthenticationRequiredError();
    }

    request.user = principal;

    return true;
  }

  private async authenticate(request: AuthenticatedRequest): Promise<Principal | null> {
    const apiKey = request.headers[API_KEY_HEADER];

    if (typeof apiKey === 'string' && apiKey.trim() !== '') {
      // Unavailable until the api keys module binds its authenticator.
      return this.apiKeyAuthenticator === null
        ? null
        : this.apiKeyAuthenticator.authenticate(apiKey.trim());
    }

    const authorization = request.headers.authorization;

    if (typeof authorization !== 'string' || !authorization.startsWith(BEARER_PREFIX)) {
      return null;
    }

    const token = authorization.slice(BEARER_PREFIX.length).trim();
    const claims = this.jwt.verifyAccessToken(token);

    if (claims !== null) {
      return this.permissionResolver.resolveUser(claims.sub);
    }

    // MCP clients send the opaque API key in the standard Bearer header.
    return this.apiKeyAuthenticator === null ? null : this.apiKeyAuthenticator.authenticate(token);
  }
}
