import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { QuoteLockedError, QuoteNotFoundError } from '../../domain/quote.errors.js';
import { QuoteRepositoryPort } from '../ports/quote-repository.port.js';

export interface DeleteQuoteCommand {
  id: string;
}

/**
 * Deletes a quotation. Only drafts can be deleted; a delivered/sanctioned
 * quote must be closed or duplicated, never removed.
 */
@Injectable()
export class DeleteQuoteUseCase implements UseCase<DeleteQuoteCommand, void> {
  constructor(private readonly quotes: QuoteRepositoryPort) {}

  async execute(command: DeleteQuoteCommand): Promise<void> {
    const quote = await this.quotes.findById(command.id);

    if (quote === null) {
      throw new QuoteNotFoundError(command.id);
    }

    if (quote.status !== 'borrador') {
      throw new QuoteLockedError(command.id);
    }

    await this.quotes.delete(command.id);
  }
}
