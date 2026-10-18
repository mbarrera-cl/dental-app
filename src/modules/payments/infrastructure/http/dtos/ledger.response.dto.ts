import { ApiProperty } from '@nestjs/swagger';
import type { PaymentMethod } from '../../../domain/payment-method.js';
import { MovementResponseDto } from './movement.response.dto.js';

/** `GET /patients/:patientId/ledger` — history plus the computed balance. */
export class LedgerResponseDto {
  /** `sum(non-voided cargos) − sum(non-voided abonos)`, integer CLP. */
  @ApiProperty()
  balance: number;

  @ApiProperty({ type: [MovementResponseDto] })
  movements: MovementResponseDto[];

  static fromDomain(balance: number, movements: MovementResponseDto[]): LedgerResponseDto {
    const dto = new LedgerResponseDto();
    dto.balance = balance;
    dto.movements = movements;
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

