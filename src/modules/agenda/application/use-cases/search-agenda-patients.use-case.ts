import { Injectable } from '@nestjs/common';
import { AppointmentRepositoryPort } from '../ports/appointment-repository.port.js';
import type { AppointmentPatient } from '../../domain/appointment.models.js';

@Injectable()
export class SearchAgendaPatientsUseCase {
  constructor(private readonly appointments: AppointmentRepositoryPort) {}

  async execute(query: string): Promise<AppointmentPatient[]> {
    return this.appointments.searchPatients(query.slice(0, 100));
  }
}
