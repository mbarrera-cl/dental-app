import { ApiProperty } from '@nestjs/swagger';
import type { Movement } from '../../../domain/movement.entity.js';
import type { PaymentMethod } from '../../../domain/payment-method.js';

/** Outbound DTO of one ledger movement (cargo or abono). */
export class MovementResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: ['cargo', 'abono'] })
  kind: 'cargo' | 'abono';

  @ApiProperty({ example: 4500, description: 'Integer CLP, always > 0' })
  amount: number;

  /** Signs the entry the way the balance reads it: cargos positive, abonos negative. */
  @ApiProperty({ example: 4500 })
  signedAmount: number;

  @ApiProperty({ enum: ['efectivo', 'tarjeta', 'transferencia'], required: false })
  method: PaymentMethod | null;

  @ApiProperty({ required: false, description: 'Card voucher or bank transfer reference' })
  reference: string | null;

  @ApiProperty({ example: 'Resina compuesta pieza 1.6' })
  concept: string;

  @ApiProperty()
  patientId: string;

  @ApiProperty({ required: false })
  quoteId: string | null;

  @ApiProperty({ required: false })
  appointmentId: string | null;

  @ApiProperty({ required: false, description: 'Id of the user who recorded the movement' })
  createdBy: string | null;

  @ApiProperty()
  createdAt: string;

  @ApiProperty({ required: false, description: 'Set when the movement has been voided' })
  voidedAt: string | null;

  @ApiProperty({ required: false, description: 'Id of the user who voided the movement' })
  voidedBy: string | null;

  @ApiProperty({ required: false })
  voidReason: string | null;

  static fromDomain(movement: Movement): MovementResponseDto {
    const dto = new MovementResponseDto();
    dto.id = movement.id;
    dto.kind = movement.kind;
    dto.amount = movement.amount;
    dto.signedAmount = movement.signedAmount;
    dto.method = movement.method;
    dto.reference = movement.reference;
    dto.concept = movement.concept;
    dto.patientId = movement.patientId;
    dto.quoteId = movement.quoteId;
    dto.appointmentId = movement.appointmentId;
    dto.createdBy = movement.createdBy;
    dto.createdAt = movement.createdAt.toISOString();
    dto.voidedAt = movement.voidedAt === null ? null : movement.voidedAt.toISOString();
    dto.voidedBy = movement.voidedBy;
    dto.voidReason = movement.voidReason;
    return dto;
  }
}
