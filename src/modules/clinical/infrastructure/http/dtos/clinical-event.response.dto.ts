import { ApiProperty } from '@nestjs/swagger';
import {
  CLINICAL_EVENT_ACTIONS,
  type ClinicalEvent,
} from '../../../domain/clinical-event.entity.js';

export class ClinicalEventResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  patientId: string;

  @ApiProperty()
  recordId: string;

  @ApiProperty({ type: String, nullable: true })
  actorId: string | null;

  @ApiProperty({ enum: CLINICAL_EVENT_ACTIONS, example: 'hallazgo-agregado' })
  action: string;

  @ApiProperty({ type: String, nullable: true })
  summary: string | null;

  @ApiProperty({ type: Object, nullable: true })
  payload: Record<string, unknown> | null;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  static fromDomain(event: ClinicalEvent): ClinicalEventResponseDto {
    const dto = new ClinicalEventResponseDto();

    dto.id = event.id;
    dto.patientId = event.patientId;
    dto.recordId = event.recordId;
    dto.actorId = event.actorId;
    dto.action = event.action;
    dto.summary = event.summary;
    dto.payload = event.payload;
    dto.createdAt = event.createdAt.toISOString();

    return dto;
  }
}
