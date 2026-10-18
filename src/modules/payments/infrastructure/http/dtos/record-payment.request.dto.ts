import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { MAX_REFERENCE_LENGTH } from '../../../domain/movement.entity.js';
import { PAYMENT_METHODS } from '../../../domain/payment-method.js';

/** `POST /patients/:patientId/ledger/payments` — money received (abono). */
export class RecordPaymentRequestDto {
  /** Integer CLP, > 0. */
  @IsInt()
  @Min(1)
  @Max(1_000_000_000)
  amount: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  concept: string;

  @IsIn(PAYMENT_METHODS)
  method: (typeof PAYMENT_METHODS)[number];

  /** Card voucher or bank transfer reference — key to reconcile the payment. */
  @IsOptional()
  @IsString()
  @MaxLength(MAX_REFERENCE_LENGTH)
  reference?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  quoteId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  appointmentId?: string | null;
}
