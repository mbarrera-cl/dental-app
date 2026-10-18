import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { RecordQuoteChargeUseCase } from '../../../payments/application/use-cases/record-quote-charge.use-case.js';
import { Quote, type QuoteStatus } from '../../domain/quote.entity.js';
import { QuoteNotFoundError } from '../../domain/quote.errors.js';
import { QuoteRepositoryPort } from '../ports/quote-repository.port.js';

export interface ChangeQuoteStatusCommand {
  id: string;
  status: QuoteStatus;
  actorId: string | null;
  actorName: string;
}

/**
 * Explicit workflow status change (borrador, sin respuesta, aprobada or
 * rechazada). It records the sanction metadata for approved/rejected and
 * clears it when returning to an open state. Editing lines never calls this.
 *
 * Sanctioning `aprobada` also charges the patient account (caja): one live
 * cargo per quote, amount = the approved total (the entity approves every
 * line in a chain). The charge is a frozen snapshot — see
 * `RecordQuoteChargeUseCase`. Rejecting/queuing changes nothing.
 */
@Injectable()
export class ChangeQuoteStatusUseCase implements UseCase<ChangeQuoteStatusCommand, Quote> {
  constructor(
    private readonly quotes: QuoteRepositoryPort,
    private readonly recordQuoteCharge: RecordQuoteChargeUseCase,
  ) {}

  async execute(command: ChangeQuoteStatusCommand): Promise<Quote> {
    const quote = await this.quotes.findById(command.id);

    if (quote === null || quote.isDeleted) {
      throw new QuoteNotFoundError(command.id);
    }

    if (quote.status === command.status) {
      return quote;
    }

    const now = new Date();

    quote.changeStatus(command.status, command.actorId, command.actorName);

    await this.quotes.update(quote);
    await this.quotes.appendVersion({
      quoteId: quote.id,
      version: quote.version,
      action: 'status-changed',
      snapshot: JSON.stringify(quote.snapshot()),
      actorId: command.actorId,
      actorName: command.actorName,
      createdAt: now,
    });

    // The charge happens after the sanction persists: an account failure must
    // never roll back the workflow decision. Re-approving later is safe — the
    // ledger guard keeps one live charge per quote.
    if (command.status === 'aprobada') {
      await this.recordQuoteCharge.execute({
        quoteId: quote.id,
        folio: quote.folio,
        patientId: quote.patientId,
        amount: quote.approvedTotal,
        actorId: command.actorId,
      });
    }

    return quote;
  }
}
