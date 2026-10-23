import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { GetQuoteUseCase } from '../../../quotes/application/use-cases/get-quote.use-case.js';
import { ClinicalEvent } from '../../domain/clinical-event.entity.js';
import {
  ClinicalRecordLockedError,
  ClinicalRecordNotFoundError,
} from '../../domain/clinical.errors.js';
import { QuoteNotImportableError } from '../../domain/treatment-plan.errors.js';
import {
  TreatmentPlan,
  TreatmentPlanItem,
} from '../../domain/treatment-plan.entity.js';
import { ClinicalRecordRepositoryPort } from '../ports/clinical-record-repository.port.js';
import { TreatmentPlanRepositoryPort } from '../ports/treatment-plan-repository.port.js';
import { computeImportFlags, parseTooth } from './quote-import.js';

export interface ImportQuoteIntoTreatmentPlanCommand {
  recordId: string;
  quoteId: string;
  actorId: string | null;
  /**
   * Quote line ids to import (the operator's choices from the preview). When
   * omitted, only the unambiguous new lines are imported; ambiguous ones are
   * skipped. `duplicado` lines are never imported.
   */
  itemIds?: string[];
}

/**
 * Imports the non-rejected lines of an approved quotation into the treatment
 * plan (codes + text + link to the source line). Idempotent: re-importing the
 * same line is a no-op. Extra procedures always come from a new quotation.
 */
@Injectable()
export class ImportQuoteIntoTreatmentPlanUseCase implements UseCase<
  ImportQuoteIntoTreatmentPlanCommand,
  TreatmentPlanItem[]
> {
  constructor(
    private readonly records: ClinicalRecordRepositoryPort,
    private readonly plans: TreatmentPlanRepositoryPort,
    private readonly getQuote: GetQuoteUseCase,
  ) {}

  async execute(
    command: ImportQuoteIntoTreatmentPlanCommand,
  ): Promise<TreatmentPlanItem[]> {
    const record = await this.records.findById(command.recordId);

    if (record === null) {
      throw new ClinicalRecordNotFoundError(command.recordId);
    }

    if (!record.isDraft) {
      throw new ClinicalRecordLockedError(record.id);
    }

    const quote = await this.getQuote.execute({ id: command.quoteId });

    if (quote.patientId !== record.patientId) {
      throw new QuoteNotImportableError('it belongs to another patient');
    }

    if (quote.status !== 'aprobada') {
      throw new QuoteNotImportableError('it is not approved');
    }

    const plan = await this.getOrCreatePlan(record.id);
    const existing = await this.plans.listItems(plan.id, {
      includeDeleted: true,
    });
    const flags = computeImportFlags(quote, existing);

    const selected = new Set(command.itemIds ?? []);
    const explicit = command.itemIds !== undefined;

    let position =
      existing.reduce((max, item) => Math.max(max, item.position), -1) + 1;
    const imported: TreatmentPlanItem[] = [];

    for (const line of quote.items) {
      const flag = flags.get(line.id);

      if (flag === undefined || flag === 'duplicado') {
        continue;
      }

      const shouldImport = explicit
        ? selected.has(line.id)
        : flag === 'nuevo' || flag === 'sin-codigo';

      if (!shouldImport) {
        continue;
      }

      const item = TreatmentPlanItem.create({
        planId: plan.id,
        tooth: parseTooth(line.piezaDental),
        procedure: line.description,
        ucoCode: line.ucoCode,
        position: position++,
        createdBy: command.actorId,
        sourceQuoteItemId: line.id,
      });

      await this.plans.saveItem(item);
      imported.push(item);
    }

    if (imported.length > 0) {
      await this.records.appendEvent(
        ClinicalEvent.create({
          patientId: record.patientId,
          recordId: record.id,
          actorId: command.actorId,
          action: 'plan-item-importado',
          summary: `Plan: ${imported.length} procedimiento(s) importado(s) del presupuesto ${quote.folio}`,
          payload: {
            quoteId: quote.id,
            folio: quote.folio,
            count: imported.length,
          },
        }),
      );
    }

    return imported;
  }

  private async getOrCreatePlan(recordId: string): Promise<TreatmentPlan> {
    const existing = await this.plans.findPlanByRecordId(recordId);

    if (existing !== null) {
      return existing;
    }

    const plan = TreatmentPlan.create(recordId);
    await this.plans.savePlan(plan);

    return plan;
  }
}
