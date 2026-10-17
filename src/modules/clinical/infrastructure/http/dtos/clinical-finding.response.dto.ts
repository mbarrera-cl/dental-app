import { ApiProperty } from '@nestjs/swagger';
import {
  FINDING_STATES,
  FINDING_SYMBOLS,
  SURFACES,
  type Finding,
} from '../../../domain/finding.entity.js';

export class ClinicalFindingResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  recordId: string;

  @ApiProperty({ example: 16 })
  tooth: number;

  @ApiProperty({
    enum: SURFACES,
    isArray: true,
    example: ['O'],
    description: 'Empty array means "the whole tooth".',
  })
  surfaces: readonly string[];

  @ApiProperty({ enum: FINDING_SYMBOLS, example: 'caries' })
  symbol: string;

  @ApiProperty({
    enum: FINDING_STATES,
    example: 'a-realizar',
    description: 'Colors: a-realizar (red) means pending, realizado (blue) means done.',
  })
  state: string;

  @ApiProperty({ type: Number, nullable: true, example: 2 })
  recesion: number | null;

  @ApiProperty({ type: Number, nullable: true, example: 1 })
  movilidad: number | null;

  @ApiProperty({ type: String, nullable: true })
  note: string | null;

  @ApiProperty({ type: String, nullable: true })
  createdBy: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({ type: String, nullable: true, format: 'date-time' })
  voidedAt: string | null;

  @ApiProperty({ type: String, nullable: true })
  voidedBy: string | null;

  @ApiProperty({ example: false })
  isVoided: boolean;

  static fromDomain(finding: Finding): ClinicalFindingResponseDto {
    const dto = new ClinicalFindingResponseDto();

    dto.id = finding.id;
    dto.recordId = finding.recordId;
    dto.tooth = finding.tooth;
    dto.surfaces = finding.surfaces;
    dto.symbol = finding.symbol;
    dto.state = finding.state;
    dto.recesion = finding.recesion;
    dto.movilidad = finding.movilidad;
    dto.note = finding.note;
    dto.createdBy = finding.createdBy;
    dto.createdAt = finding.createdAt.toISOString();
    dto.voidedAt = finding.voidedAt?.toISOString() ?? null;
    dto.voidedBy = finding.voidedBy;
    dto.isVoided = finding.isVoided;

    return dto;
  }
}
