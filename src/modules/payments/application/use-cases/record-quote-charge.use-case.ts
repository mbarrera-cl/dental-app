import { Injectable, Logger } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { Movement } from '../../domain/movement.entity.js';
import { LedgerRepositoryPort } from '../ports/ledger-repository.port.js';

export interface RecordQuoteChargeCommand {
  quoteId: string;
  folio: string;
  patientId: string;
  /** Amount to charge (the quote's approved total at sanction time). */
  amount: number;
  actorId: string | null;
}

/**
 * Charges the patient account for an approved quotation. Called by the quote
 * workflow on the transition to `aprobada`.
 *
 * Guardrails of the snapshot model:
 * - **One live charge per quote**: if a non-voided cargo already exists for
 *   the quote, this is a no-op (idempotent) — re-sanctions never duplicate.
 *   Voiding the cargo in the Cuenta tab re-enables this (the recovery path).
 * - **Frozen snapshot**: later item decisions or re-edits never touch the
 *   recorded amount. The charge remembers what was approved when sanctioned.
 * - A zero amount charges nothing (defensive).
 */
@Injectable()
export class RecordQuoteChargeUseCase implements UseCase<RecordQuoteChargeCommand, Movement | null> {
  private readonly logger = new Logger(RecordQuoteChargeUseCase.name);

  constructor(private readonly ledger: LedgerRepositoryPort) {}

  async execute(command: RecordQuoteChargeCommand): Promise<Movement | null> {
    const existing = await this.ledger.listByQuoteId(command.quoteId);

    if (existing.some((movement) => movement.kind === 'cargo' && !movement.isVoided)) {
      return null;
    }

    if (!Number.isInteger(command.amount) || command.amount <= 0) {
      return null;
    }

    const movement = Movement.create({
      kind: 'cargo',
      amount: command.amount,
      method: null,
      reference: null,
      concept: `Presupuesto ${command.folio.trim()} — aprobado`,
      patientId: command.patientId,
      quoteId: command.quoteId,
      appointmentId: null,
      createdBy: command.actorId,
    });

    await this.ledger.append(movement);

    return movement;
  }
}
