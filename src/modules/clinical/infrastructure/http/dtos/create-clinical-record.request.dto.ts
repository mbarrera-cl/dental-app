import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, ValidateIf } from 'class-validator';
import { CATEGORIAS_ETARIAS } from '../../../domain/categoria-etaria.js';

const trimLower = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

/** Runs only when the field is present; `null` is *not* accepted. */
const whenPresent = (_object: object, value: unknown): boolean =>
  value !== undefined;

/**
 * Inbound DTO to open a ficha. Everything is optional: the use case preselects
 * the age category from the patient's birth date and defaults `embarazada`
 * to false.
 */
export class CreateClinicalRecordRequestDto {
  @ApiPropertyOptional({
    enum: CATEGORIAS_ETARIAS,
    example: '5-9-programado',
    description:
      'Manual override; omitted means the suggested category for the age.',
  })
  @ValidateIf(whenPresent)
  @Transform(trimLower)
  @IsIn(CATEGORIAS_ETARIAS)
  categoria?: string;

  @ApiPropertyOptional({ example: false })
  @ValidateIf(whenPresent)
  @IsBoolean()
  embarazada?: boolean;
}
