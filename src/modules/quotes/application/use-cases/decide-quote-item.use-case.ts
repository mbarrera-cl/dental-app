import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { Quote } from '../../domain/quote.entity.js';
import { QuoteItemNotFoundError, QuoteLockedError, QuoteNotFoundError } from '../../domain/quote.errors.js';
import { QuoteRepositoryPort } from '../ports/quote-repository.port.js';

export interface DecideQuoteItemCommand {
  quoteId: string;
  itemId: string;
  status: 'generado' | 'aprobado' | 'rechazado';
  actorId: string | null;
  actorName: string;
}

/**
 * Decides the acceptance state of one line (patient acceptance recorded by
 * staff). Lines of a sanctioned quote are locked. A decided line can be
 * reopened to `generado` while the quote is still open.
 */
@Injectable()
export class DecideQuoteItemUseCase implements UseCase<DecideQuoteItemCommand, Quote> {
  constructor(private readonly quotes: QuoteRepositoryPort) {}

  async execute(command: DecideQuoteItemCommand): Promise<Quote> {
    const quote = await this.quotes.findById(command.quoteId);

    if (quote === null) {
      throw new QuoteNotFoundError(command.quoteId);
    }

    if (quote.status === 'aprobada' || quote.status === 'rechazada') {
      throw new QuoteLockedError(command.quoteId);
    }

    if (!quote.items.some((item) => item.id === command.itemId)) {
      throw new QuoteItemNotFoundError(command.quoteId, command.itemId);
    }

    const now = new Date();

    quote.decideItem(command.itemId, command.status, command.actorId, command.actorName);

    await this.quotes.update(quote);
    await this.quotes.appendVersion({
      quoteId: quote.id,
      version: quote.version,
      action: 'item-status',
      snapshot: JSON.stringify(quote.snapshot()),
      actorId: command.actorId,
      actorName: command.actorName,
      createdAt: now,
    });

    return quote;
  }
}
