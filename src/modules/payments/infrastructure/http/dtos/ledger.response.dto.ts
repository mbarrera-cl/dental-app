import { ApiProperty } from '@nestjs/swagger';
import type { Page } from '../../../../../shared/application/pagination.js';
import type { PaymentMethod } from '../../../domain/payment-method.js';
import type { Movement } from '../../../domain/movement.entity.js';
import { MovementResponseDto } from './movement.response.dto.js';

/** `GET /patients/:patientId/ledger` — history plus the computed balance. */
export class LedgerResponseDto {
  /** `sum(non-voided cargos) − sum(non-voided abonos)`, integer CLP. */
  @ApiProperty()
  balance: number;

  @ApiProperty({ type: [MovementResponseDto] })
  movements: MovementResponseDto[];

  /** Every movement of the book, across pages. */
  @ApiProperty({ description: 'Total movements of the patient' })
  total: number;

  @ApiProperty({ example: 10 })
  limit: number;

  @ApiProperty({ example: 0 })
  offset: number;

  static fromDomain(balance: number, page: Page<Movement>): LedgerResponseDto {
    const dto = new LedgerResponseDto();
    dto.balance = balance;
    dto.movements = page.items.map((movement) => MovementResponseDto.fromDomain(movement));
    dto.total = page.total;
    dto.limit = page.limit;
    dto.offset = page.offset;
    return dto;
  }
}

/** One line of the cash summary: total of payments per method. */
export class CashSummaryEntryDto {
  @ApiProperty({ enum: ['efectivo', 'tarjeta', 'transferencia'] })
  method: PaymentMethod;

  @ApiProperty({ description: 'Integer CLP, non-voided payments only' })
  total: number;
}
