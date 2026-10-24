import type { ConsentRecord } from '../../domain/consent-record.entity.js';

/**
 * Driven port (secondary port): append-only persistence of accepted consents.
 */
export abstract class ConsentRecordRepositoryPort {
  abstract append(record: ConsentRecord): Promise<void>;

  abstract findById(id: string): Promise<ConsentRecord | null>;

  abstract listByPatient(
    patientId: string,
    limit: number,
    offset: number,
  ): Promise<ConsentRecord[]>;

  /** Total consents accepted by the patient, across pages. */
  abstract countByPatient(patientId: string): Promise<number>;
}
