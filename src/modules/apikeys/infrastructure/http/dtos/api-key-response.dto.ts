import { ApiProperty } from '@nestjs/swagger';
import type { ApiKey } from '../../../domain/api-key.entity.js';

/** Outbound representation of an API key: never includes the secret. */
export class ApiKeyResponseDto {
  @ApiProperty({ example: 'b7e6f0c2-9c3f-4a5b-8f6d-1c2b3a4d5e6f' })
  id: string;

  @ApiProperty({ description: 'Owner of the key.' })
  userId: string;

  @ApiProperty({ example: 'CI pipeline' })
  name: string;

  @ApiProperty({ example: 'hexa_ab12cd34' })
  prefix: string;

  @ApiProperty({
    type: [String],
    nullable: true,
    example: ['dashboard:read'],
    description: 'null = every effective permission of the owner.',
  })
  scopes: string[] | null;

  @ApiProperty({ format: 'date-time', nullable: true, example: '2027-01-01T00:00:00.000Z' })
  expiresAt: string | null;

  @ApiProperty({ format: 'date-time', nullable: true })
  lastUsedAt: string | null;

  @ApiProperty({ format: 'date-time', nullable: true })
  revokedAt: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  static fromDomain(apiKey: ApiKey): ApiKeyResponseDto {
    const dto = new ApiKeyResponseDto();
    dto.id = apiKey.id;
    dto.userId = apiKey.userId;
    dto.name = apiKey.name;
    dto.prefix = apiKey.prefix;
    dto.scopes = apiKey.scopes === null ? null : [...apiKey.scopes];
    dto.expiresAt = apiKey.expiresAt === null ? null : apiKey.expiresAt.toISOString();
    dto.lastUsedAt = apiKey.lastUsedAt === null ? null : apiKey.lastUsedAt.toISOString();
    dto.revokedAt = apiKey.revokedAt === null ? null : apiKey.revokedAt.toISOString();
    dto.createdAt = apiKey.createdAt.toISOString();

    return dto;
  }
}
