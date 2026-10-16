import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';

/**
 * Inbound DTO for `PUT /users/:id/permissions`: a complete replacement of the
 * direct (non-role) grants. Keys are validated against the catalog by the use
 * case (`PermissionUnknownError` → 400).
 */
export class UpdateUserPermissionsRequestDto {
  @ApiProperty({ type: [String], example: ['users:read', 'dashboard:read'] })
  @IsArray()
  @IsString({ each: true })
  permissions: string[];
}
