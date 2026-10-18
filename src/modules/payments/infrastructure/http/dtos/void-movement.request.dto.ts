import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** `POST /ledger/:id/void` — annul a movement (append-only audit trail). */
export class VoidMovementRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  reason: string;
}
