import { ApiProperty } from '@nestjs/swagger';
import {
  TREATMENT_PLAN_ITEM_STATUSES,
  type TreatmentPlanItem,
} from '../../../domain/treatment-plan.entity.js';

export class TreatmentPlanItemResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  planId: string;

  @ApiProperty({ type: Number, nullable: true, example: 36 })
  tooth: number | null;

  @ApiProperty({ example: 'Endodoncia pieza 36' })
  procedure: string;

  @ApiProperty({ type: String, nullable: true })
  ucoCode: string | null;

  @ApiProperty({ enum: TREATMENT_PLAN_ITEM_STATUSES, example: 'planificado' })
  status: string;

  @ApiProperty({ type: String, nullable: true })
  notes: string | null;

  @ApiProperty({ example: 0 })
  position: number;

  @ApiProperty({ type: String, nullable: true })
  createdBy: string | null;

  @ApiProperty({ type: String, nullable: true })
  updatedBy: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt: string;

  @ApiProperty({ type: String, nullable: true, format: 'date-time' })
  statusChangedAt: string | null;

  @ApiProperty({ type: String, nullable: true })
  statusChangedBy: string | null;

  static fromDomain(item: TreatmentPlanItem): TreatmentPlanItemResponseDto {
    const dto = new TreatmentPlanItemResponseDto();

    dto.id = item.id;
    dto.planId = item.planId;
    dto.tooth = item.tooth;
    dto.procedure = item.procedure;
    dto.ucoCode = item.ucoCode;
    dto.status = item.status;
    dto.notes = item.notes;
    dto.position = item.position;
    dto.createdBy = item.createdBy;
    dto.updatedBy = item.updatedBy;
    dto.createdAt = item.createdAt.toISOString();
    dto.updatedAt = item.updatedAt.toISOString();
    dto.statusChangedAt = item.statusChangedAt?.toISOString() ?? null;
    dto.statusChangedBy = item.statusChangedBy;

    return dto;
  }
}
