import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { RecordQuoteChargeUseCase } from '../../../payments/application/use-cases/record-quote-charge.use-case.js';
import { Quote } from '../../domain/quote.entity.js';
import { QuoteNotFoundError } from '../../domain/quote.errors.js';
import { QuoteRepositoryPort } from '../ports/quote-repository.port.js';

export interface SanctionQuoteCommand {
  id: string;
  status: 'aprobada' | 'rechazada';
  actorId: string | null;
  actorName: string;
}

/**
 * Sanctions a quotation (approve/reject), records who and when and appends
 * the version trail entry. This remains the MCP-facing approve/reject path;
 * the UI uses `ChangeQuoteStatusUseCase` for the full selector.
 *
 * Approving also charges the patient account (caja), same rules as the UI
 * path: one live cargo per quote, amount = approved total, frozen snapshot.
 */
@Injectable()
export class SanctionQuoteUseCase implements UseCase<SanctionQuoteCommand, Quote> {
  constructor(
    private readonly quotes: QuoteRepositoryPort,
    private readonly recordQuoteCharge: RecordQuoteChargeUseCase,
  ) {}

  async execute(command: SanctionQuoteCommand): Promise<Quote> {
    const quote = await this.quotes.findById(command.id);

    if (quote === null || quote.isDeleted) {
      throw new QuoteNotFoundError(command.id);
    }

    const now = new Date();

    quote.sanction(command.status, command.actorId, command.actorName);

    await this.quotes.update(quote);
    await this.quotes.appendVersion({
      quoteId: quote.id,
      version: quote.version,
      action: 'sanctioned',
      snapshot: JSON.stringify(quote.snapshot()),
      actorId: command.actorId,
      actorName: command.actorName,
      createdAt: now,
    });

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
