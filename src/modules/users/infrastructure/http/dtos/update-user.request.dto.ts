import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsArray, IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Inbound DTO for partial updates: every field is optional, but the use case
 * rejects an empty update (`EmptyUserUpdateError` → 400).
 */
export class UpdateUserRequestDto {
  @ApiPropertyOptional({ example: 'Ada King', minLength: 2, maxLength: 100 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: 'ada.king@example.com', maxLength: 254 })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Complete replacement of the assigned roles.',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roles?: string[];

  @ApiPropertyOptional({ enum: ['active', 'disabled'] })
  @IsOptional()
  @IsIn(['active', 'disabled'])
  status?: 'active' | 'disabled';
}
