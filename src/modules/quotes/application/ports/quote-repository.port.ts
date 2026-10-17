import type { Quote } from '../../domain/quote.entity.js';

/**
 * Driven port (secondary port): persistence contract of quotations and their
 * version trail. Concrete adapters live in `infrastructure/adapters` and are
 * bound to this class in the feature module (composition root).
 *
 * The folio is the business key: adapters must enforce it as unique and
 * translate unique violations into `QuoteFolioTakenError`.
 */
export abstract class QuoteRepositoryPort {
  abstract save(quote: Quote): Promise<void>;

  /** Updates an existing quote; throws `QuoteNotFoundError` when missing. */
  abstract update(quote: Quote): Promise<void>;

  abstract findById(id: string): Promise<Quote | null>;

  abstract findByFolio(folio: string): Promise<Quote | null>;

  abstract findAll(): Promise<Quote[]>;

  /** Next folio number of `year`, atomically (the counters row is upserted). */
  abstract nextFolioNumber(year: number): Promise<number>;

  /** Append one version entry to the trail of a quote. */
  abstract appendVersion(entry: {
    quoteId: string;
    version: number;
    action: string;
    snapshot: string;
    actorId: string | null;
    actorName: string;
    createdAt: Date;
  }): Promise<void>;

  /** Version trail of a quote, oldest first. */
  abstract listVersions(quoteId: string): Promise<Array<{
    id: string;
    version: number;
    action: string;
    snapshot: string;
    actorId: string | null;
    actorName: string;
    createdAt: Date;
  }>>;
}
