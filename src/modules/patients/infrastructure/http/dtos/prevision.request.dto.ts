import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  FONASA_TRAMOS,
  PREVISION_TIPOS,
} from '../../../domain/prevision.vo.js';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const trimUpper = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

/**
 * Nested request DTO for the health coverage group. The crossed invariants
 * (FONASA ↔ tramo, ISAPRE ↔ plan) are enforced by the `Prevision` value
 * object, so both are validated here only field-by-field.
 */
export class PrevisionRequestDto {
  @ApiProperty({ example: 'FONASA', enum: PREVISION_TIPOS })
  @Transform(trimUpper)
  @IsIn(PREVISION_TIPOS)
  tipo: string;

  @ApiPropertyOptional({ example: 'B', enum: FONASA_TRAMOS, nullable: true })
  @IsOptional()
  @Transform(trimUpper)
  @IsIn(FONASA_TRAMOS)
  tramo?: string | null;

  @ApiPropertyOptional({
    example: 'Consalud Plus',
    maxLength: 100,
    nullable: true,
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  plan?: string | null;
}
