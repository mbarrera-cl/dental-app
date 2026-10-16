import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsArray, IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Inbound DTO: describes the HTTP request payload only. It is intentionally
 * a separate class from anything in the domain or application layers — the
 * controller maps it to a use case command.
 */
export class CreateUserRequestDto {
  @ApiProperty({ example: 'ada@example.com', maxLength: 254 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({ example: 'Ada Lovelace', minLength: 2, maxLength: 100 })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({
    example: 'Str0ng-Passw0rd!',
    description: 'Optional initial password; the configurable policy applies.',
  })
  @IsOptional()
  @IsString()
  password?: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['6f1c1c6e-9d3b-4a7c-8f10-4b9c2a1f6e42'],
    description: 'Role ids to assign to the new user.',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roles?: string[];

  @ApiPropertyOptional({ enum: ['active', 'disabled'], default: 'active' })
  @IsOptional()
  @IsIn(['active', 'disabled'])
  status?: 'active' | 'disabled';
}
