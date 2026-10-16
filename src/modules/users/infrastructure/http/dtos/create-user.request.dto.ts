import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

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
}
