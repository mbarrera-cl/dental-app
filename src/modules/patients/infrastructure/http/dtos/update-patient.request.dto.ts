import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { SEXOS } from '../../../domain/patient.entity.js';
import { ContactoEmergenciaRequestDto } from './contacto-emergencia.request.dto.js';
import { DireccionRequestDto } from './direccion.request.dto.js';
import { PrevisionRequestDto } from './prevision.request.dto.js';
import { IsRut } from '../validators/is-rut.validator.js';
import { IsTelefono } from '../validators/is-telefono.validator.js';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const trimLower = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

const FECHA_NACIMIENTO_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Runs only when the field is present; `null` is *not* accepted for required fields. */
const whenPresent = (_object: object, value: unknown): boolean =>
  value !== undefined;

/**
 * Inbound DTO for partial updates: every field is optional, but the use case
 * rejects an empty update (`EmptyPatientUpdateError` → 400).
 *
 * The clearing contract: for the optional groups (`email`, `telefono`,
 * `direccion`, `prevision`, `contactoEmergencia`, `notas`) an explicit
 * `null` clears the value, while omitting the field leaves it untouched.
 */
export class UpdatePatientRequestDto {
  @ApiPropertyOptional({ example: '12.345.678-5' })
  @ValidateIf(whenPresent)
  @Transform(trim)
  @IsRut()
  rut?: string;

  @ApiPropertyOptional({ example: 'Camila', minLength: 2, maxLength: 100 })
  @ValidateIf(whenPresent)
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  nombres?: string;

  @ApiPropertyOptional({ example: 'Rojas', minLength: 2, maxLength: 100 })
  @ValidateIf(whenPresent)
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  apellidoPaterno?: string;

  @ApiPropertyOptional({ example: 'Pérez', minLength: 2, maxLength: 100 })
  @ValidateIf(whenPresent)
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  apellidoMaterno?: string;

  @ApiPropertyOptional({ example: '1990-05-17', format: 'date' })
  @ValidateIf(whenPresent)
  @Transform(trim)
  @IsString()
  @Matches(FECHA_NACIMIENTO_PATTERN, {
    message: 'fechaNacimiento must have the format YYYY-MM-DD',
  })
  fechaNacimiento?: string;

  @ApiPropertyOptional({ example: 'femenino', enum: SEXOS })
  @ValidateIf(whenPresent)
  @Transform(trimLower)
  @IsIn(SEXOS)
  sexo?: string;

  @ApiPropertyOptional({
    example: 'camila@example.com',
    maxLength: 254,
    nullable: true,
  })
  @IsOptional()
  @Transform(trim)
  @IsEmail()
  @MaxLength(254)
  email?: string | null;

  @ApiPropertyOptional({ example: '+56912345678', nullable: true })
  @IsOptional()
  @Transform(trim)
  @IsTelefono()
  telefono?: string | null;

  @ApiPropertyOptional({ type: DireccionRequestDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => DireccionRequestDto)
  direccion?: DireccionRequestDto | null;

  @ApiPropertyOptional({ type: PrevisionRequestDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => PrevisionRequestDto)
  prevision?: PrevisionRequestDto | null;

  @ApiPropertyOptional({ type: ContactoEmergenciaRequestDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => ContactoEmergenciaRequestDto)
  contactoEmergencia?: ContactoEmergenciaRequestDto | null;

  @ApiPropertyOptional({
    example: 'Alergia a la penicilina',
    maxLength: 1000,
    nullable: true,
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  notas?: string | null;
}
