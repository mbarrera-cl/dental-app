import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { CATEGORIAS_ETARIAS } from '../../../domain/categoria-etaria.js';
import type { AntecedentesInput } from '../../../domain/antecedentes.vo.js';
import type { HigieneOralInput } from '../../../domain/higiene-oral.vo.js';
import {
  ENFERMEDAD_PERIODONTAL,
  GRADOS_FLUOROSIS,
  MALOCLUSIONES,
} from '../../../domain/indicadores.vo.js';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const trimLower = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

/** Runs only when the field is present; `null` is *not* accepted. */
const whenPresent = (_object: object, value: unknown): boolean =>
  value !== undefined;

/**
 * Vital signs payload. Every value is optional and `null` clears it, so the
 * measurement can be filled in later.
 */
export class SignosVitalesRequestDto {
  @ApiPropertyOptional({ example: 120, minimum: 40, maximum: 300, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(40)
  @Max(300)
  presionArterialSistolica?: number | null;

  @ApiPropertyOptional({ example: 80, minimum: 20, maximum: 200, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(20)
  @Max(200)
  presionArterialDiastolica?: number | null;

  @ApiPropertyOptional({ example: 72, minimum: 20, maximum: 250, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(20)
  @Max(250)
  frecuenciaCardiaca?: number | null;

  @ApiPropertyOptional({ example: 36.5, minimum: 30, maximum: 45, nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(30)
  @Max(45)
  temperatura?: number | null;

  @ApiPropertyOptional({ example: 16, minimum: 4, maximum: 80, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(4)
  @Max(80)
  frecuenciaRespiratoria?: number | null;
}

/**
 * Stomatognathic exam payload: the per-region verdicts travel as a plain
 * object (the twelve keys are validated in the domain) plus the description.
 */
export class ExamenEstomatognaticoRequestDto {
  @ApiPropertyOptional({
    type: Object,
    example: { labios: 'normal', mejillas: 'alterado' },
    description: 'Region → normal | alterado | null (not explored).',
  })
  @IsOptional()
  @IsObject()
  regiones?: Record<string, string | null>;

  @ApiPropertyOptional({
    example: '2 (mejillas): leve descamación',
    nullable: true,
    maxLength: 2000,
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  descripcion?: string | null;
}

/**
 * Oral health indicators payload: the hygiene table travels as a plain
 * object keyed by index tooth (validated in the domain); the three verdicts
 * are enums with `null` meaning "not assessed".
 */
export class IndicadoresRequestDto {
  @ApiPropertyOptional({
    type: Object,
    example: { '16': { placa: 1, calculo: 0, gingivitis: 0 } },
    description: 'Index tooth → { placa 0–3, calculo 0–3, gingivitis 0–1 }.',
  })
  @IsOptional()
  @IsObject()
  higieneOral?: HigieneOralInput;

  @ApiPropertyOptional({ enum: ENFERMEDAD_PERIODONTAL, nullable: true })
  @IsOptional()
  @IsIn(ENFERMEDAD_PERIODONTAL)
  enfermedadPeriodontal?: string | null;

  @ApiPropertyOptional({ enum: MALOCLUSIONES, nullable: true })
  @IsOptional()
  @IsIn(MALOCLUSIONES)
  maloclusion?: string | null;

  @ApiPropertyOptional({ enum: GRADOS_FLUOROSIS, nullable: true })
  @IsOptional()
  @IsIn(GRADOS_FLUOROSIS)
  fluorosis?: string | null;
}

/**
 * Inbound DTO for partial updates of the ficha. `undefined` leaves a section
 * untouched; `null` clears the nullable ones (composite sections are replaced
 * as a whole, which matches what the form sends).
 */
export class UpdateClinicalRecordRequestDto {
  @ApiPropertyOptional({ enum: CATEGORIAS_ETARIAS, example: '15-19' })
  @ValidateIf(whenPresent)
  @Transform(trimLower)
  @IsIn(CATEGORIAS_ETARIAS)
  categoria?: string;

  @ApiPropertyOptional({ example: false })
  @ValidateIf(whenPresent)
  @IsBoolean()
  embarazada?: boolean;

  @ApiPropertyOptional({ nullable: true, maxLength: 1000 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  motivoConsulta?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 4000 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(4000)
  enfermedadActual?: string | null;

  @ApiPropertyOptional({
    type: Object,
    nullable: true,
    example: { asma: { present: true, notes: 'Inhalador a mano' } },
    description: 'Item → { present, notes }; replaces the whole section.',
  })
  @IsOptional()
  @IsObject()
  antecedentes?: AntecedentesInput | null;

  @ApiPropertyOptional({ type: SignosVitalesRequestDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => SignosVitalesRequestDto)
  signosVitales?: SignosVitalesRequestDto | null;

  @ApiPropertyOptional({ type: ExamenEstomatognaticoRequestDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => ExamenEstomatognaticoRequestDto)
  examenEstomatognatico?: ExamenEstomatognaticoRequestDto | null;

  @ApiPropertyOptional({ type: IndicadoresRequestDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => IndicadoresRequestDto)
  indicadores?: IndicadoresRequestDto | null;
}
