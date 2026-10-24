import type { Prescription } from '../../domain/prescription.entity.js';

/**
 * Driven port (secondary port): persistence contract of prescriptions.
 * Concrete adapters live in `infrastructure/adapters` and are bound to this
 * class in the feature module (composition root).
 */
export abstract class PrescriptionRepositoryPort {
  abstract save(prescription: Prescription): Promise<void>;

  abstract findById(id: string): Promise<Prescription | null>;

  abstract listByPatient(
    patientId: string,
    limit: number,
    offset: number,
  ): Promise<Prescription[]>;

  /** Total prescriptions of the patient, so the list can page without the full set. */
  abstract countByPatient(patientId: string): Promise<number>;
}
