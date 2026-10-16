import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { REGION_CODES } from '../../../domain/region.js';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const trimUpper = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

/**
 * Nested request DTO for the address group. The region is one of the 16
 * official codes; the comuna stays free text.
 */
export class DireccionRequestDto {
  @ApiProperty({ example: 'RM', enum: REGION_CODES })
  @Transform(trimUpper)
  @IsIn(REGION_CODES)
  region: string;

  @ApiProperty({ example: 'Providencia', minLength: 2, maxLength: 100 })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  comuna: string;

  @ApiProperty({ example: 'Av. Providencia', minLength: 2, maxLength: 150 })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  calle: string;

  @ApiProperty({ example: '1234', minLength: 1, maxLength: 20 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  numero: string;

  @ApiPropertyOptional({ example: 'Depto 51', maxLength: 50, nullable: true })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(50)
  departamento?: string | null;
}
