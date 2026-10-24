import { ApiProperty } from '@nestjs/swagger';
import type { Page } from '../../../../../shared/application/pagination.js';
import type { Prescription } from '../../../domain/prescription.entity.js';
import { PrescriptionResponseDto } from './prescription.response.dto.js';

/** `GET /patients/:patientId/prescriptions` — one page of the patient's history. */
export class PrescriptionPageResponseDto {
  @ApiProperty({ type: [PrescriptionResponseDto] })
  items: PrescriptionResponseDto[];

  @ApiProperty({ description: 'Total prescriptions of the patient' })
  total: number;

  @ApiProperty({ example: 10 })
  limit: number;

  @ApiProperty({ example: 0 })
  offset: number;

  static fromPage(page: Page<Prescription>): PrescriptionPageResponseDto {
    const dto = new PrescriptionPageResponseDto();
    dto.items = page.items.map((prescription) =>
      PrescriptionResponseDto.fromDomain(prescription),
    );
    dto.total = page.total;
    dto.limit = page.limit;
    dto.offset = page.offset;
    return dto;
  }
}
