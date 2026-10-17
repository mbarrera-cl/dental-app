import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import {
  ContactoEmergencia,
  type ContactoEmergenciaInput,
} from '../../domain/contacto-emergencia.vo.js';
import { Direccion, type DireccionInput } from '../../domain/direccion.vo.js';
import { Email } from '../../domain/email.vo.js';
import { FechaNacimiento } from '../../domain/fecha-nacimiento.vo.js';
import type { Patient } from '../../domain/patient.entity.js';
import {
  EmptyPatientUpdateError,
  PatientAlreadyExistsError,
  PatientNotFoundError,
} from '../../domain/patient.errors.js';
import { Prevision, type PrevisionInput } from '../../domain/prevision.vo.js';
import { Rut } from '../../../../shared/domain/rut.vo.js';
import { Telefono } from '../../../../shared/domain/telefono.vo.js';
import { PatientRepositoryPort } from '../ports/patient-repository.port.js';

export interface UpdatePatientCommand {
  id: string;
  rut?: string;
  nombres?: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  fechaNacimiento?: string;
  sexo?: string;
  /** `null` clears the field, `undefined` leaves it untouched. */
  email?: string | null;
  telefono?: string | null;
  direccion?: DireccionInput | null;
  prevision?: PrevisionInput | null;
  contactoEmergencia?: ContactoEmergenciaInput | null;
  notas?: string | null;
}

@Injectable()
export class UpdatePatientUseCase implements UseCase<
  UpdatePatientCommand,
  Patient
> {
  constructor(private readonly patientRepository: PatientRepositoryPort) {}

  async execute(command: UpdatePatientCommand): Promise<Patient> {
    const { id } = command;
    const patient = await this.patientRepository.findById(id);

    if (patient === null) {
      throw new PatientNotFoundError(id);
    }

    if (!hasAnyChange(command)) {
      throw new EmptyPatientUpdateError();
    }

    // Validate and normalize up front so the duplicate check runs on the
    // canonical RUT — and before the aggregate is mutated.
    if (command.rut !== undefined) {
      const nextRut = Rut.create(command.rut);
      const existing = await this.patientRepository.findByRut(nextRut.value);

      if (existing !== null && existing.id !== patient.id) {
        throw new PatientAlreadyExistsError(nextRut.value);
      }

      patient.changeRut(nextRut);
    }

    if (command.nombres !== undefined) patient.changeNombres(command.nombres);
    if (command.apellidoPaterno !== undefined)
      patient.changeApellidoPaterno(command.apellidoPaterno);
    if (command.apellidoMaterno !== undefined)
      patient.changeApellidoMaterno(command.apellidoMaterno);
    if (command.fechaNacimiento !== undefined) {
      patient.changeFechaNacimiento(
        FechaNacimiento.create(command.fechaNacimiento),
      );
    }
    if (command.sexo !== undefined) patient.changeSexo(command.sexo);
    if (command.email !== undefined) {
      patient.changeEmail(
        command.email === null ? null : Email.create(command.email),
      );
    }
    if (command.telefono !== undefined) {
      patient.changeTelefono(
        command.telefono === null ? null : Telefono.create(command.telefono),
      );
    }
    if (command.direccion !== undefined) {
      patient.changeDireccion(
        command.direccion === null ? null : Direccion.create(command.direccion),
      );
    }
    if (command.prevision !== undefined) {
      patient.changePrevision(
        command.prevision === null ? null : Prevision.create(command.prevision),
      );
    }
    if (command.contactoEmergencia !== undefined) {
      patient.changeContactoEmergencia(
        command.contactoEmergencia === null
          ? null
          : ContactoEmergencia.create(command.contactoEmergencia),
      );
    }
    if (command.notas !== undefined) patient.changeNotas(command.notas);

    await this.patientRepository.update(patient);

    return patient;
  }
}

function hasAnyChange(command: UpdatePatientCommand): boolean {
  return Object.entries(command).some(
    ([key, value]) => key !== 'id' && value !== undefined,
  );
}
