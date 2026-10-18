import { IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/** `POST /patients/:patientId/ledger/charges` — a billed service (cargo). */
export class RecordChargeRequestDto {
  /** Integer CLP, > 0 (CLP has no decimals; totals are never trusted from the client). */
  @IsInt()
  @Min(1)
  @Max(1_000_000_000)
  amount: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  concept: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  quoteId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  appointmentId?: string | null;
}
