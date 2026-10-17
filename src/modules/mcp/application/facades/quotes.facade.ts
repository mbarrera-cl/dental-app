import { Injectable } from '@nestjs/common';
import type { Principal } from '../../../../shared/security/principal.js';
import { SettingsService } from '../../../settings/application/settings.service.js';
import { UcoProcedureRepositoryPort } from '../../../uco/application/ports/uco-procedure-repository.port.js';
import { CreateQuoteUseCase } from '../../../quotes/application/use-cases/create-quote.use-case.js';
import { DecideQuoteItemUseCase } from '../../../quotes/application/use-cases/decide-quote-item.use-case.js';
import { DeleteQuoteUseCase } from '../../../quotes/application/use-cases/delete-quote.use-case.js';
import { DuplicateQuoteUseCase } from '../../../quotes/application/use-cases/duplicate-quote.use-case.js';
import { GetQuoteUseCase } from '../../../quotes/application/use-cases/get-quote.use-case.js';
import { ListQuoteVersionsUseCase } from '../../../quotes/application/use-cases/list-quote-versions.use-case.js';
import { ListQuotesUseCase } from '../../../quotes/application/use-cases/list-quotes.use-case.js';
import { RestoreQuoteUseCase } from '../../../quotes/application/use-cases/restore-quote.use-case.js';
import { SanctionQuoteUseCase } from '../../../quotes/application/use-cases/sanction-quote.use-case.js';
import { UpdateQuoteUseCase } from '../../../quotes/application/use-cases/update-quote.use-case.js';
import type { QuoteItemStatus } from '../../../quotes/domain/quote-item.entity.js';
import type { Quote, QuoteStatus } from '../../../quotes/domain/quote.entity.js';
import { PatientsFacade } from './patients.facade.js';

export interface QuoteItemInput {
  /** UCO catalog code; when present and `unitPrice` is omitted, the price is computed from the UCO rate. */
  ucoCode?: string | null;
  description?: string | null;
  piezaDental?: string | null;
  quantity: number;
  unitPrice?: number | null;
  discountPercent?: number | null;
}

export interface CreateQuoteInput {
  patientId?: string;
  patientRut?: string;
  validUntil?: string | null;
  notes?: string | null;
  items: QuoteItemInput[];
}

export interface UpdateQuoteInput {
  quoteId: string;
  validUntil?: string | null;
  notes?: string | null;
  items: QuoteItemInput[];
}

export interface QuoteListInput {
  patientId?: string;
  status?: string;
  q?: string;
  from?: string;
  to?: string;
  deleted?: 'exclude' | 'only' | 'all';
  limit: number;
}

export interface QuoteItemView {
  id: string;
  ucoCode: string | null;
  description: string;
  piezaDental: string | null;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  subtotal: number;
  discountAmount: number;
  netAmount: number;
  status: QuoteItemStatus;
}

export interface QuoteView {
  id: string;
  folio: string;
  status: QuoteStatus;
  version: number;
  patient: { id: string; name: string; rut: string; email: string | null };
  validUntil: string | null;
  notes: string | null;
  totals: { subtotal: number; discountTotal: number; total: number; approvedTotal: number };
  items: QuoteItemView[];
  createdAt: string;
  updatedAt: string;
  createdByName: string;
  sanctionedByName: string | null;
  sanctionedAt: string | null;
  deletedAt: string | null;
}

export interface QuoteSummaryView {
  id: string;
  folio: string;
  status: QuoteStatus;
  version: number;
  patient: { id: string; name: string; rut: string };
  total: number;
  createdAt: string;
  validUntil: string | null;
  deletedAt: string | null;
}

/**
 * MCP-facing quotation application service. It reuses the existing use cases
 * (domain rules, folio counters, totals, versions) and only adds the MCP
 * conveniences: patient by RUT, UCO-based pricing and compact views.
 */
@Injectable()
export class QuotesFacade {
  constructor(
    private readonly patients: PatientsFacade,
    private readonly procedures: UcoProcedureRepositoryPort,
    private readonly settings: SettingsService,
    private readonly listQuotes: ListQuotesUseCase,
    private readonly getQuote: GetQuoteUseCase,
    private readonly createQuote: CreateQuoteUseCase,
    private readonly updateQuote: UpdateQuoteUseCase,
    private readonly deleteQuote: DeleteQuoteUseCase,
    private readonly restoreQuote: RestoreQuoteUseCase,
    private readonly duplicateQuote: DuplicateQuoteUseCase,
    private readonly decideItem: DecideQuoteItemUseCase,
    private readonly sanctionQuote: SanctionQuoteUseCase,
    private readonly versions: ListQuoteVersionsUseCase,
  ) {}

  async list(input: QuoteListInput): Promise<QuoteSummaryView[]> {
    const quotes = await this.listQuotes.execute({
      patientId: input.patientId,
      status: input.status,
      q: input.q,
      from: input.from,
      to: input.to,
      deleted: input.deleted,
    });

    return quotes.slice(0, input.limit).map(toSummary);
  }

  async get(quoteId: string): Promise<QuoteView> {
    return toView(await this.getQuote.execute({ id: quoteId }));
  }

