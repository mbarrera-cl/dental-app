import { Injectable } from '@nestjs/common';
import { ApiKeyRepositoryPort } from '../../../application/ports/api-key.repository.port.js';
import { ApiKey } from '../../../domain/api-key.entity.js';
import { ApiKeyNotFoundError } from '../../../domain/api-key.errors.js';

/**
 * In-memory double of the API key repository, used by unit tests and handy
 * for demos without a database.
 */
@Injectable()
export class InMemoryApiKeyRepository extends ApiKeyRepositoryPort {
  private readonly keys = new Map<string, ApiKey>();

  async save(apiKey: ApiKey): Promise<void> {
    this.keys.set(apiKey.id, apiKey);
  }

  async update(apiKey: ApiKey): Promise<void> {
    if (!this.keys.has(apiKey.id)) {
      throw new ApiKeyNotFoundError(apiKey.id);
    }

    this.keys.set(apiKey.id, apiKey);
  }

  async findById(id: string): Promise<ApiKey | null> {
    return this.keys.get(id) ?? null;
  }

  async findByHash(keyHash: string): Promise<ApiKey | null> {
    for (const apiKey of this.keys.values()) {
      if (apiKey.keyHash === keyHash) {
        return apiKey;
      }
    }

    return null;
  }

  async findAll(): Promise<ApiKey[]> {
    return [...this.keys.values()];
  }

  async findByUser(userId: string): Promise<ApiKey[]> {
    return [...this.keys.values()].filter((apiKey) => apiKey.userId === userId);
  }

  async countActiveByUser(userId: string, now: Date): Promise<number> {
    return [...this.keys.values()].filter(
      (apiKey) => apiKey.userId === userId && apiKey.isUsable(now),
    ).length;
  }
}
