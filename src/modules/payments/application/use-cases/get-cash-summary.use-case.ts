import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import type { PaymentMethod } from '../../domain/payment-method.js';
import { LedgerRepositoryPort } from '../ports/ledger-repository.port.js';

export interface GetCashSummaryCommand {
  /** ISO date, inclusive. Omitted → no lower bound. */
  from?: string | null;
  /** ISO date, inclusive (the whole day). Omitted → no upper bound. */
  to?: string | null;
}

export interface CashSummaryEntry {
  method: PaymentMethod;
  total: number;
}

/**
 * Close-of-day helper: total of the non-voided payments (abonos) grouped by
 * method inside an inclusive date range. Voids shift the summary too, since
 * annulled payments stop counting.
 */
@Injectable()
export class GetCashSummaryUseCase implements UseCase<GetCashSummaryCommand, CashSummaryEntry[]> {
  constructor(private readonly ledger: LedgerRepositoryPort) {}

  async execute(command: GetCashSummaryCommand): Promise<CashSummaryEntry[]> {
    return this.ledger.cashSummary(parseBound(command.from, false), parseBound(command.to, true));
  }
}

function parseBound(value: string | null | undefined, endOfDay: boolean): Date | null {
  if (value === undefined || value === null || value.trim() === '') {
    return null;
  }

  const date = new Date(value);

  if (!Number.isNaN(date.getTime())) {
    return endOfDay && date.getHours() === 0 && date.getMinutes() === 0
      ? new Date(date.getTime() + 24 * 60 * 60 * 1000 - 1)
      : date;
  }

  return null;
}
