import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { UcoProcedureRepositoryPort } from '../../../uco/application/ports/uco-procedure-repository.port.js';
import type { QuoteItemInput } from '../../domain/quote-item.entity.js';
import { Quote } from '../../domain/quote.entity.js';
import { QuoteLockedError, QuoteNotFoundError } from '../../domain/quote.errors.js';
import { QuoteRepositoryPort } from '../ports/quote-repository.port.js';

export interface UpdateQuoteCommand {
  id: string;
  validUntil?: string | null;
  notes?: string | null;
  items: Array<{
    id?: string;
    ucoCode?: string | null;
    description: string;
    piezaDental?: string | null;
    quantity: number;
    unitPrice: number;
    discountPercent?: number;
  }>;
  actorId: string | null;
  actorName: string;
}

/**
 * Saves the current state of a draft/entregada quote: replaces its lines,
 * recomputes totals and appends an `updated` version entry. A sanctioned
 * quote is locked (edit requires duplicating it).
 */
@Injectable()
export class UpdateQuoteUseCase implements UseCase<UpdateQuoteCommand, Quote> {
  constructor(
    private readonly quotes: QuoteRepositoryPort,
    private readonly procedures: UcoProcedureRepositoryPort,
  ) {}

  async execute(command: UpdateQuoteCommand): Promise<Quote> {
    const quote = await this.quotes.findById(command.id);

    if (quote === null || quote.isDeleted) {
      throw new QuoteNotFoundError(command.id);
    }

    if (quote.status === 'aprobada' || quote.status === 'rechazada') {
      throw new QuoteLockedError(command.id);
    }

    const items = await this.resolveItems(command.items);
    const now = new Date();

    quote.update({
      validUntil: command.validUntil === undefined ? undefined : command.validUntil === null ? null : new Date(command.validUntil),
      notes: command.notes,
      items,
      actorId: command.actorId,
      actorName: command.actorName,
    });

    await this.quotes.update(quote);
    await this.quotes.appendVersion({
      quoteId: quote.id,
      version: quote.version,
      action: 'updated',
      snapshot: JSON.stringify(quote.snapshot()),
      actorId: command.actorId,
      actorName: command.actorName,
      createdAt: now,
    });

    return quote;
  }

  private async resolveItems(
    input: UpdateQuoteCommand['items'],
  ): Promise<QuoteItemInput[]> {
    return Promise.all(
      input.map(async (line) => {
        let ucoCode: string | null = line.ucoCode ?? null;

        if (ucoCode !== null) {
          const procedure = await this.procedures.findByCode(ucoCode);

          if (procedure !== null) {
            ucoCode = procedure.code;
          }
        }

        return {
          id: line.id,
          ucoCode,
          description: line.description,
          piezaDental: line.piezaDental ?? null,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          discountPercent: line.discountPercent ?? 0,
        };
      }),
    );
  }
}
