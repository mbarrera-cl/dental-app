import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayUnique, IsArray, IsOptional, IsString, MaxLength, MinLength, Matches } from 'class-validator';
import { ROLE_NAME_PATTERN } from '../../../domain/role.entity.js';

/** Inbound DTO for `PATCH /roles/:id`; every field is optional. */
export class UpdateRoleRequestDto {
  @ApiProperty({ example: 'support-l2', minLength: 2, maxLength: 40, required: false })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  @Matches(ROLE_NAME_PATTERN)
  name?: string;

  @ApiProperty({ example: 'Second-level support team', maxLength: 200, required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  @ApiProperty({ example: ['users:read'], type: [String], required: false })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  permissions?: string[];
}
