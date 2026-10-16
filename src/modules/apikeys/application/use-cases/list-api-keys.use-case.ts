import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import type { ApiKey } from '../../domain/api-key.entity.js';
import { ApiKeyRepositoryPort } from '../ports/api-key.repository.port.js';

export interface ListApiKeysCommand {
  /** Caller of the request; used when no explicit target is given. */
  requesterId: string;
  /** Keys of another user (needs `apikeys:read`; checked by the controller). */
  userId?: string;
  /** Every key of every user (needs `apikeys:read`; checked by the controller). */
  all?: boolean;
}

@Injectable()
export class ListApiKeysUseCase implements UseCase<ListApiKeysCommand, ApiKey[]> {
  constructor(private readonly apiKeys: ApiKeyRepositoryPort) {}

  async execute({ requesterId, userId, all }: ListApiKeysCommand): Promise<ApiKey[]> {
    if (all === true) {
      return this.apiKeys.findAll();
    }

    return this.apiKeys.findByUser(userId ?? requesterId);
  }
}