  async create(input: CreateQuoteInput, actor: Principal): Promise<QuoteView> {
    const patient = await this.patients.resolve({
      patientId: input.patientId,
      rut: input.patientRut,
    });
    const items = await this.resolveItems(input.items);
    const quote = await this.createQuote.execute({
      patientId: patient.id,
      validUntil: input.validUntil,
      notes: input.notes,
      items,
      actorId: actor.userId,
      actorName: actor.name,
    });

    return toView(quote);
  }

  async update(input: UpdateQuoteInput, actor: Principal): Promise<QuoteView> {
    const items = await this.resolveItems(input.items);
    const quote = await this.updateQuote.execute({
      id: input.quoteId,
      validUntil: input.validUntil,
      notes: input.notes,
      items,
      actorId: actor.userId,
      actorName: actor.name,
    });

    return toView(quote);
  }

  async duplicate(quoteId: string, actor: Principal): Promise<QuoteView> {
    return toView(
      await this.duplicateQuote.execute({ id: quoteId, actorId: actor.userId, actorName: actor.name }),
    );
  }

  async decideItemStatus(
    quoteId: string,
    itemId: string,
    status: QuoteItemStatus,
    actor: Principal,
  ): Promise<QuoteView> {
    return toView(
      await this.decideItem.execute({
        quoteId,
        itemId,
        status,
        actorId: actor.userId,
        actorName: actor.name,
      }),
    );
  }

  async sanction(
    quoteId: string,
    status: 'aprobada' | 'rechazada',
    actor: Principal,
  ): Promise<QuoteView> {
    return toView(
      await this.sanctionQuote.execute({
        id: quoteId,
        status,
        actorId: actor.userId,
        actorName: actor.name,
      }),
    );
  }

  async remove(quoteId: string, actor: Principal): Promise<void> {
    await this.deleteQuote.execute({ id: quoteId, actorId: actor.userId, actorName: actor.name });
  }

  async restore(quoteId: string, actor: Principal): Promise<QuoteView> {
    return toView(
      await this.restoreQuote.execute({ id: quoteId, actorId: actor.userId, actorName: actor.name }),
    );
  }

  async listVersions(quoteId: string) {
    const versions = await this.versions.execute({ quoteId });

    return versions.map((version) => ({
      id: version.id,
      version: version.version,
      action: version.action,
      actorName: version.actorName,
      createdAt: version.createdAt.toISOString(),
      snapshot: safeParse(version.snapshot),
    }));
  }

  private async resolveItems(input: QuoteItemInput[]) {
    const rate = await this.settings.getNumber('quotes.ucoRate');

    return Promise.all(
      input.map(async (line) => {
        let unitPrice = line.unitPrice ?? null;
        let description = line.description?.trim() ?? '';
        let ucoCode = line.ucoCode?.trim() || null;

        if (ucoCode !== null) {
          const procedure = await this.procedures.findByCode(ucoCode);

          if (procedure === null) {
            throw new Error(`UCO procedure not found: ${ucoCode}`);
          }

          ucoCode = procedure.code;
          description = description === '' ? procedure.name : description;
          unitPrice ??= Math.round(procedure.units * rate);
        }

        if (description === '') {
          throw new Error('Each quote line needs a description or a UCO code.');
        }

        if (unitPrice === null || unitPrice < 0) {
          throw new Error(
            `Each quote line needs a unitPrice, or a ucoCode to compute it from the UCO rate.`,
          );
        }

        if (!Number.isInteger(line.quantity) || line.quantity < 1) {
          throw new Error('Each quote line needs an integer quantity >= 1.');
        }

        return {
          ucoCode,
          description,
          piezaDental: line.piezaDental?.trim() || null,
          quantity: line.quantity,
          unitPrice,
          discountPercent: line.discountPercent ?? 0,
        };
      }),
    );
  }
}

export function toView(quote: Quote): QuoteView {
  return {
    id: quote.id,
    folio: quote.folio,
    status: quote.status,
    version: quote.version,
    patient: {
      id: quote.patientId,
      name: quote.patientName,
      rut: quote.patientRut,
      email: quote.patientEmail,
    },
    validUntil: quote.validUntil?.toISOString() ?? null,
    notes: quote.notes,
    totals: {
      subtotal: quote.subtotal,
      discountTotal: quote.discountTotal,
      total: quote.total,
      approvedTotal: quote.approvedTotal,
    },
    items: quote.items.map((item) => ({
      id: item.id,
      ucoCode: item.ucoCode,
      description: item.description,
      piezaDental: item.piezaDental,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discountPercent: item.discountPercent,
      subtotal: item.subtotal,
      discountAmount: item.discountAmount,
      netAmount: item.netAmount,
      status: item.status,
    })),
    createdAt: quote.createdAt.toISOString(),
    updatedAt: quote.updatedAt.toISOString(),
    createdByName: quote.createdByName,
    sanctionedByName: quote.sanctionedByName,
    sanctionedAt: quote.sanctionedAt?.toISOString() ?? null,
    deletedAt: quote.deletedAt?.toISOString() ?? null,
  };
}

function toSummary(quote: Quote): QuoteSummaryView {
  return {
    id: quote.id,
    folio: quote.folio,
    status: quote.status,
    version: quote.version,
    patient: { id: quote.patientId, name: quote.patientName, rut: quote.patientRut },
    total: quote.total,
    createdAt: quote.createdAt.toISOString(),
    validUntil: quote.validUntil?.toISOString() ?? null,
    deletedAt: quote.deletedAt?.toISOString() ?? null,
  };
}

function safeParse(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}
