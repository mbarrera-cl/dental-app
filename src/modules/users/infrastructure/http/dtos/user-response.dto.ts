import { ApiProperty } from '@nestjs/swagger';
import type { User } from '../../../domain/user.entity.js';

/**
 * Outbound DTO: the HTTP representation of a `User` domain object.
 * The static mapper keeps this translation in one place.
 */
export class UserResponseDto {
  @ApiProperty({ example: 'e0a7f6a4-2c2e-4d63-9c62-8d1f8f8f8f8f' })
  id: string;

  @ApiProperty({ example: 'ada@example.com' })
  email: string;

  @ApiProperty({ example: 'Ada Lovelace' })
  name: string;

  @ApiProperty({ example: '2026-01-01T12:00:00.000Z', format: 'date-time' })
  createdAt: string;

  static fromDomain(user: User): UserResponseDto {
    const dto = new UserResponseDto();
    dto.id = user.id;
    dto.email = user.email;
    dto.name = user.name;
    dto.createdAt = user.createdAt.toISOString();
    return dto;
  }
}
