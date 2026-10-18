import { ApiProperty } from '@nestjs/swagger';
import type { TreatmentPlanView } from '../../../application/use-cases/get-treatment-plan.use-case.js';
import { TreatmentPlanItemResponseDto } from './treatment-plan-item.response.dto.js';

export class TreatmentPlanResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  recordId: string;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt: string;

  @ApiProperty({ type: [TreatmentPlanItemResponseDto] })
  items: TreatmentPlanItemResponseDto[];

  static fromDomain(view: TreatmentPlanView): TreatmentPlanResponseDto {
    const dto = new TreatmentPlanResponseDto();

    dto.id = view.plan.id;
    dto.recordId = view.plan.recordId;
    dto.createdAt = view.plan.createdAt.toISOString();
    dto.updatedAt = view.plan.updatedAt.toISOString();
    dto.items = view.items.map((item) =>
      TreatmentPlanItemResponseDto.fromDomain(item),
    );

    return dto;
  }
}
