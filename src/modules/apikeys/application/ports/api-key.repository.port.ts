import type { ApiKey } from '../../domain/api-key.entity.js';

/**
 * Driven port for API key persistence. Lookups by `keyHash` are the hot
 * path: every `X-Api-Key` request resolves the principal through them.
 */
export abstract class ApiKeyRepositoryPort {
  abstract save(apiKey: ApiKey): Promise<void>;

  abstract update(apiKey: ApiKey): Promise<void>;

  abstract findById(id: string): Promise<ApiKey | null>;

  abstract findByHash(keyHash: string): Promise<ApiKey | null>;

  abstract findAll(): Promise<ApiKey[]>;

  abstract findByUser(userId: string): Promise<ApiKey[]>;

  /** Keys of a user that are neither revoked nor expired. */
  abstract countActiveByUser(userId: string, now: Date): Promise<number>;
}
