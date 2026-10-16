import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { IsTelefono } from '../validators/is-telefono.validator.js';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** Nested request DTO for the emergency contact group. */
export class ContactoEmergenciaRequestDto {
  @ApiProperty({ example: 'María Pérez', minLength: 2, maxLength: 100 })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  nombre: string;

  @ApiProperty({
    example: '+56987654321',
    description: 'Chilean phone; +56 added if missing.',
  })
  @Transform(trim)
  @IsTelefono()
  telefono: string;

  @ApiPropertyOptional({ example: 'Madre', maxLength: 50, nullable: true })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(50)
  parentesco?: string | null;
}
