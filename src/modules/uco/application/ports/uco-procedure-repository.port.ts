import type { UcoProcedure } from '../../domain/uco-procedure.entity.js';

/**
 * Driven port (secondary port): persistence contract of the UCO fee catalog.
 * Concrete adapters live in `infrastructure/adapters` and are bound to this
 * class in the feature module (composition root).
 *
 * The code is the business key: adapters must enforce it as unique and
 * translate unique violations into `UcoProcedureCodeTakenError`.
 */
export abstract class UcoProcedureRepositoryPort {
  abstract save(procedure: UcoProcedure): Promise<void>;

  /** Updates an existing entry; throws `UcoProcedureNotFoundError` when it does not exist. */
  abstract update(procedure: UcoProcedure): Promise<void>;

  /** Soft-delete (set `active = 0`); throws `UcoProcedureNotFoundError` when missing. */
  abstract delete(id: string): Promise<void>;

  abstract findById(id: string): Promise<UcoProcedure | null>;

  abstract findByCode(code: string): Promise<UcoProcedure | null>;

  /** Every entry, active first then by name. */
  abstract findAll(): Promise<UcoProcedure[]>;

  /**
   * Searchable catalog: matches code, name or chapter against `q`
   * (case-insensitive). `activeOnly` restricts the result to active entries.
   */
  abstract search(q: string, activeOnly: boolean): Promise<UcoProcedure[]>;
}
