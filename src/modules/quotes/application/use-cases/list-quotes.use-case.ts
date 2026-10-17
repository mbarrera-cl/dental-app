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
  /** `exclude` (default) hides the trash; `only` lists it; `all` merges both. */
  deleted?: 'exclude' | 'only' | 'all';
}

/**
 * Lists quotations with the filters the list page needs: by patient, status,
 * text (folio), a date range on the creation date and the trash view.
 */
@Injectable()
export class ListQuotesUseCase implements UseCase<ListQuotesQuery, Quote[]> {
  constructor(private readonly quotes: QuoteRepositoryPort) {}

  async execute(query: ListQuotesQuery): Promise<Quote[]> {
    const all = await this.quotes.findAll();
    const deleted = query.deleted ?? 'exclude';

    return all
      .filter((quote) => (deleted === 'all' ? true : deleted === 'only' ? quote.isDeleted : !quote.isDeleted))
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
