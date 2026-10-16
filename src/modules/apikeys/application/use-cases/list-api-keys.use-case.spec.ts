import { ApiKey } from '../../domain/api-key.entity.js';
import { ApiKeyNotFoundError } from '../../domain/api-key.errors.js';
import { InMemoryApiKeyRepository } from '../../infrastructure/adapters/persistence/in-memory-api-key.repository.js';
import { GetApiKeyUseCase } from './get-api-key.use-case.js';
import { ListApiKeysUseCase } from './list-api-keys.use-case.js';

const buildKey = (userId: string, name: string) =>
  ApiKey.create({
    userId,
    name,
    prefix: 'hexa_ab12cd34',
    keyHash: `${userId}-${name}`.padEnd(64, '0'),
  });

describe('GetApiKeyUseCase', () => {
  it('returns the key and throws for unknown ids', async () => {
    const apiKeys = new InMemoryApiKeyRepository();
    const key = buildKey('user-1', 'CI');
    await apiKeys.save(key);

    const useCase = new GetApiKeyUseCase(apiKeys);

    await expect(useCase.execute({ id: key.id })).resolves.toBe(key);
    await expect(useCase.execute({ id: 'ghost' })).rejects.toThrow(ApiKeyNotFoundError);
  });
});

describe('ListApiKeysUseCase', () => {
  let apiKeys: InMemoryApiKeyRepository;
  let useCase: ListApiKeysUseCase;

  beforeEach(async () => {
    apiKeys = new InMemoryApiKeyRepository();
    useCase = new ListApiKeysUseCase(apiKeys);

    await apiKeys.save(buildKey('user-1', 'One'));
    await apiKeys.save(buildKey('user-1', 'Two'));
    await apiKeys.save(buildKey('user-2', 'Three'));
  });

  it('lists only the requester keys by default', async () => {
    const keys = await useCase.execute({ requesterId: 'user-1' });

    expect(keys.map((key) => key.name).sort()).toEqual(['One', 'Two']);
  });

  it('lists the keys of an explicit user', async () => {
    const keys = await useCase.execute({ requesterId: 'user-1', userId: 'user-2' });

    expect(keys.map((key) => key.name)).toEqual(['Three']);
  });

  it('lists every key when all is requested', async () => {
    const keys = await useCase.execute({ requesterId: 'user-1', all: true });

    expect(keys).toHaveLength(3);
  });
});
