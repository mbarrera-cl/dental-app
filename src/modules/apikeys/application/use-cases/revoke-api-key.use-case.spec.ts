import { ApiKey } from '../../domain/api-key.entity.js';
import { ApiKeyAlreadyRevokedError, ApiKeyNotFoundError } from '../../domain/api-key.errors.js';
import { InMemoryApiKeyRepository } from '../../infrastructure/adapters/persistence/in-memory-api-key.repository.js';
import { GetApiKeyUseCase } from './get-api-key.use-case.js';
import { RevokeApiKeyUseCase } from './revoke-api-key.use-case.js';

const buildKey = () =>
  ApiKey.create({
    userId: 'user-1',
    name: 'CI pipeline',
    prefix: 'hexa_ab12cd34',
    keyHash: 'a'.repeat(64),
  });

describe('RevokeApiKeyUseCase', () => {
  let apiKeys: InMemoryApiKeyRepository;
  let useCase: RevokeApiKeyUseCase;

  beforeEach(() => {
    apiKeys = new InMemoryApiKeyRepository();
    useCase = new RevokeApiKeyUseCase(apiKeys, new GetApiKeyUseCase(apiKeys));
  });

  it('marks the key as revoked and persists it', async () => {
    const key = buildKey();
    await apiKeys.save(key);

    const revoked = await useCase.execute({ id: key.id });

    expect(revoked.isRevoked).toBe(true);
    await expect(apiKeys.findById(key.id)).resolves.toBe(revoked);
    await expect(apiKeys.countActiveByUser('user-1', new Date())).resolves.toBe(0);
  });

  it('refuses to revoke twice', async () => {
    const key = buildKey();
    await apiKeys.save(key);

    await useCase.execute({ id: key.id });

    await expect(useCase.execute({ id: key.id })).rejects.toThrow(ApiKeyAlreadyRevokedError);
  });

  it('throws ApiKeyNotFoundError for unknown ids', async () => {
    await expect(useCase.execute({ id: 'does-not-exist' })).rejects.toThrow(ApiKeyNotFoundError);
  });
});
