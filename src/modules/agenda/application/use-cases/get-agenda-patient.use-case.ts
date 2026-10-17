import { Injectable } from '@nestjs/common';
import { AppointmentRepositoryPort } from '../ports/appointment-repository.port.js';
import { AgendaPatientNotFoundError } from '../../domain/appointment.errors.js';
import type { AppointmentPatient } from '../../domain/appointment.models.js';

@Injectable()
export class GetAgendaPatientUseCase {
  constructor(private readonly appointments: AppointmentRepositoryPort) {}

  async execute(id: string): Promise<AppointmentPatient> {
    const patient = await this.appointments.findPatient(id);

    if (patient === null) {
      throw new AgendaPatientNotFoundError(id);
    }

    return patient;
  }
}
