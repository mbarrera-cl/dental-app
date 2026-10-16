import { ApiProperty } from '@nestjs/swagger';
import type { ApiKey } from '../../../domain/api-key.entity.js';
import { ApiKeyResponseDto } from './api-key-response.dto.js';

/**
 * Response of create/rotate. `key` is the plain secret and appears exactly
 * once ever: only the SHA-256 of it reaches the database.
 */
export class CreatedApiKeyResponseDto extends ApiKeyResponseDto {
  @ApiProperty({ example: 'hexa_ab12cd34_9xK2...' })
  key: string;

  static fromDomainWithSecret(apiKey: ApiKey, secret: string): CreatedApiKeyResponseDto {
    const dto = new CreatedApiKeyResponseDto();

    Object.assign(dto, ApiKeyResponseDto.fromDomain(apiKey));
    dto.key = secret;

    return dto;
  }
}
