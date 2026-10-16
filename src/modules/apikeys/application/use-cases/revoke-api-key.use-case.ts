import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import type { ApiKey } from '../../domain/api-key.entity.js';
import { ApiKeyRepositoryPort } from '../ports/api-key.repository.port.js';
import { GetApiKeyUseCase } from './get-api-key.use-case.js';

export interface RevokeApiKeyCommand {
  id: string;
}

/** Kills a key forever; revoked keys never authenticate again. */
@Injectable()
export class RevokeApiKeyUseCase implements UseCase<RevokeApiKeyCommand, ApiKey> {
  constructor(
    private readonly apiKeys: ApiKeyRepositoryPort,
    private readonly getApiKey: GetApiKeyUseCase,
  ) {}

  async execute({ id }: RevokeApiKeyCommand): Promise<ApiKey> {
    const apiKey = await this.getApiKey.execute({ id });

    apiKey.revoke(new Date());
    await this.apiKeys.update(apiKey);

    return apiKey;
  }
}
