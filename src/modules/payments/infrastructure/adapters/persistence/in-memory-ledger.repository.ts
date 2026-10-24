import { Injectable } from '@nestjs/common';
import { LedgerRepositoryPort } from '../../../application/ports/ledger-repository.port.js';
import { MovementNotFoundError } from '../../../domain/payment.errors.js';
import type { Movement } from '../../../domain/movement.entity.js';
import type { PaymentMethod } from '../../../domain/payment-method.js';

/**
 * Driven adapter: keeps the ledger in memory for local development and tests.
 * Swap it for a database-backed adapter by rebinding `LedgerRepositoryPort` in
 * `PaymentsModule` — nothing else in the codebase has to change.
 */
@Injectable()
export class InMemoryLedgerRepository extends LedgerRepositoryPort {
  /** Insertion order is preserved: oldest first, like other append-only logs. */
  private readonly entries: Movement[] = [];

  async append(movement: Movement): Promise<void> {
    this.entries.push(movement);
  }

  async findById(id: string): Promise<Movement | null> {
    return this.entries.find((entry) => entry.id === id) ?? null;
  }

  /** History of the patient, newest first (`created_at DESC, id DESC`). */
  async listByPatient(patientId: string, limit: number, offset: number): Promise<Movement[]> {
    return this.entries
      .filter((entry) => entry.patientId === patientId)
      .sort(compareHistory)
      .slice(offset, offset + limit);
  }

  async countByPatient(patientId: string): Promise<number> {
    return this.entries.filter((entry) => entry.patientId === patientId).length;
  }

  /** Every movement linked to one quote (voided or not), newest first. */
  async listByQuoteId(quoteId: string): Promise<Movement[]> {
    return this.entries
      .filter((entry) => entry.quoteId === quoteId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async replace(movement: Movement): Promise<void> {
    const index = this.entries.findIndex((entry) => entry.id === movement.id);

    if (index === -1) {
      throw new MovementNotFoundError(movement.id);
    }

    this.entries[index] = movement;
  }

  async patientBalance(patientId: string): Promise<number> {
    return this.entries
      .filter((entry) => entry.patientId === patientId && !entry.isVoided)
      .reduce((sum, entry) => sum + entry.signedAmount, 0);
  }

  async cashSummary(
    from: Date | null,
    to: Date | null,
  ): Promise<Array<{ method: PaymentMethod; total: number }>> {
    const totals = new Map<PaymentMethod, number>();

    for (const entry of this.entries) {
      if (entry.kind !== 'abono' || entry.isVoided || entry.method === null) {
        continue;
      }

      if (from !== null && entry.createdAt < from) {
        continue;
      }

      if (to !== null && entry.createdAt > to) {
        continue;
      }

      totals.set(entry.method, (totals.get(entry.method) ?? 0) + entry.amount);
    }

    return [...totals.entries()]
      .map(([method, total]) => ({ method, total }))
      .sort((a, b) => a.method.localeCompare(b.method));
  }

  /** Everything in the book (oldest first) — used by tests. */
  all(): Movement[] {
    return [...this.entries];
  }
}

function compareHistory(a: Movement, b: Movement): number {
  return (
    b.createdAt.getTime() - a.createdAt.getTime() || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0)
  );
}
