import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { PatientRepositoryPort } from '../../../patients/application/ports/patient-repository.port.js';
import { PatientNotFoundError } from '../../../patients/domain/patient.errors.js';
import { SettingsService } from '../../../settings/application/settings.service.js';
import { UcoProcedureRepositoryPort } from '../../../uco/application/ports/uco-procedure-repository.port.js';
import type { QuoteItemInput } from '../../domain/quote-item.entity.js';
import { Quote } from '../../domain/quote.entity.js';
import { QuoteFolioTakenError } from '../../domain/quote-folio.errors.js';
import { QuoteRepositoryPort } from '../ports/quote-repository.port.js';

export interface CreateQuoteCommand {
  patientId: string;
  validUntil?: string | null;
  notes?: string | null;
  items: Array<{
    /** Resolved from the UCO catalog when provided (the price is still editable). */
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
 * Creates a draft quote. Resolves the patient snapshot and the UCO code
 * (when present), computes the folio from settings + a per-year counter, and
 * recomputes every total on the server. A new quote always lands in
 * `borrador` and opens its version trail with a `created` entry.
 */
@Injectable()
export class CreateQuoteUseCase implements UseCase<CreateQuoteCommand, Quote> {
  constructor(
    private readonly quotes: QuoteRepositoryPort,
    private readonly patients: PatientRepositoryPort,
    private readonly procedures: UcoProcedureRepositoryPort,
    private readonly settings: SettingsService,
  ) {}

  async execute(command: CreateQuoteCommand): Promise<Quote> {
    const patient = await this.patients.findById(command.patientId);

    if (patient === null) {
      throw new PatientNotFoundError(command.patientId);
    }

    const items = await this.resolveItems(command.items);
    const folio = await this.nextFolio();
    const validityDays = await this.settings.getNumber('quotes.defaultValidityDays');
    const now = new Date();
    const validUntil =
      command.validUntil === undefined
        ? new Date(now.getTime() + validityDays * 24 * 60 * 60 * 1000)
        : command.validUntil === null
          ? null
          : new Date(command.validUntil);

    const quote = Quote.create({
      folio,
      patientId: patient.id,
      patientName: patient.nombreCompleto,
      patientRut: patient.rut,
      patientEmail: patient.email,
      validUntil,
      notes: command.notes ?? null,
      items,
      createdBy: command.actorId,
      createdByName: command.actorName,
    });

    await this.quotes.save(quote);
    await this.quotes.appendVersion({
      quoteId: quote.id,
      version: quote.version,
      action: 'created',
      snapshot: JSON.stringify(quote.snapshot()),
      actorId: command.actorId,
      actorName: command.actorName,
      createdAt: now,
    });

    return quote;
  }

  private async resolveItems(
    input: CreateQuoteCommand['items'],
  ): Promise<QuoteItemInput[]> {
    return Promise.all(
      input.map(async (line, index) => {
        let ucoCode: string | null = line.ucoCode ?? null;

        if (ucoCode !== null) {
          const procedure = await this.procedures.findByCode(ucoCode);

          if (procedure !== null) {
            ucoCode = procedure.code;
          }
        }

        return {
          position: index,
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

  private async nextFolio(): Promise<string> {
    const year = new Date().getFullYear();
    const number = await this.quotes.nextFolioNumber(year);
    const prefix = (await this.settings.getValue('quotes.folioPrefix')) as string;
    const folio = `${prefix}-${year}-${String(number).padStart(4, '0')}`;

    const existing = await this.quotes.findByFolio(folio);

    if (existing !== null) {
      throw new QuoteFolioTakenError(folio);
    }

    return folio;
  }
}
