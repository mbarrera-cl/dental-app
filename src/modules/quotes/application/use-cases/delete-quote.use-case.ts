import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { Quote } from '../../domain/quote.entity.js';
import { QuoteNotFoundError } from '../../domain/quote.errors.js';
import { QuoteRepositoryPort } from '../ports/quote-repository.port.js';

export interface DeleteQuoteCommand {
  id: string;
  actorId: string | null;
  actorName: string;
}

/**
 * Moves a quotation to the trash (soft delete). Any status can be trashed —
 * a sanctioned document keeps its sanction and can be restored later; the
 * folio and the version trail are preserved. Idempotent: trashing an already
 * trashed quote is a no-op.
 */
@Injectable()
export class DeleteQuoteUseCase implements UseCase<DeleteQuoteCommand, Quote> {
  constructor(private readonly quotes: QuoteRepositoryPort) {}

  async execute(command: DeleteQuoteCommand): Promise<Quote> {
    const quote = await this.quotes.findById(command.id);

    if (quote === null) {
      throw new QuoteNotFoundError(command.id);
    }

    if (quote.isDeleted) {
      return quote;
    }

    quote.softDelete(command.actorId, command.actorName);

    await this.quotes.update(quote);
    await this.quotes.appendVersion({
      quoteId: quote.id,
      version: quote.version,
      action: 'deleted',
      snapshot: JSON.stringify(quote.snapshot()),
      actorId: command.actorId,
      actorName: command.actorName,
      createdAt: new Date(),
    });

    return quote;
  }
}
