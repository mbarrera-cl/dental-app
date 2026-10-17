import { Injectable } from '@nestjs/common';
import { GetPatientByRutUseCase } from '../../../patients/application/use-cases/get-patient-by-rut.use-case.js';
import { GetPatientUseCase } from '../../../patients/application/use-cases/get-patient.use-case.js';
import { ListPatientsUseCase } from '../../../patients/application/use-cases/list-patients.use-case.js';
import type { Patient } from '../../../patients/domain/patient.entity.js';

export interface PatientView {
  id: string;
  rut: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  nombreCompleto: string;
  fechaNacimiento: string;
  sexo: string;
  email: string | null;
  telefono: string | null;
  numeroHistoria: string | null;
}

/** MCP-facing patient reads. It never exposes addresses or emergency contacts. */
@Injectable()
export class PatientsFacade {
  constructor(
    private readonly list: ListPatientsUseCase,
    private readonly get: GetPatientUseCase,
    private readonly getByRut: GetPatientByRutUseCase,
  ) {}

  async search(query: string, limit: number): Promise<PatientView[]> {
    const term = stripAccents(query.trim().toLowerCase());
    const rutTerm = query.replace(/[^0-9k]/gi, '').toLowerCase();
    const patients = await this.list.execute();

    return patients
      .filter((patient) => {
        if (term === '') {
          return true;
        }

        const name = stripAccents(patient.nombreCompleto.toLowerCase());
        const rut = patient.rut.replace(/[^0-9k]/gi, '').toLowerCase();

        return name.includes(term) || (rutTerm !== '' && rut.includes(rutTerm));
      })
      .slice(0, limit)
      .map(toView);
  }

  async resolve(reference: { patientId?: string; rut?: string }): Promise<PatientView> {
    if (reference.patientId !== undefined && reference.patientId !== '') {
      return toView(await this.get.execute({ id: reference.patientId }));
    }

    if (reference.rut !== undefined && reference.rut.trim() !== '') {
      return toView(await this.getByRut.execute({ rut: reference.rut.trim() }));
    }

    throw new Error('Provide either patientId or rut.');
  }
}

export function toView(patient: Patient): PatientView {
  return {
    id: patient.id,
    rut: patient.rut,
    nombres: patient.nombres,
    apellidoPaterno: patient.apellidoPaterno,
    apellidoMaterno: patient.apellidoMaterno,
    nombreCompleto: patient.nombreCompleto,
    fechaNacimiento: patient.fechaNacimiento,
    sexo: patient.sexo,
    email: patient.email,
    telefono: patient.telefono,
    numeroHistoria: patient.numeroHistoria,
  };
}

function stripAccents(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '');
}
