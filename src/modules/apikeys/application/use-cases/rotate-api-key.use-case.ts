import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import type { ApiKey } from '../../domain/api-key.entity.js';
import { generateApiKeySecret } from '../../domain/api-key-secret.js';
import { ApiKeyRepositoryPort } from '../ports/api-key.repository.port.js';
import { GetApiKeyUseCase } from './get-api-key.use-case.js';

export interface RotateApiKeyCommand {
  id: string;
}

export interface RotateApiKeyResult {
  apiKey: ApiKey;
  /** New plain secret: returned exactly once. */
  secret: string;
}

/**
 * Replaces the secret of a key in place. Handy when a secret leaked: the
 * key keeps its identity, name, scopes and expiration, so nothing else in
 * the integrations has to change.
 */
@Injectable()
export class RotateApiKeyUseCase implements UseCase<RotateApiKeyCommand, RotateApiKeyResult> {
  constructor(
    private readonly apiKeys: ApiKeyRepositoryPort,
    private readonly getApiKey: GetApiKeyUseCase,
  ) {}

  async execute({ id }: RotateApiKeyCommand): Promise<RotateApiKeyResult> {
    const apiKey = await this.getApiKey.execute({ id });
    const { plain, prefix, hash } = generateApiKeySecret();

    apiKey.rotateSecret(prefix, hash);
    await this.apiKeys.update(apiKey);

    return { apiKey, secret: plain };
  }
}
