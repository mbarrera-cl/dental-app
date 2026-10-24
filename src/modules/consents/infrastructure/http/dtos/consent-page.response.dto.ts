import { ApiProperty } from '@nestjs/swagger';
import type { Page } from '../../../../../shared/application/pagination.js';
import type { ConsentRecord } from '../../../domain/consent-record.entity.js';
import { ConsentRecordResponseDto } from './consent-record.response.dto.js';

/** `GET /patients/:patientId/consents` — one page of the patient's consents. */
export class ConsentPageResponseDto {
  @ApiProperty({ type: [ConsentRecordResponseDto] })
  items: ConsentRecordResponseDto[];

  @ApiProperty({ description: 'Total consents accepted by the patient' })
  total: number;

  @ApiProperty({ example: 10 })
  limit: number;

  @ApiProperty({ example: 0 })
  offset: number;

  static fromPage(page: Page<ConsentRecord>): ConsentPageResponseDto {
    const dto = new ConsentPageResponseDto();
    dto.items = page.items.map((record) => ConsentRecordResponseDto.fromDomain(record));
    dto.total = page.total;
    dto.limit = page.limit;
    dto.offset = page.offset;
    return dto;
  }
}
