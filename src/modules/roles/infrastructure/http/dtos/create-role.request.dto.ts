import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayUnique, IsArray, IsOptional, IsString, MaxLength, MinLength, Matches } from 'class-validator';
import { ROLE_NAME_PATTERN } from '../../../domain/role.entity.js';

/**
 * Inbound DTO for `POST /roles`. Permission keys are validated against the
 * catalog by the domain layer, which returns a detailed error listing any
 * unknown key.
 */
export class CreateRoleRequestDto {
  @ApiProperty({ example: 'support', minLength: 2, maxLength: 40 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  @Matches(ROLE_NAME_PATTERN)
  name: string;

  @ApiProperty({ example: 'First-level support team', maxLength: 200, required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  @ApiProperty({ example: ['users:read', 'users:update'], type: [String] })
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  permissions: string[];
}
