import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { Quote } from '../../domain/quote.entity.js';
import { QuoteNotFoundError } from '../../domain/quote.errors.js';
import { QuoteRepositoryPort } from '../ports/quote-repository.port.js';

export interface GetQuoteQuery {
  id: string;
}

@Injectable()
export class GetQuoteUseCase implements UseCase<GetQuoteQuery, Quote> {
  constructor(private readonly quotes: QuoteRepositoryPort) {}

  async execute(query: GetQuoteQuery): Promise<Quote> {
    const quote = await this.quotes.findById(query.id);

    if (quote === null) {
      throw new QuoteNotFoundError(query.id);
    }

    return quote;
  }
}
