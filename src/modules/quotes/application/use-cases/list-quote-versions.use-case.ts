import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { QuoteRepositoryPort } from '../ports/quote-repository.port.js';

export interface QuoteVersion {
  id: string;
  version: number;
  action: string;
  snapshot: string;
  actorId: string | null;
  actorName: string;
  createdAt: Date;
}

export interface ListQuoteVersionsQuery {
  quoteId: string;
}

/** Version trail of a quote (oldest first), used by the history panel. */
@Injectable()
export class ListQuoteVersionsUseCase implements UseCase<ListQuoteVersionsQuery, QuoteVersion[]> {
  constructor(private readonly quotes: QuoteRepositoryPort) {}

  async execute(query: ListQuoteVersionsQuery): Promise<QuoteVersion[]> {
    return this.quotes.listVersions(query.quoteId);
  }
}
