import { Injectable } from '@nestjs/common';
import { ApiKeyAuthenticatorPort } from '../../../../shared/security/api-key-authenticator.port.js';
import type { Principal } from '../../../../shared/security/principal.js';
import { UserAccessReaderPort } from '../../../../shared/security/user-access.reader.port.js';
import { ApiKeyRepositoryPort } from '../../application/ports/api-key.repository.port.js';
import { hashApiKey } from '../../domain/api-key-secret.js';

/**
 * Authenticates `X-Api-Key` requests. Bound to the shared
 * `ApiKeyAuthenticatorPort` so the global guard can use it; the guard works
 * without it (keys simply do not authenticate) until this module is loaded.
 *
 * Permissions are recomputed on every request as
 * `owner's effective permissions ∩ key scopes`, so role changes and
 * revocations apply instantly to every key pointing at that user.
 */
@Injectable()
export class ApiKeyAuthenticatorService extends ApiKeyAuthenticatorPort {
  constructor(
    private readonly apiKeys: ApiKeyRepositoryPort,
    private readonly access: UserAccessReaderPort,
  ) {
    super();
  }

  async authenticate(rawKey: string): Promise<Principal | null> {
    const apiKey = await this.apiKeys.findByHash(hashApiKey(rawKey));

    if (apiKey === null) {
      return null;
    }

    const now = new Date();

    if (!apiKey.isUsable(now)) {
      return null;
    }

    const access = await this.access.load(apiKey.userId);

    // Disabled owners deactivate their keys without touching them.
    if (access === null || access.status !== 'active') {
      return null;
    }

    const effective = new Set([...access.rolePermissions, ...access.directPermissions]);
    const permissions =
      apiKey.scopes === null
        ? effective
        : new Set(apiKey.scopes.filter((scope) => effective.has(scope)));

    apiKey.touch(now);
    await this.apiKeys.update(apiKey);

    return {
      type: 'apikey',
      userId: apiKey.userId,
      apiKeyId: apiKey.id,
      name: access.name,
      permissions,
      roles: access.roles,
    };
  }
}
