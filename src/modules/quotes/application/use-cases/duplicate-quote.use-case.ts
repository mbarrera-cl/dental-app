import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { Quote } from '../../domain/quote.entity.js';
import { QuoteFolioTakenError } from '../../domain/quote-folio.errors.js';
import { QuoteNotFoundError } from '../../domain/quote.errors.js';
import { QuoteRepositoryPort } from '../ports/quote-repository.port.js';

export interface DuplicateQuoteCommand {
  id: string;
  actorId: string | null;
  actorName: string;
}

/**
 * Creates a new draft version of a quote (typically after it was sanctioned
 * and needs edits). The new quote gets a fresh folio and links back to the
 * source via `replacesQuoteId`; its version trail opens with a `duplicated`
 * entry.
 */
@Injectable()
export class DuplicateQuoteUseCase implements UseCase<DuplicateQuoteCommand, Quote> {
  constructor(private readonly quotes: QuoteRepositoryPort) {}

  async execute(command: DuplicateQuoteCommand): Promise<Quote> {
    const source = await this.quotes.findById(command.id);

    if (source === null) {
      throw new QuoteNotFoundError(command.id);
    }

    const year = new Date().getFullYear();
    const number = await this.quotes.nextFolioNumber(year);
    const folio = `COT-${year}-${String(number).padStart(4, '0')}`;

    const existing = await this.quotes.findByFolio(folio);

    if (existing !== null) {
      throw new QuoteFolioTakenError(folio);
    }

    const duplicate = source.duplicate(command.actorId, command.actorName, folio);
    const now = new Date();

    await this.quotes.save(duplicate);
    await this.quotes.appendVersion({
      quoteId: duplicate.id,
      version: duplicate.version,
      action: 'duplicated',
      snapshot: JSON.stringify(duplicate.snapshot()),
      actorId: command.actorId,
      actorName: command.actorName,
      createdAt: now,
    });

    return duplicate;
  }
}
