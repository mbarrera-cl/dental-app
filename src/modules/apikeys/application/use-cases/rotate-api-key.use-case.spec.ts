import { ApiKey } from '../../domain/api-key.entity.js';
import { ApiKeyAlreadyRevokedError, ApiKeyNotFoundError } from '../../domain/api-key.errors.js';
import { hashApiKey } from '../../domain/api-key-secret.js';
import { InMemoryApiKeyRepository } from '../../infrastructure/adapters/persistence/in-memory-api-key.repository.js';
import { GetApiKeyUseCase } from './get-api-key.use-case.js';
import { RotateApiKeyUseCase } from './rotate-api-key.use-case.js';

const buildKey = (overrides: Partial<Parameters<typeof ApiKey.create>[0]> = {}) =>
  ApiKey.create({
    userId: 'user-1',
    name: 'CI pipeline',
    prefix: 'hexa_ab12cd34',
    keyHash: 'a'.repeat(64),
    ...overrides,
  });

describe('RotateApiKeyUseCase', () => {
  let apiKeys: InMemoryApiKeyRepository;
  let useCase: RotateApiKeyUseCase;

  beforeEach(() => {
    apiKeys = new InMemoryApiKeyRepository();
    useCase = new RotateApiKeyUseCase(apiKeys, new GetApiKeyUseCase(apiKeys));
  });

  it('replaces the secret in place, keeping identity, name and scopes', async () => {
    const key = buildKey({ scopes: ['dashboard:read'] });
    await apiKeys.save(key);

    const { apiKey, secret } = await useCase.execute({ id: key.id });

    expect(apiKey.id).toBe(key.id);
    expect(apiKey.name).toBe('CI pipeline');
    expect(apiKey.scopes).toEqual(['dashboard:read']);
    expect(apiKey.prefix).not.toBe('hexa_ab12cd34');
    expect(apiKey.keyHash).toBe(hashApiKey(secret));
    await expect(apiKeys.findByHash(hashApiKey(secret))).resolves.toBe(apiKey);
    await expect(apiKeys.findByHash('a'.repeat(64))).resolves.toBeNull();
  });

  it('refuses to rotate a revoked key', async () => {
    const key = buildKey();
    key.revoke(new Date());
    await apiKeys.save(key);

    await expect(useCase.execute({ id: key.id })).rejects.toThrow(ApiKeyAlreadyRevokedError);
  });

  it('throws ApiKeyNotFoundError for unknown ids', async () => {
    await expect(useCase.execute({ id: 'does-not-exist' })).rejects.toThrow(ApiKeyNotFoundError);
  });
});
