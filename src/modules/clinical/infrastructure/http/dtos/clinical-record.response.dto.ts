import { ApiProperty } from '@nestjs/swagger';
import type { AntecedentesRecord } from '../../../domain/antecedentes.vo.js';
import { CATEGORIAS_ETARIAS } from '../../../domain/categoria-etaria.js';
import type { RegionesRecord } from '../../../domain/examen-estomatognatico.vo.js';
import {
  CLINICAL_RECORD_STATUSES,
  type FichaClinica,
} from '../../../domain/ficha-clinica.entity.js';
import type { IndicadoresSaludBucalJSON } from '../../../domain/indicadores.vo.js';
import type { SignosVitalesProps } from '../../../domain/signos-vitales.vo.js';

/**
 * Outbound DTO: the HTTP representation of a ficha. The static mapper keeps
 * the translation in one place — composite value objects serialize through
 * their own `toJSON`.
 */
export class ClinicalRecordResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  patientId: string;

  @ApiProperty({ enum: CATEGORIAS_ETARIAS, example: '5-9-programado' })
  categoria: string;

  @ApiProperty({ example: false })
  embarazada: boolean;

  @ApiProperty({ enum: CLINICAL_RECORD_STATUSES, example: 'borrador' })
  status: string;

  @ApiProperty({ type: String, nullable: true, example: 'Dolor en pieza 16' })
  motivoConsulta: string | null;

  @ApiProperty({ type: String, nullable: true })
  enfermedadActual: string | null;

  @ApiProperty({
    type: Object,
    description: 'Item → { present, notes }',
  })
  antecedentes: AntecedentesRecord;

  @ApiProperty({ type: Object })
  signosVitales: SignosVitalesProps;

  @ApiProperty({
    type: Object,
    description: '{ regiones: region → normal|alterado|null, descripcion }',
  })
  examenEstomatognatico: {
    regiones: RegionesRecord;
    descripcion: string | null;
  };

  @ApiProperty({
    type: Object,
    description: 'Higiene oral simplificada + periodontal, maloclusión y fluorosis.',
  })
  indicadores: IndicadoresSaludBucalJSON;

  @ApiProperty({ type: String, nullable: true })
  createdBy: string | null;

  @ApiProperty({ type: String, nullable: true })
  updatedBy: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt: string;

  @ApiProperty({ type: String, nullable: true, format: 'date-time' })
  finalizedAt: string | null;

  @ApiProperty({ type: String, nullable: true })
  finalizedBy: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'SHA-256 integrity seal (set on finalize)' })
  integrityHash: string | null;

  static fromDomain(record: FichaClinica): ClinicalRecordResponseDto {
    const dto = new ClinicalRecordResponseDto();

    dto.id = record.id;
    dto.patientId = record.patientId;
    dto.categoria = record.categoria;
    dto.embarazada = record.embarazada;
    dto.status = record.status;
    dto.motivoConsulta = record.motivoConsulta;
    dto.enfermedadActual = record.enfermedadActual;
    dto.antecedentes = { ...record.antecedentes.toJSON() };
    dto.signosVitales = record.signosVitales.toJSON();
    dto.examenEstomatognatico = record.examenEstomatognatico.toJSON();
    dto.indicadores = record.indicadores.toJSON();
    dto.createdBy = record.createdBy;
    dto.updatedBy = record.updatedBy;
    dto.createdAt = record.createdAt.toISOString();
    dto.updatedAt = record.updatedAt.toISOString();
    dto.finalizedAt = record.finalizedAt?.toISOString() ?? null;
    dto.finalizedBy = record.finalizedBy;
    dto.integrityHash = record.integrityHash;

    return dto;
  }
}
