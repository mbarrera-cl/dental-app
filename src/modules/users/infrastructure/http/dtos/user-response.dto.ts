import { ApiProperty } from '@nestjs/swagger';
import type { RoleRef } from '../../../../../shared/security/principal.js';
import type { User } from '../../../domain/user.entity.js';

/** Access data of a user, as resolved by the RBAC reader. */
export interface UserAccessSummary {
  roles: readonly RoleRef[];
  directPermissions: readonly string[];
}

/**
 * Outbound DTO: the HTTP representation of a `User` domain object plus its
 * access summary (roles and direct permissions). The static mapper keeps this
 * translation in one place.
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

  @ApiProperty({ enum: ['active', 'disabled'] })
  status: 'active' | 'disabled';

  @ApiProperty({
    type: [Object],
    description: 'Roles granted to the user (id and name).',
  })
  roles: RoleRef[];

  @ApiProperty({
    type: [String],
    example: ['dashboard:read'],
    description: 'Permissions granted directly, outside of any role.',
  })
  directPermissions: string[];

  @ApiProperty({ example: '2026-10-01T08:30:00.000Z', format: 'date-time', nullable: true })
  lastLoginAt: string | null;

  @ApiProperty({
    example: false,
    description: 'An admin reset the password and the user must pick a new one.',
  })
  mustChangePassword: boolean;

  static fromDomain(user: User, access: UserAccessSummary | null = null): UserResponseDto {
    const dto = new UserResponseDto();
    dto.id = user.id;
    dto.email = user.email;
    dto.name = user.name;
    dto.createdAt = user.createdAt.toISOString();
    dto.status = user.status;
    dto.roles = access === null ? [] : access.roles.map((role) => ({ ...role }));
    dto.directPermissions = access === null ? [] : [...access.directPermissions];
    dto.lastLoginAt = user.lastLoginAt === null ? null : user.lastLoginAt.toISOString();
    dto.mustChangePassword = user.mustChangePassword;
    return dto;
  }
}
