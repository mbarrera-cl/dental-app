import type { Movement } from '../../domain/movement.entity.js';
import type { PaymentMethod } from '../../domain/payment-method.js';

/**
 * Driven port (secondary port): the persistence contract of the patient
 * account. Concrete adapters live in `infrastructure/adapters` and are bound
 * to this class in the feature module (composition root).
 *
 * The ledger is append-only: `append` inserts and `replace` persists an
 * annulment (a full swap of the row, the domain object is the source of
 * truth). Nothing here ever deletes; annulled movements stay in the book.
 */
export abstract class LedgerRepositoryPort {
  abstract append(movement: Movement): Promise<void>;

  abstract findById(id: string): Promise<Movement | null>;

  /** History of the patient, `created_at DESC, id DESC`. */
  abstract listByPatient(patientId: string, limit: number, offset: number): Promise<Movement[]>;

  /** Total movements of the patient, so the ledger can page without the full book. */
  abstract countByPatient(patientId: string): Promise<number>;

  /**
   * Every movement linked to one quote (voided or not), `created_at DESC`.
   * The quote-charge guard reads this to guarantee *one live charge per quote*.
   */
  abstract listByQuoteId(quoteId: string): Promise<Movement[]>;

  /** Persists an annulment (the row is swapped, never deleted). */
  abstract replace(movement: Movement): Promise<void>;

  /**
   * `sum(non-voided cargos) − sum(non-voided abonos)` of one patient. The
   * balance is computed, not stored, and needs every movement of the book.
   */
  abstract patientBalance(patientId: string): Promise<number>;

  /** Sum of non-voided payments per method inside a date range (both ends optional). */
  abstract cashSummary(
    from: Date | null,
    to: Date | null,
  ): Promise<Array<{ method: PaymentMethod; total: number }>>;
}
