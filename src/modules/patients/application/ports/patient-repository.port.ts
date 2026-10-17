import type { Patient } from '../../domain/patient.entity.js';

/**
 * Driven port (secondary port): the persistence contract the application
 * needs. Concrete adapters live in `infrastructure/adapters` and are bound
 * to this class in the feature module (composition root).
 *
 * The RUT is the business key: adapters must enforce it as unique and
 * translate unique violations into `PatientAlreadyExistsError`.
 */
export abstract class PatientRepositoryPort {
  abstract save(patient: Patient): Promise<void>;

  /** Updates an existing patient; throws `PatientNotFoundError` when it does not exist. */
  abstract update(patient: Patient): Promise<void>;

  /** Deletes a patient; throws `PatientNotFoundError` when it does not exist. */
  abstract delete(id: string): Promise<void>;

  abstract findById(id: string): Promise<Patient | null>;

  /** Expects an already normalized RUT (as produced by the `Rut` value object). */
  abstract findByRut(rut: string): Promise<Patient | null>;

  abstract findAll(): Promise<Patient[]>;

  /** Next free clinical record number, formatted `HC-000123`. */
  abstract nextNumeroHistoria(): Promise<string>;

  /** Patients still missing their clinical record number, oldest first. */
  abstract findWithoutNumeroHistoria(): Promise<Patient[]>;
}
