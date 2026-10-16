import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { isPermissionKey } from '../../../../shared/security/permissions.js';
import { UserAccessReaderPort, type UserAccess } from '../../../../shared/security/user-access.reader.port.js';
import { SettingsService } from '../../../settings/application/settings.service.js';
import { ApiKey } from '../../domain/api-key.entity.js';
import {
  ApiKeyLimitReachedError,
  ApiKeyOwnerNotFoundError,
  ApiKeyScopesExceedPermissionsError,
  InvalidApiKeyExpirationError,
  InvalidApiKeyScopesError,
} from '../../domain/api-key.errors.js';
import { generateApiKeySecret } from '../../domain/api-key-secret.js';
import { ApiKeyRepositoryPort } from '../ports/api-key.repository.port.js';

const MAX_EXPIRATION_DAYS = 3650;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export interface CreateApiKeyCommand {
  /** Caller of the request; owns the key unless `userId` says otherwise. */
  requesterId: string;
  /** Create on behalf of another user (needs `apikeys:manage`). */
  userId?: string;
  name: string;
  /** `null`/omitted inherits every effective permission of the owner. */
  scopes?: readonly string[] | null;
  /** Lifetime in days; `0` = no expiry. Default from settings. */
  expiresInDays?: number;
}

export interface CreateApiKeyResult {
  apiKey: ApiKey;
  /** Plain secret: returned exactly once, only its hash is stored. */
  secret: string;
}

@Injectable()
export class CreateApiKeyUseCase implements UseCase<CreateApiKeyCommand, CreateApiKeyResult> {
  constructor(
    private readonly apiKeys: ApiKeyRepositoryPort,
    private readonly access: UserAccessReaderPort,
    private readonly settings: SettingsService,
  ) {}

  async execute({
    requesterId,
    userId,
    name,
    scopes,
    expiresInDays,
  }: CreateApiKeyCommand): Promise<CreateApiKeyResult> {
    const ownerId = userId ?? requesterId;

    const maxKeys = await this.settings.getNumber('apiKeys.maxKeysPerUser');
    const activeKeys = await this.apiKeys.countActiveByUser(ownerId, new Date());

    if (activeKeys >= maxKeys) {
      throw new ApiKeyLimitReachedError(maxKeys);
    }

    const access = await this.access.load(ownerId);

    if (access === null) {
      throw new ApiKeyOwnerNotFoundError(ownerId);
    }

    const validatedScopes = this.validateScopes(scopes, access);
    const expiresAt = await this.resolveExpiration(expiresInDays);

    const { plain, prefix, hash } = generateApiKeySecret();
    const apiKey = ApiKey.create({
      userId: ownerId,
      name,
      prefix,
      keyHash: hash,
      scopes: validatedScopes,
      expiresAt,
    });

    await this.apiKeys.save(apiKey);

    return { apiKey, secret: plain };
  }

  /**
   * Scopes are checked twice over: against the catalog (typos/obsolete keys
   * fail loudly) and against the owner's **current** effective permissions,
   * because a key can only ever scope down.
   */
  private validateScopes(
    scopes: readonly string[] | null | undefined,
    access: UserAccess,
  ): readonly string[] | null {
    if (scopes === null || scopes === undefined) {
      return null;
    }

    const unique = [...new Set(scopes)];
    const unknown = unique.filter((key) => !isPermissionKey(key));

    if (unknown.length > 0) {
      throw new InvalidApiKeyScopesError(unknown);
    }

    const effective = new Set([...access.rolePermissions, ...access.directPermissions]);
    const exceeding = unique.filter((key) => !effective.has(key));

    if (exceeding.length > 0) {
      throw new ApiKeyScopesExceedPermissionsError(exceeding);
    }

    return unique;
  }

  private async resolveExpiration(expiresInDays?: number): Promise<Date | null> {
    const days = expiresInDays ?? (await this.settings.getNumber('apiKeys.defaultExpirationDays'));

    if (!Number.isInteger(days) || days < 0 || days > MAX_EXPIRATION_DAYS) {
      throw new InvalidApiKeyExpirationError(days);
    }

    return days === 0 ? null : new Date(Date.now() + days * MILLISECONDS_PER_DAY);
  }
}
