import { Injectable } from '@nestjs/common';
import { PatientRepositoryPort } from '../../../application/ports/patient-repository.port.js';
import { formatNumeroHistoria } from '../../../domain/numero-historia.js';
import type { Patient } from '../../../domain/patient.entity.js';
import { PatientNotFoundError } from '../../../domain/patient.errors.js';

/**
 * Driven adapter: keeps patients in memory for local development and tests.
 * Swap it for a database-backed adapter by rebinding `PatientRepositoryPort`
 * in `PatientsModule` — nothing else in the codebase has to change.
 */
@Injectable()
export class InMemoryPatientRepository extends PatientRepositoryPort {
  private readonly patients = new Map<string, Patient>();
  private numeroHistoriaSequence = 0;

  async save(patient: Patient): Promise<void> {
    this.patients.set(patient.id, patient);
  }

  async update(patient: Patient): Promise<void> {
    if (!this.patients.has(patient.id)) {
      throw new PatientNotFoundError(patient.id);
    }

    this.patients.set(patient.id, patient);
  }

  async delete(id: string): Promise<void> {
    if (!this.patients.delete(id)) {
      throw new PatientNotFoundError(id);
    }
  }

  async findById(id: string): Promise<Patient | null> {
    return this.patients.get(id) ?? null;
  }

  async findByRut(rut: string): Promise<Patient | null> {
    for (const patient of this.patients.values()) {
      if (patient.rut === rut) {
        return patient;
      }
    }

    return null;
  }

  async findAll(): Promise<Patient[]> {
    return [...this.patients.values()];
  }

  async nextNumeroHistoria(): Promise<string> {
    this.numeroHistoriaSequence += 1;
    return formatNumeroHistoria(this.numeroHistoriaSequence);
  }

  async findWithoutNumeroHistoria(): Promise<Patient[]> {
    return [...this.patients.values()].filter(
      (patient) => patient.numeroHistoria === null,
    );
  }
}
