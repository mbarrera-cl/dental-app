import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { GetQuoteUseCase } from '../../../quotes/application/use-cases/get-quote.use-case.js';
import { ClinicalRecordNotFoundError } from '../../domain/clinical.errors.js';
import { QuoteNotImportableError } from '../../domain/treatment-plan.errors.js';
import { ClinicalRecordRepositoryPort } from '../ports/clinical-record-repository.port.js';
import { TreatmentPlanRepositoryPort } from '../ports/treatment-plan-repository.port.js';
import {
  computeImportFlags,
  parseTooth,
  type QuoteImportFlag,
} from './quote-import.js';

export interface PreviewQuoteImportQuery {
  recordId: string;
  quoteId: string;
}

export interface QuoteImportPreviewItem {
  quoteItemId: string;
  ucoCode: string | null;
  description: string;
  tooth: number | null;
  flag: QuoteImportFlag;
}

export interface QuoteImportPreview {
  quoteId: string;
  folio: string;
  items: QuoteImportPreviewItem[];
}

/**
 * Dry-run of importing an approved quotation: lists its lines annotated with
 * their import flag so the operator can resolve the ambiguous ones before
 * confirming. Never writes anything.
 */
@Injectable()
export class PreviewQuoteImportUseCase implements UseCase<
  PreviewQuoteImportQuery,
  QuoteImportPreview
> {
  constructor(
    private readonly records: ClinicalRecordRepositoryPort,
    private readonly plans: TreatmentPlanRepositoryPort,
    private readonly getQuote: GetQuoteUseCase,
  ) {}

  async execute(
    query: PreviewQuoteImportQuery,
  ): Promise<QuoteImportPreview> {
    const record = await this.records.findById(query.recordId);

    if (record === null) {
      throw new ClinicalRecordNotFoundError(query.recordId);
    }

    const quote = await this.getQuote.execute({ id: query.quoteId });

    if (quote.patientId !== record.patientId) {
      throw new QuoteNotImportableError('it belongs to another patient');
    }

    if (quote.status !== 'aprobada') {
      throw new QuoteNotImportableError('it is not approved');
    }

    const plan = await this.plans.findPlanByRecordId(record.id);
    const existing =
      plan === null
        ? []
        : await this.plans.listItems(plan.id, { includeDeleted: true });
    const flags = computeImportFlags(quote, existing);

    const items = quote.items
      .filter((line) => line.status !== 'rechazado')
      .map((line) => ({
        quoteItemId: line.id,
        ucoCode: line.ucoCode,
        description: line.description,
        tooth: parseTooth(line.piezaDental),
        flag: flags.get(line.id) as QuoteImportFlag,
      }));

    return { quoteId: quote.id, folio: quote.folio, items };
  }
}
