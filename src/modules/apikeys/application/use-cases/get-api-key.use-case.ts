import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import type { ApiKey } from '../../domain/api-key.entity.js';
import { ApiKeyNotFoundError } from '../../domain/api-key.errors.js';
import { ApiKeyRepositoryPort } from '../ports/api-key.repository.port.js';

export interface GetApiKeyCommand {
  id: string;
}

/**
 * Loads one key. Used by the controller to authorize per-key operations
 * (own key vs `apikeys:manage`) *before* mutating anything.
 */
@Injectable()
export class GetApiKeyUseCase implements UseCase<GetApiKeyCommand, ApiKey> {
  constructor(private readonly apiKeys: ApiKeyRepositoryPort) {}

  async execute({ id }: GetApiKeyCommand): Promise<ApiKey> {
    const apiKey = await this.apiKeys.findById(id);

    if (apiKey === null) {
      throw new ApiKeyNotFoundError(id);
    }

    return apiKey;
  }
}
