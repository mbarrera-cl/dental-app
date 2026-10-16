import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import type { ContactoEmergenciaInput } from '../../domain/contacto-emergencia.vo.js';
import type { DireccionInput } from '../../domain/direccion.vo.js';
import { Patient } from '../../domain/patient.entity.js';
import { PatientAlreadyExistsError } from '../../domain/patient.errors.js';
import type { PrevisionInput } from '../../domain/prevision.vo.js';
import { PatientRepositoryPort } from '../ports/patient-repository.port.js';

export interface CreatePatientCommand {
  rut: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  fechaNacimiento: string;
  sexo: string;
  email?: string | null;
  telefono?: string | null;
  direccion?: DireccionInput | null;
  prevision?: PrevisionInput | null;
  contactoEmergencia?: ContactoEmergenciaInput | null;
  notas?: string | null;
}

@Injectable()
export class CreatePatientUseCase implements UseCase<
  CreatePatientCommand,
  Patient
> {
  constructor(private readonly patientRepository: PatientRepositoryPort) {}

  async execute(command: CreatePatientCommand): Promise<Patient> {
    // Build the aggregate first so domain invariants (RUT check digit,
    // birth date, nested value objects) are validated before the repository
    // is touched.
    const patient = Patient.create(command);

    const existing = await this.patientRepository.findByRut(patient.rut);

    if (existing !== null) {
      throw new PatientAlreadyExistsError(patient.rut);
    }

    // The adapter additionally translates the UNIQUE constraint on `rut`,
    // which also covers two concurrent creations.
    await this.patientRepository.save(patient);

    return patient;
  }
}
