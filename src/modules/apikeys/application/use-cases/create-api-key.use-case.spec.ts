import { UserAccessReaderPort, type UserAccess } from '../../../../shared/security/user-access.reader.port.js';
import { SettingsRepositoryPort } from '../../../settings/application/ports/settings-repository.port.js';
import { SettingsService } from '../../../settings/application/settings.service.js';
import type { SettingValue } from '../../../settings/domain/setting-definition.js';
import {
  ApiKeyLimitReachedError,
  ApiKeyOwnerNotFoundError,
  ApiKeyScopesExceedPermissionsError,
  InvalidApiKeyExpirationError,
  InvalidApiKeyScopesError,
} from '../../domain/api-key.errors.js';
import { hashApiKey } from '../../domain/api-key-secret.js';
import { InMemoryApiKeyRepository } from '../../infrastructure/adapters/persistence/in-memory-api-key.repository.js';
import { CreateApiKeyUseCase } from './create-api-key.use-case.js';

class FakeSettingsRepository extends SettingsRepositoryPort {
  stored: Record<string, SettingValue> = {};

  async findAll(): Promise<Record<string, SettingValue>> {
    return { ...this.stored };
  }

  async saveMany(values: Record<string, SettingValue>): Promise<void> {
    Object.assign(this.stored, values);
  }
}

class FakeUserAccessReader extends UserAccessReaderPort {
  private readonly access = new Map<string, UserAccess>();

  set(userId: string, access: UserAccess): void {
    this.access.set(userId, access);
  }

  async load(userId: string): Promise<UserAccess | null> {
    return this.access.get(userId) ?? null;
  }
}

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

describe('CreateApiKeyUseCase', () => {
  let apiKeys: InMemoryApiKeyRepository;
  let access: FakeUserAccessReader;
  let settingsRepository: FakeSettingsRepository;
  let settings: SettingsService;
  let useCase: CreateApiKeyUseCase;

  beforeEach(() => {
    apiKeys = new InMemoryApiKeyRepository();
    access = new FakeUserAccessReader();
    settingsRepository = new FakeSettingsRepository();
    settings = new SettingsService(settingsRepository);
    useCase = new CreateApiKeyUseCase(apiKeys, access, settings);

    access.set('user-1', {
      status: 'active',
      roles: [{ id: 'role-editor', name: 'editor' }],
      rolePermissions: ['dashboard:read'],
      directPermissions: ['users:read'],
    });
  });

  it('creates an inheriting key with no expiry by default', async () => {
    const { apiKey, secret } = await useCase.execute({ requesterId: 'user-1', name: 'CI' });

    expect(apiKey.userId).toBe('user-1');
    expect(apiKey.scopes).toBeNull();
    expect(apiKey.expiresAt).toBeNull();
    expect(secret.startsWith(`${apiKey.prefix}_`)).toBe(true);
    await expect(apiKeys.findByHash(hashApiKey(secret))).resolves.toBe(apiKey);
  });

  it('accepts a scope subset of the owner permissions (roles plus direct)', async () => {
    const { apiKey } = await useCase.execute({
      requesterId: 'user-1',
      name: 'CI',
      scopes: ['dashboard:read', 'users:read', 'dashboard:read'],
    });

    expect(apiKey.scopes).toEqual(['dashboard:read', 'users:read']);
  });

  it('rejects scope keys outside the catalog', async () => {
    await expect(
      useCase.execute({ requesterId: 'user-1', name: 'CI', scopes: ['ghost:read'] }),
    ).rejects.toThrow(InvalidApiKeyScopesError);
  });

  it('rejects scopes the owner does not hold', async () => {
    await expect(
      useCase.execute({ requesterId: 'user-1', name: 'CI', scopes: ['roles:read'] }),
    ).rejects.toThrow(ApiKeyScopesExceedPermissionsError);
  });

  it('enforces the configured maximum of active keys per user', async () => {
    settingsRepository.stored['apiKeys.maxKeysPerUser'] = 1;

    const first = await useCase.execute({ requesterId: 'user-1', name: 'First' });

    await expect(useCase.execute({ requesterId: 'user-1', name: 'Second' })).rejects.toThrow(
      ApiKeyLimitReachedError,
    );

    // Revoked keys free a slot.
    first.apiKey.revoke(new Date());
    await apiKeys.update(first.apiKey);

    await expect(useCase.execute({ requesterId: 'user-1', name: 'Third' })).resolves.toBeDefined();
  });

  it('uses the configured default expiration and honours an explicit one', async () => {
    settingsRepository.stored['apiKeys.defaultExpirationDays'] = 7;

    const byDefault = await useCase.execute({ requesterId: 'user-1', name: 'Default' });
    const explicit = await useCase.execute({
      requesterId: 'user-1',
      name: 'Explicit',
      expiresInDays: 30,
    });

    expect(byDefault.apiKey.expiresAt).not.toBeNull();
    expect(explicit.apiKey.expiresAt).not.toBeNull();
    expect(byDefault.apiKey.expiresAt!.getTime() - Date.now()).toBeGreaterThan(
      6 * MILLISECONDS_PER_DAY,
    );
    expect(explicit.apiKey.expiresAt!.getTime() - Date.now()).toBeGreaterThan(
      29 * MILLISECONDS_PER_DAY,
    );
  });

  it('rejects impossible expirations', async () => {
    await expect(
      useCase.execute({ requesterId: 'user-1', name: 'CI', expiresInDays: -1 }),
    ).rejects.toThrow(InvalidApiKeyExpirationError);
  });

  it('creates keys on behalf of another user with scopes limited to *their* permissions', async () => {
    access.set('user-2', {
      status: 'active',
      roles: [],
      rolePermissions: [],
      directPermissions: ['dashboard:read'],
    });

    const { apiKey } = await useCase.execute({
      requesterId: 'admin-1',
      userId: 'user-2',
      name: 'For Ada',
      scopes: ['dashboard:read'],
    });

    expect(apiKey.userId).toBe('user-2');

    await expect(
      useCase.execute({ requesterId: 'admin-1', userId: 'user-2', name: 'X', scopes: ['users:read'] }),
    ).rejects.toThrow(ApiKeyScopesExceedPermissionsError);
  });

  it('rejects unknown owners', async () => {
    await expect(useCase.execute({ requesterId: 'ghost', name: 'CI' })).rejects.toThrow(
      ApiKeyOwnerNotFoundError,
    );
  });
});
