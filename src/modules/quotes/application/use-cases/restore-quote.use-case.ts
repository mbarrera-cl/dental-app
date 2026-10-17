import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { Quote } from '../../domain/quote.entity.js';
import { QuoteNotFoundError } from '../../domain/quote.errors.js';
import { QuoteRepositoryPort } from '../ports/quote-repository.port.js';

export interface RestoreQuoteCommand {
  id: string;
  actorId: string | null;
  actorName: string;
}

/**
 * Brings a quotation back from the trash, keeping its status, sanction and
 * version history. Idempotent: restoring a live quote returns it unchanged.
 */
@Injectable()
export class RestoreQuoteUseCase implements UseCase<RestoreQuoteCommand, Quote> {
  constructor(private readonly quotes: QuoteRepositoryPort) {}

  async execute(command: RestoreQuoteCommand): Promise<Quote> {
    const quote = await this.quotes.findById(command.id);

    if (quote === null) {
      throw new QuoteNotFoundError(command.id);
    }

    if (!quote.isDeleted) {
      return quote;
    }

    quote.restore(command.actorId, command.actorName);

    await this.quotes.update(quote);
    await this.quotes.appendVersion({
      quoteId: quote.id,
      version: quote.version,
      action: 'restored',
      snapshot: JSON.stringify(quote.snapshot()),
      actorId: command.actorId,
      actorName: command.actorName,
      createdAt: new Date(),
    });

    return quote;
  }
}
