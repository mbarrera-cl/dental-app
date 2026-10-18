import { ApiProperty } from '@nestjs/swagger';
import type { ConsentRecord } from '../../../domain/consent-record.entity.js';

export class ConsentRecordResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  patientId: string;

  @ApiProperty({ example: 'Camila Rojas Pérez' })
  patientName: string;

  @ApiProperty({ example: '12345678-5' })
  patientRut: string;

  @ApiProperty({ required: false, nullable: true })
  templateId: string | null;

  @ApiProperty({ example: 'extraccion' })
  templateKey: string;

  @ApiProperty({ example: 1 })
  templateVersion: number;

  @ApiProperty({ example: 'Consentimiento informado: extracción dental' })
  title: string;

  @ApiProperty()
  body: string;

  @ApiProperty({ required: false, nullable: true })
  procedure: string | null;

  @ApiProperty({ example: 'Camila Rojas Pérez' })
  acceptorName: string;

  @ApiProperty({ example: '2026-10-17T12:00:00.000Z' })
  acceptedAt: string;

  @ApiProperty({ required: false, nullable: true })
  recordedBy: string | null;

  @ApiProperty({ example: '2026-10-17T12:00:00.000Z' })
  createdAt: string;

  static fromDomain(record: ConsentRecord): ConsentRecordResponseDto {
    const dto = new ConsentRecordResponseDto();
    dto.id = record.id;
    dto.patientId = record.patientId;
    dto.patientName = record.patientName;
    dto.patientRut = record.patientRut;
    dto.templateId = record.templateId;
    dto.templateKey = record.templateKey;
    dto.templateVersion = record.templateVersion;
    dto.title = record.title;
    dto.body = record.body;
    dto.procedure = record.procedure;
    dto.acceptorName = record.acceptorName;
    dto.acceptedAt = record.acceptedAt.toISOString();
    dto.recordedBy = record.recordedBy;
    dto.createdAt = record.createdAt.toISOString();
    return dto;
  }
}
