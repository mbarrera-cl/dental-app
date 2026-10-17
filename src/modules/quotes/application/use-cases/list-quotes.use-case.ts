import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { QuoteRepositoryPort } from '../ports/quote-repository.port.js';
import type { Quote } from '../../domain/quote.entity.js';

export interface ListQuotesQuery {
  patientId?: string;
  status?: string;
  q?: string;
  from?: string;
  to?: string;
}

/**
 * Lists quotations with the filters the list page needs: by patient, status,
 * text (folio), or a date range on the creation date.
 */
@Injectable()
export class ListQuotesUseCase implements UseCase<ListQuotesQuery, Quote[]> {
  constructor(private readonly quotes: QuoteRepositoryPort) {}

  async execute(query: ListQuotesQuery): Promise<Quote[]> {
    const all = await this.quotes.findAll();

    return all
      .filter((quote) => (query.patientId === undefined ? true : quote.patientId === query.patientId))
      .filter((quote) => (query.status === undefined ? true : quote.status === query.status))
      .filter((quote) => {
        if (query.q === undefined) {
          return true;
        }

        const needle = query.q.toLowerCase();

        return quote.folio.toLowerCase().includes(needle);
      })
      .filter((quote) => (query.from === undefined ? true : quote.createdAt >= new Date(query.from)))
      .filter((quote) => (query.to === undefined ? true : quote.createdAt <= new Date(query.to)))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
}
