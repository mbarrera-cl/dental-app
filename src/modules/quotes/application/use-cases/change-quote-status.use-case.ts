import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
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
 */
@Injectable()
export class ChangeQuoteStatusUseCase implements UseCase<ChangeQuoteStatusCommand, Quote> {
  constructor(private readonly quotes: QuoteRepositoryPort) {}

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

    return quote;
  }
}
