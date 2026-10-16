import { ApiProperty } from '@nestjs/swagger';
import type { RoleWithUsage } from '../../../application/ports/role-repository.port.js';

/**
 * Outbound DTO: the HTTP representation of a role plus how many users hold
 * it (the panel uses the count for its deletion guard messaging).
 */
export class RoleResponseDto {
  @ApiProperty({ example: 'e0a7f6a4-2c2e-4d63-9c62-8d1f8f8f8f8f' })
  id: string;

  @ApiProperty({ example: 'support' })
  name: string;

  @ApiProperty({ example: 'First-level support team' })
  description: string;

  @ApiProperty({ example: ['users:read', 'users:update'], type: [String] })
  permissions: string[];

  @ApiProperty({ example: false, description: 'Built-in roles are protected from rename/delete.' })
  builtIn: boolean;

  @ApiProperty({ example: 3, description: 'Number of users the role is assigned to.' })
  userCount: number;

  @ApiProperty({ example: '2026-01-01T12:00:00.000Z', format: 'date-time' })
  createdAt: string;

  @ApiProperty({ example: '2026-01-01T12:00:00.000Z', format: 'date-time' })
  updatedAt: string;

  static fromDomain({ role, userCount }: RoleWithUsage): RoleResponseDto {
    const dto = new RoleResponseDto();
    dto.id = role.id;
    dto.name = role.name;
    dto.description = role.description;
    dto.permissions = [...role.permissions];
    dto.builtIn = role.builtIn;
    dto.userCount = userCount;
    dto.createdAt = role.createdAt.toISOString();
    dto.updatedAt = role.updatedAt.toISOString();
    return dto;
  }
}
