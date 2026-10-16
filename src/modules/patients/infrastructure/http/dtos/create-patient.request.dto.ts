import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
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

/**
 * Inbound DTO: describes the HTTP request payload only. It is intentionally
 * a separate class from anything in the domain or application layers — the
 * controller maps it to a use case command. The domain re-validates every
 * rule (RUT check digit, coverage invariants, real calendar dates).
 */
export class CreatePatientRequestDto {
  @ApiProperty({
    example: '12.345.678-5',
    description: 'Chilean RUT; dots and spaces are tolerated.',
  })
  @Transform(trim)
  @IsRut()
  rut: string;

  @ApiProperty({ example: 'Camila', minLength: 2, maxLength: 100 })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  nombres: string;

  @ApiProperty({ example: 'Rojas', minLength: 2, maxLength: 100 })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  apellidoPaterno: string;

  @ApiProperty({ example: 'Pérez', minLength: 2, maxLength: 100 })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  apellidoMaterno: string;

  @ApiProperty({ example: '1990-05-17', format: 'date' })
  @Transform(trim)
  @IsString()
  @Matches(FECHA_NACIMIENTO_PATTERN, {
    message: 'fechaNacimiento must have the format YYYY-MM-DD',
  })
  fechaNacimiento: string;

  @ApiProperty({ example: 'femenino', enum: SEXOS })
  @Transform(trimLower)
  @IsIn(SEXOS)
  sexo: string;

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

  @ApiPropertyOptional({
    example: '+56912345678',
    description: 'Chilean phone; the +56 prefix is added when missing.',
    nullable: true,
  })
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
