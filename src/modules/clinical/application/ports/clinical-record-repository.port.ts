import type { ClinicalEvent } from '../../domain/clinical-event.entity.js';
import type { FichaClinica } from '../../domain/ficha-clinica.entity.js';
import type { Finding } from '../../domain/finding.entity.js';

/**
 * Driven port (secondary): everything the clinical application layer needs
 * from persistence. The SQLite adapter enforces one record per patient;
 * findings are append-only (updated only to void them).
 */
export abstract class ClinicalRecordRepositoryPort {
  abstract save(record: FichaClinica): Promise<void>;

  /** Updates an existing record; throws `ClinicalRecordNotFoundError` otherwise. */
  abstract update(record: FichaClinica): Promise<void>;

  abstract findById(id: string): Promise<FichaClinica | null>;

  abstract findByPatientId(patientId: string): Promise<FichaClinica | null>;

  abstract saveFinding(finding: Finding): Promise<void>;

  /** Updates a finding in place; only used to mark it as voided. */
  abstract updateFinding(finding: Finding): Promise<void>;

  abstract findFinding(id: string): Promise<Finding | null>;

  /** Every finding of a record (voided ones included), oldest first. */
  abstract listFindings(recordId: string): Promise<Finding[]>;

  abstract appendEvent(event: ClinicalEvent): Promise<void>;

  /** Timeline of a record, newest first. */
  abstract listEvents(recordId: string): Promise<ClinicalEvent[]>;
}
