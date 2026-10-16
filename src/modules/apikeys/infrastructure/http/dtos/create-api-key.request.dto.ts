import { Type } from 'class-transformer';
import { IsArray, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Inbound DTO of `POST /apikeys`. `scopes: null` (or omitted) inherits the
 * owner's full effective permissions; an array scopes the key down and is
 * validated against the owner's permissions by the use case.
 */
export class CreateApiKeyRequestDto {
  @ApiProperty({ example: 'CI pipeline', minLength: 1, maxLength: 60 })
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name: string;

  @ApiPropertyOptional({
    type: [String],
    nullable: true,
    example: ['dashboard:read'],
    description: 'Permission subset; null inherits every permission of the owner.',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  scopes?: string[] | null;

  @ApiPropertyOptional({ example: 90, minimum: 0, maximum: 3650 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(3650)
  expiresInDays?: number;

  @ApiPropertyOptional({
    description: 'Create the key on behalf of this user (needs `apikeys:manage`).',
  })
  @IsOptional()
  @IsString()
  userId?: string;
}
